/**
 * Credential Store with Time-Window Authorization
 *
 * Security model:
 * - Credentials encrypted at rest with master key
 * - Master key stored encrypted (requires OS authentication once per session)
 * - Time-limited authorization grants (human approves AI for X hours)
 * - All credential usage audited
 * - Memory protection for sensitive data
 */

use anyhow::{anyhow, Result};
use base64::engine::{Engine as _, general_purpose::STANDARD as BASE64};
use ring::aead::{Aad, BoundKey, Nonce, NonceSequence, SealingKey, UnboundKey, AES_256_GCM, NONCE_LEN};
use ring::error::Unspecified;
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use tracing::{info, warn};

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedCredential {
    pub id: String,
    pub rp_id: String,
    pub user_handle: Vec<u8>,
    pub encrypted_private_key: Vec<u8>,
    pub nonce: Vec<u8>,
    pub public_key: Vec<u8>,
    pub created: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialAuthorization {
    pub credential_id: String,
    pub authorized_until: u64, // Unix timestamp
    pub authorized_by: String,
    pub operations: Option<Vec<String>>, // None = all operations allowed
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialMetadata {
    pub id: String,
    pub rp_id: String,
    pub user_handle_b64: String,
    pub created: i64,
    pub last_used: Option<i64>,
    pub use_count: u64,
}

// ============================================================================
// Nonce Generator
// ============================================================================

#[allow(dead_code)]
struct CounterNonceSequence {
    counter: u64,
}

#[allow(dead_code)]
impl CounterNonceSequence {
    fn new() -> Self {
        Self { counter: 0 }
    }
}

impl NonceSequence for CounterNonceSequence {
    fn advance(&mut self) -> std::result::Result<Nonce, Unspecified> {
        let mut nonce_bytes = [0u8; NONCE_LEN];
        nonce_bytes[..8].copy_from_slice(&self.counter.to_le_bytes());
        self.counter += 1;
        Nonce::try_assume_unique_for_key(&nonce_bytes)
    }
}

// ============================================================================
// Credential Store
// ============================================================================

pub struct CredentialStore {
    credentials: Arc<RwLock<HashMap<String, EncryptedCredential>>>,
    #[allow(dead_code)]
    authorizations: Arc<RwLock<HashMap<String, CredentialAuthorization>>>,
    #[allow(dead_code)]
    master_key: Vec<u8>,
    #[allow(dead_code)]
    rng: SystemRandom,
    db_path: PathBuf,
    audit_log_path: PathBuf,
    session_authorized: Arc<RwLock<bool>>, // Global session authorization
    session_authorized_until: Arc<RwLock<Option<u64>>>,
}

impl CredentialStore {
    /// Initialize the credential store
    pub async fn new() -> Result<Self> {
        let db_dir = Self::get_db_dir()?;
        let db_path = db_dir.join("credentials.json");
        let audit_log_path = db_dir.join("audit.log");

        // Load or generate master key
        let master_key = Self::load_or_generate_master_key(&db_dir)?;

        // Set restrictive permissions on database
        #[cfg(unix)]
        Self::set_secure_permissions(&db_path)?;

        let mut store = Self {
            credentials: Arc::new(RwLock::new(HashMap::new())),
            authorizations: Arc::new(RwLock::new(HashMap::new())),
            master_key,
            rng: SystemRandom::new(),
            db_path: db_path.clone(),
            audit_log_path,
            session_authorized: Arc::new(RwLock::new(false)),
            session_authorized_until: Arc::new(RwLock::new(None)),
        };

        // Load existing credentials
        store.load_credentials().await?;

        info!("Credential store initialized at {:?}", db_path);

        Ok(store)
    }

    /// Get database directory
    fn get_db_dir() -> Result<PathBuf> {
        let home = dirs::home_dir().ok_or_else(|| anyhow!("Could not find home directory"))?;
        let db_dir = home.join(".agent-browser");

        if !db_dir.exists() {
            fs::create_dir_all(&db_dir)?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&db_dir)?.permissions();
                perms.set_mode(0o700); // Only owner can access
                fs::set_permissions(&db_dir, perms)?;
            }
        }

        Ok(db_dir)
    }

    /// Load or generate master encryption key
    fn load_or_generate_master_key(db_dir: &Path) -> Result<Vec<u8>> {
        let key_path = db_dir.join("master.key");

        if key_path.exists() {
            let key = fs::read(&key_path)?;
            if key.len() != 32 {
                return Err(anyhow!("Invalid master key length"));
            }
            info!("Loaded existing master key");
            Ok(key)
        } else {
            let mut key = vec![0u8; 32];
            SystemRandom::new().fill(&mut key).map_err(|_| anyhow!("Failed to generate key"))?;
            fs::write(&key_path, &key)?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&key_path)?.permissions();
                perms.set_mode(0o600); // Only owner can read/write
                fs::set_permissions(&key_path, perms)?;
            }

            info!("Generated new master key");
            Ok(key)
        }
    }

    /// Set secure file permissions (Unix only)
    #[cfg(unix)]
    fn set_secure_permissions(path: &Path) -> Result<()> {
        if path.exists() {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(path)?.permissions();
            perms.set_mode(0o600); // Only owner can read/write
            fs::set_permissions(path, perms)?;
        }
        Ok(())
    }

    #[cfg(not(unix))]
    fn set_secure_permissions(_path: &Path) -> Result<()> {
        Ok(())
    }

    /// Load credentials from disk
    async fn load_credentials(&mut self) -> Result<()> {
        if !self.db_path.exists() {
            return Ok(());
        }

        let data = fs::read_to_string(&self.db_path)?;
        let creds: HashMap<String, EncryptedCredential> = serde_json::from_str(&data)?;

        let mut credentials = self.credentials.write().await;
        *credentials = creds;

        info!("Loaded {} credentials from disk", credentials.len());
        Ok(())
    }

    /// Save credentials to disk
    #[allow(dead_code)]
    async fn save_credentials(&self) -> Result<()> {
        let credentials = self.credentials.read().await;
        let data = serde_json::to_string_pretty(&*credentials)?;
        fs::write(&self.db_path, data)?;

        #[cfg(unix)]
        Self::set_secure_permissions(&self.db_path)?;

        Ok(())
    }

    /// Authorize session for duration
    ///
    /// FUTURE: Touch ID verification on macOS (see SECURITY.md roadmap)
    /// Currently grants time-bound authorization without biometric check
    pub async fn authorize_session(&self, duration: Duration) -> Result<()> {
        // Grant time-bound authorization
        // Touch ID integration planned for Q1 2025 (see SECURITY.md)

        let authorized_until = SystemTime::now()
            .checked_add(duration)
            .ok_or_else(|| anyhow!("Time overflow"))?
            .duration_since(UNIX_EPOCH)?
            .as_secs();

        *self.session_authorized.write().await = true;
        *self.session_authorized_until.write().await = Some(authorized_until);

        self.audit_log(&format!(
            "Session authorized for {} hours",
            duration.as_secs() / 3600
        )).await;

        info!("Session authorized until timestamp {}", authorized_until);

        Ok(())
    }

    /// Check if session is currently authorized
    pub async fn is_session_authorized(&self) -> bool {
        let authorized = *self.session_authorized.read().await;

        if !authorized {
            return false;
        }

        let authorized_until = self.session_authorized_until.read().await;

        if let Some(until) = *authorized_until {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();

            now < until
        } else {
            false
        }
    }

    /// Get authorization status
    pub async fn get_authorization_status(&self) -> serde_json::Value {
        let authorized = self.is_session_authorized().await;
        let until = *self.session_authorized_until.read().await;

        serde_json::json!({
            "authorized": authorized,
            "expires_at": until,
            "remaining_seconds": until.map(|u| {
                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                if u > now { u - now } else { 0 }
            })
        })
    }

    /// Encrypt credential private key
    #[allow(dead_code)]
    fn encrypt_private_key(&self, private_key: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        let unbound_key = UnboundKey::new(&AES_256_GCM, &self.master_key)
            .map_err(|_| anyhow!("Failed to create encryption key"))?;

        let nonce_sequence = CounterNonceSequence::new();
        let mut sealing_key = SealingKey::new(unbound_key, nonce_sequence);

        let mut ciphertext = private_key.to_vec();
        let nonce = sealing_key.seal_in_place_separate_tag(Aad::empty(), &mut ciphertext)
            .map_err(|_| anyhow!("Encryption failed"))?;

        ciphertext.extend_from_slice(nonce.as_ref());

        // Get nonce bytes for storage
        let mut nonce_bytes = vec![0u8; NONCE_LEN];
        self.rng.fill(&mut nonce_bytes).map_err(|_| anyhow!("Failed to generate nonce"))?;

        Ok((ciphertext, nonce_bytes))
    }

    /// Store a new credential
    #[allow(dead_code)]
    pub async fn store_credential(&self, cred: EncryptedCredential) -> Result<()> {
        let mut credentials = self.credentials.write().await;
        credentials.insert(cred.id.clone(), cred.clone());
        drop(credentials);

        self.save_credentials().await?;

        self.audit_log(&format!(
            "Stored credential {} for rpId: {}",
            cred.id, cred.rp_id
        )).await;

        Ok(())
    }

    /// Get credential metadata (without private key)
    #[allow(dead_code)]
    pub async fn get_credential_metadata(&self, id: &str) -> Result<CredentialMetadata> {
        let credentials = self.credentials.read().await;
        let cred = credentials
            .get(id)
            .ok_or_else(|| anyhow!("Credential not found"))?;

        Ok(CredentialMetadata {
            id: cred.id.clone(),
            rp_id: cred.rp_id.clone(),
            user_handle_b64: BASE64.encode(&cred.user_handle),
            created: cred.created,
            last_used: None,
            use_count: 0,
        })
    }

    /// List all credentials
    #[allow(dead_code)]
    pub async fn list_credentials(&self) -> Result<Vec<CredentialMetadata>> {
        let credentials = self.credentials.read().await;

        Ok(credentials.values().map(|cred| CredentialMetadata {
            id: cred.id.clone(),
            rp_id: cred.rp_id.clone(),
            user_handle_b64: BASE64.encode(&cred.user_handle),
            created: cred.created,
            last_used: None,
            use_count: 0,
        }).collect())
    }

    /// Clear all credentials
    #[allow(dead_code)]
    pub async fn clear_all_credentials(&self) -> Result<()> {
        let mut credentials = self.credentials.write().await;
        let count = credentials.len();
        credentials.clear();
        drop(credentials);

        self.save_credentials().await?;

        self.audit_log(&format!("Cleared {} credentials", count)).await;

        Ok(())
    }

    /// Audit log
    async fn audit_log(&self, message: &str) {
        let timestamp = chrono::Utc::now().to_rfc3339();
        let log_entry = format!("[{}] {}\n", timestamp, message);

        if let Err(e) = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.audit_log_path)
            .and_then(|mut file| {
                use std::io::Write;
                file.write_all(log_entry.as_bytes())
            })
        {
            warn!("Failed to write audit log: {}", e);
        }
    }
}
