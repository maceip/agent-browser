/**
 * Welcome Page - Email Provider Setup
 *
 * Handles first-time setup for magic link automation:
 * - Email provider detection
 * - Authentication flow
 * - Cookie/session storage
 */

// ============================================================================
// Email Provider Detection
// ============================================================================

interface EmailProvider {
  name: string;
  domain: string;
  icon: string;
  loginUrl: string;
  inboxUrl: string;
  cookieDomains: string[];
}

const EMAIL_PROVIDERS: Record<string, EmailProvider> = {
  gmail: {
    name: 'Gmail',
    domain: 'gmail.com',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="%234caf50" d="M45,16.2l-5,2.75l-5,4.75L35,40h7c1.657,0,3-1.343,3-3V16.2z"/><path fill="%231e88e5" d="M3,16.2l3.614,1.71L13,23.7V40H6c-1.657,0-3-1.343-3-3V16.2z"/><polygon fill="%23e53935" points="35,11.2 24,19.45 13,11.2 12,17 13,23.7 24,31.95 35,23.7 36,17"/><path fill="%23c62828" d="M3,12.298V16.2l10,7.5V11.2L9.876,8.859C9.132,8.301,8.228,8,7.298,8h0C4.924,8,3,9.924,3,12.298z"/><path fill="%23fbc02d" d="M45,12.298V16.2l-10,7.5V11.2l3.124-2.341C38.868,8.301,39.772,8,40.702,8h0 C43.076,8,45,9.924,45,12.298z"/></svg>',
    loginUrl: 'https://accounts.google.com/',
    inboxUrl: 'https://mail.google.com/mail/u/0/#inbox',
    cookieDomains: ['.google.com', '.gmail.com', 'accounts.google.com', 'mail.google.com']
  },
  outlook: {
    name: 'Outlook',
    domain: 'outlook.com',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="%230078d4" d="M42,9H28c-1.1,0-2,0.9-2,2v26c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V11C44,9.9,43.1,9,42,9z"/><path fill="%23ffffff" d="M35,30c-2.8,0-5-2.2-5-5s2.2-5,5-5s5,2.2,5,5S37.8,30,35,30z M35,22c-1.7,0-3,1.3-3,3s1.3,3,3,3s3-1.3,3-3 S36.7,22,35,22z"/><path fill="%230078d4" d="M6,11v26c0,1.1,0.9,2,2,2h16V9H8C6.9,9,6,9.9,6,11z"/><path fill="%23ffffff" d="M16,30c-2.8,0-5-2.2-5-5s2.2-5,5-5s5,2.2,5,5S18.8,30,16,30z M16,22c-1.7,0-3,1.3-3,3s1.3,3,3,3 s3-1.3,3-3S17.7,22,16,22z"/></svg>',
    loginUrl: 'https://login.live.com/',
    inboxUrl: 'https://outlook.live.com/mail/0/inbox',
    cookieDomains: ['.live.com', '.outlook.com', '.microsoft.com', 'login.live.com', 'outlook.live.com']
  },
  yahoo: {
    name: 'Yahoo Mail',
    domain: 'yahoo.com',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="%236001d2" d="M24,4C12.95,4,4,12.95,4,24s8.95,20,20,20s20-8.95,20-20S35.05,4,24,4z"/><path fill="%23ffffff" d="M26.5,32h-5v-7l-7-13h5.5l4,8l4-8H33l-7,13V32z"/></svg>',
    loginUrl: 'https://login.yahoo.com/',
    inboxUrl: 'https://mail.yahoo.com/d/folders/1',
    cookieDomains: ['.yahoo.com', 'login.yahoo.com', 'mail.yahoo.com']
  },
  proton: {
    name: 'ProtonMail',
    domain: 'proton.me',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="%236d4aff" d="M24,4C12.95,4,4,12.95,4,24s8.95,20,20,20s20-8.95,20-20S35.05,4,24,4z"/><path fill="%23ffffff" d="M32,16H16c-2.2,0-4,1.8-4,4v8c0,2.2,1.8,4,4,4h4v4l6-4h6c2.2,0,4-1.8,4-4v-8C36,17.8,34.2,16,32,16z"/></svg>',
    loginUrl: 'https://account.proton.me/login',
    inboxUrl: 'https://mail.proton.me/u/0/inbox',
    cookieDomains: ['.proton.me', 'account.proton.me', 'mail.proton.me']
  },
  icloud: {
    name: 'iCloud Mail',
    domain: 'icloud.com',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="%233b99fc" d="M36.5,28c-0.2,0-0.3,0-0.5,0c0-0.2,0-0.3,0-0.5c0-4.1-3.4-7.5-7.5-7.5c-1.4,0-2.7,0.4-3.8,1.1 c-1.5-3.7-5.1-6.1-9.2-6.1c-5.5,0-10,4.5-10,10c0,0.2,0,0.3,0,0.5C3.5,26,2,27.9,2,30c0,2.8,2.2,5,5,5h29.5c3,0,5.5-2.5,5.5-5.5 S39.5,28,36.5,28z"/></svg>',
    loginUrl: 'https://www.icloud.com/',
    inboxUrl: 'https://www.icloud.com/mail',
    cookieDomains: ['.icloud.com', '.apple.com', 'www.icloud.com']
  }
};

// ============================================================================
// DOM Elements
// ============================================================================

const emailInput = document.getElementById('emailInput') as HTMLInputElement;
const providerIcon = document.getElementById('providerIcon') as HTMLElement;
const providerName = document.getElementById('providerName') as HTMLElement;
const continueBtn = document.getElementById('continueBtn') as HTMLButtonElement;
const openAuthBtn = document.getElementById('openAuthBtn') as HTMLButtonElement;
const backBtn = document.getElementById('backBtn') as HTMLButtonElement;
const finishBtn = document.getElementById('finishBtn') as HTMLButtonElement;

const step1 = document.getElementById('step1') as HTMLElement;
const step2 = document.getElementById('step2') as HTMLElement;
const step3 = document.getElementById('step3') as HTMLElement;

const authProvider = document.getElementById('authProvider') as HTMLElement;
const authProviderName = document.getElementById('authProviderName') as HTMLElement;
const authStatus = document.getElementById('authStatus') as HTMLElement;
const emailDisplay = document.getElementById('emailDisplay') as HTMLElement;
const autoDetectBadge = document.getElementById('autoDetectBadge') as HTMLElement;

// ============================================================================
// State
// ============================================================================

let currentProvider: EmailProvider | null = null;
let userEmail: string = '';
let authTabId: number | null = null;

// ============================================================================
// Email Provider Detection
// ============================================================================

function detectProvider(email: string): EmailProvider | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  // Direct match
  for (const provider of Object.values(EMAIL_PROVIDERS)) {
    if (domain === provider.domain || domain.endsWith('.' + provider.domain)) {
      return provider;
    }
  }

  // Special cases
  if (domain.includes('hotmail') || domain.includes('live')) {
    return EMAIL_PROVIDERS.outlook;
  }

  if (domain.includes('pm.me') || domain.includes('protonmail')) {
    return EMAIL_PROVIDERS.proton;
  }

  if (domain.includes('me.com') || domain.includes('mac.com')) {
    return EMAIL_PROVIDERS.icloud;
  }

  return null;
}

function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ============================================================================
// UI Updates
// ============================================================================

emailInput.addEventListener('input', () => {
  const email = emailInput.value.trim();

  if (validateEmail(email)) {
    const provider = detectProvider(email);

    if (provider) {
      currentProvider = provider;
      userEmail = email;

      // Update provider icon
      providerIcon.style.backgroundImage = `url('${provider.icon}')`;
      providerIcon.classList.add('visible');

      // Update provider name
      providerName.textContent = provider.name;
      providerName.style.color = '#4169e1';

      // Enable continue button
      continueBtn.disabled = false;
    } else {
      // Unknown provider
      providerIcon.classList.remove('visible');
      providerName.textContent = 'Unknown Provider';
      providerName.style.color = '#ff4444';
      continueBtn.disabled = true;
    }
  } else {
    // Invalid email
    providerIcon.classList.remove('visible');
    providerName.textContent = '—';
    continueBtn.disabled = true;
  }
});

// ============================================================================
// Step Navigation
// ============================================================================

continueBtn.addEventListener('click', () => {
  if (!currentProvider) return;

  // Move to step 2
  step1.classList.remove('active');
  step2.classList.add('active');

  // Update auth provider names
  authProvider.textContent = currentProvider.name;
  authProviderName.textContent = currentProvider.name;
});

backBtn.addEventListener('click', () => {
  step2.classList.remove('active');
  step1.classList.add('active');
  authStatus.classList.remove('active');
});

// ============================================================================
// Authentication Flow
// ============================================================================

openAuthBtn.addEventListener('click', async () => {
  if (!currentProvider) return;

  // Show auth status
  authStatus.classList.add('active');

  // Open provider login in new tab
  const tab = await chrome.tabs.create({
    url: currentProvider.loginUrl,
    active: true
  });

  authTabId = tab.id || null;

  // Start monitoring for authentication
  startAuthMonitoring();
});

function startAuthMonitoring() {
  if (!currentProvider || !authTabId) return;

  // Listen for tab updates
  const listener = async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
    if (tabId !== authTabId) return;

    // Check if navigated to inbox
    if (changeInfo.url && changeInfo.url.includes(currentProvider!.inboxUrl)) {
      console.log('[Welcome] User authenticated - detected inbox URL');

      // Wait a bit for cookies to be set
      setTimeout(async () => {
        await saveEmailProviderConfig();
        chrome.tabs.onUpdated.removeListener(listener);
        showSuccessStep();
      }, 2000);
    }
  };

  chrome.tabs.onUpdated.addListener(listener);

  // Fallback: Poll for cookies
  const pollInterval = setInterval(async () => {
    try {
      const cookies = await chrome.cookies.getAll({
        domain: currentProvider!.cookieDomains[0]
      });

      if (cookies.length > 0) {
        console.log('[Welcome] Cookies detected:', cookies.length);
        clearInterval(pollInterval);
        chrome.tabs.onUpdated.removeListener(listener);
        await saveEmailProviderConfig();
        showSuccessStep();
      }
    } catch (error) {
      console.error('[Welcome] Error checking cookies:', error);
    }
  }, 2000);

  // Stop polling after 5 minutes
  setTimeout(() => {
    clearInterval(pollInterval);
    chrome.tabs.onUpdated.removeListener(listener);
  }, 300000);
}

async function saveEmailProviderConfig() {
  if (!currentProvider) return;

  const config = {
    email: userEmail,
    provider: currentProvider.name,
    providerDomain: currentProvider.domain,
    inboxUrl: currentProvider.inboxUrl,
    cookieDomains: currentProvider.cookieDomains,
    setupComplete: true,
    setupDate: new Date().toISOString()
  };

  // Save to chrome.storage.local
  await chrome.storage.local.set({ emailProviderConfig: config });

  console.log('[Welcome] Email provider config saved:', config);
}

function showSuccessStep() {
  step2.classList.remove('active');
  step3.classList.add('active');

  emailDisplay.textContent = userEmail;

  // Close auth tab
  if (authTabId) {
    chrome.tabs.remove(authTabId).catch(() => {});
  }
}

// ============================================================================
// Finish
// ============================================================================

finishBtn.addEventListener('click', () => {
  // Close welcome tab
  window.close();
});

// ============================================================================
// Particle Animation (Optional Eye Candy)
// ============================================================================

function createParticles() {
  const particlesContainer = document.getElementById('particles');
  if (!particlesContainer) return;

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.style.position = 'absolute';
    particle.style.width = Math.random() * 4 + 'px';
    particle.style.height = particle.style.width;
    particle.style.background = Math.random() > 0.5 ? '#4169e1' : '#ffd700';
    particle.style.borderRadius = '50%';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.opacity = String(Math.random() * 0.5 + 0.1);
    particle.style.animation = `particleFloat ${Math.random() * 10 + 5}s linear infinite`;
    particle.style.animationDelay = Math.random() * 5 + 's';

    particlesContainer.appendChild(particle);
  }
}

// Add particle animation keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes particleFloat {
    0% {
      transform: translateY(0) translateX(0);
    }
    50% {
      transform: translateY(-20px) translateX(10px);
    }
    100% {
      transform: translateY(0) translateX(0);
    }
  }
`;
document.head.appendChild(style);

// ============================================================================
// Auto-detect Email from Chrome Profile
// ============================================================================

async function autoDetectEmail() {
  try {
    // Get profile user info using identity API
    const profileInfo = await chrome.identity.getProfileUserInfo({
      accountStatus: 'ANY'
    });

    if (profileInfo.email) {
      console.log('[Welcome] Auto-detected email from Chrome profile:', profileInfo.email);

      // Show auto-detect badge
      autoDetectBadge.classList.add('visible');

      // Pre-fill email input with animation delay
      setTimeout(() => {
        emailInput.value = profileInfo.email;

        // Trigger input event to run validation and provider detection
        const inputEvent = new Event('input', { bubbles: true });
        emailInput.dispatchEvent(inputEvent);

        // Focus on continue button instead of email input
        setTimeout(() => {
          if (!continueBtn.disabled) {
            continueBtn.focus();
          }
        }, 500);
      }, 300);

      return profileInfo.email;
    } else {
      console.log('[Welcome] No email found in Chrome profile');
      // Focus on email input for manual entry
      emailInput.focus();
    }
  } catch (error) {
    console.error('[Welcome] Error detecting email from profile:', error);
    // Fallback to manual entry
    emailInput.focus();
  }

  return null;
}

// Initialize particles on load
createParticles();

// Auto-detect email from Chrome profile
autoDetectEmail();

console.log('[Welcome] Welcome page initialized');
