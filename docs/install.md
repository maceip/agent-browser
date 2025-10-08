# Install & Upgrade

This project ships with helper scripts for a one-command setup, but everything can be installed manually when automation is not an option. Use this document to understand what runs, why `sudo` is requested, and how to repeat the steps by hand.

## Prerequisites

- macOS 13+ or Linux with Google Chrome (Stable, Beta, Dev, or Canary)
- Rust toolchain (rustup recommended) with `cargo` on `PATH`
- Bun and Node.js 18+
- Anthropic Claude CLI (`claude`) if you plan to register the MCP server immediately
- `sudo` access to copy binaries into `/usr/local/bin`

Run `rustc --version`, `bun --version`, and `node --version` to verify the toolchain before continuing.

## Using `./install.sh`

The root-level script performs the following in order:

1. Detects macOS or Linux and resolves Chrome native-messaging directories
2. Verifies Rust, Bun, and Node.js are installed
3. Builds the Rust binaries in release mode (`cargo build --release`)
4. Copies `agent-browser-server` and `agent-browser-nmh` into `/usr/local/bin` (requires `sudo`)
5. Computes the Chrome extension ID from `extension/public/manifest.json`
6. Writes native messaging manifests for every detected Chrome channel
7. Runs `bun install` and `bun run build` inside `extension/`
8. Prints the extension path plus post-install checklist

Use this path when you are comfortable with the script creating directories under your Chrome profile and writing to `/usr/local/bin`.

## Manual install

If you prefer to run each step yourself:

1. **Build the server and shim**
   ```bash
   cd server
   cargo build --release
   cd ..
   ```
2. **Install binaries** (requires `sudo` or an alternate writable prefix)
   ```bash
   sudo install -m 755 server/target/release/agent-browser-server /usr/local/bin/agent-browser-server
   sudo install -m 755 server/target/release/nmh_shim /usr/local/bin/agent-browser-nmh
   ```
3. **Compute the extension ID**
   ```bash
   node scripts/get-extension-id.js > extension/EXTENSION_ID
   ```
4. **Create native messaging manifests** (repeat for each Chrome channel you use)
   ```bash
   export EXTENSION_ID="$(cat extension/EXTENSION_ID)"
   mkdir -p "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
   cat > "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.agentbrowser.native.json" <<JSON
   {
     "name": "com.agentbrowser.native",
     "description": "Agent Browser Native Messaging Host",
     "path": "/usr/local/bin/agent-browser-nmh",
     "type": "stdio",
     "allowed_origins": [
       "chrome-extension://$EXTENSION_ID/"
     ]
   }
   JSON
   ```
   Adjust the directory for Canary (`Chrome Canary`), Dev, Beta, or Linux (`~/.config/google-chrome*/NativeMessagingHosts`).
5. **Build the extension bundle**
   ```bash
   cd extension
   bun install --silent
   bun run build
   cd ..
   ```
6. **Load the unpacked extension** through `chrome://extensions/`, enable *Developer mode*, and choose `extension/public`.

Scripts such as `install-nmh.sh` encapsulate steps 1–5 if you want a slimmer automation surface.

## Upgrades

- Re-run `cargo build --release` after pulling changes to the Rust server and copy the binaries again
- Rebuild the extension with `bun run build` whenever code under `extension/` changes
- If `manifest.json` updates its key, recompute the extension ID and re-copy your native messaging manifests

`./verify-install.sh` checks binaries, manifests, and ports. Run it after upgrading to confirm everything is wired correctly.

## Uninstall

Use `./uninstall-nmh.sh` to remove the native messaging host and binaries placed by `install.sh`. You can also manually delete `/usr/local/bin/agent-browser-server`, `/usr/local/bin/agent-browser-nmh`, and the manifest files under your Chrome profile.
