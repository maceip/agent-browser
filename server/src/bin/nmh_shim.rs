use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::time::Duration;
use std::thread;

#[derive(Debug, Deserialize)]
struct NmhRequest {
    #[allow(dead_code)]
    #[serde(default)]
    cmd: String,
}

#[derive(Debug, Serialize)]
struct NmhResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    logs: Option<String>,
    host: String,
    port: u16,
    scheme: String,
}

fn write_native_message<T: Serialize>(value: &T) -> Result<()> {
    let json = serde_json::to_vec(value)?;
    let len = json.len() as u32;

    // Chrome uses little-endian 4-byte length prefix
    std::io::stdout().write_all(&len.to_le_bytes())?;
    std::io::stdout().write_all(&json)?;
    std::io::stdout().flush()?;
    Ok(())
}

fn read_native_message() -> Result<serde_json::Value> {
    let mut len_bytes = [0u8; 4];
    std::io::stdin().read_exact(&mut len_bytes)?;
    let len = u32::from_le_bytes(len_bytes) as usize;

    let mut buf = vec![0u8; len];
    std::io::stdin().read_exact(&mut buf)?;
    Ok(serde_json::from_slice(&buf)?)
}

fn is_server_running() -> bool {
    // Check if WebSocket port is accessible (server is running)
    std::net::TcpStream::connect("127.0.0.1:8085").is_ok()
}

fn spawn_server() -> Result<String> {
    // Find the agent-browser-server binary in the same directory
    let server_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("agent-browser-server")))
        .unwrap_or_else(|| std::path::PathBuf::from("agent-browser-server"));

    let mut logs = format!("Starting server: {:?}\n", server_path);

    // Spawn the server detached with MCP_TCP enabled
    let child = Command::new(&server_path)
        .env("RUST_LOG", "info")
        .env("MCP_TCP", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .context("Failed to spawn agent-browser-server")?;

    logs.push_str(&format!("Server started with PID: {}\n", child.id()));

    // Give it time to start
    thread::sleep(Duration::from_millis(1000));

    // Verify it started
    if is_server_running() {
        logs.push_str("Server is now running\n");
    } else {
        logs.push_str("Warning: Server may not have started properly\n");
    }

    Ok(logs)
}

fn main() -> Result<()> {
    // Read the request from Chrome
    let request = read_native_message().context("Failed to read native message")?;
    eprintln!("NMH request: {}", request);

    let _req: NmhRequest = serde_json::from_value(request)
        .unwrap_or(NmhRequest { cmd: String::new() });

    // Simple logic: ensure server is running
    let mut logs = String::new();
    let mut error = None;

    if is_server_running() {
        logs.push_str("Server already running\n");
    } else {
        logs.push_str("Server not running, starting it...\n");
        match spawn_server() {
            Ok(spawn_logs) => logs.push_str(&spawn_logs),
            Err(e) => {
                error = Some(format!("Failed to start server: {}", e));
                logs.push_str(&format!("Error: {}\n", e));
            }
        }
    }

    // Send response (using localhost:8084 for MCP, server also listens on 8085 for WebSocket)
    let response = NmhResponse {
        ok: error.is_none(),
        error,
        logs: if logs.is_empty() { None } else { Some(logs) },
        host: "localhost".into(),
        port: 8084, // MCP TCP port
        scheme: "http".into(),
    };

    write_native_message(&response)?;
    Ok(())
}
