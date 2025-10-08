# Email Provider Configuration

Agent Browser automates magic-link sign-in flows by connecting to your primary inbox and monitoring for verification messages that match the current signup or login attempt. Configuration happens inside the extension's welcome screen, but the details below help you understand what is stored and how to adjust it.

## Setup flow

1. Load the extension and click the toolbar icon or badge (`⋯`, `✓`, etc.).
2. On the welcome surface, enter the email address you want automation to use.
3. The extension auto-detects the provider and prompts you to open the provider's login page.
4. Authenticate in the newly opened tab; the extension watches for a successful session cookie.
5. Once authenticated, the badge turns green for email and the configuration is saved to Chrome local storage.

The automation service now matches email inputs on web forms, waits for the corresponding verification email, and follows the magic link without user intervention.

## Supported providers

Out of the box the extension recognises:

- Gmail (`gmail.com` and Google Workspace domains)
- Outlook (`outlook.com`, `hotmail`, `live` domains)
- Yahoo Mail (`yahoo.com`)
- Proton Mail (`proton.me`, `protonmail.com`, `pm.me`)
- iCloud Mail (`icloud.com`, `me.com`, `mac.com`)

Custom domains handled by these providers are supported because detection checks the domain suffix. If your provider is not listed, the continue button remains disabled; open an issue with the domain you need.

## Storage & privacy

- Configuration data lives in `chrome.storage.local` under the key `emailProviderConfig`
- Stored fields include the email address, provider ID, and a flag indicating the setup completed successfully
- No remote services are contacted; automation uses your authenticated Chrome session to read verification emails via the provider's web UI

## Editing or clearing the configuration

- Reopen the welcome surface from the extension menu to change the email address
- Use the `Reset configuration` action on the welcome screen to wipe the stored data
- Clearing Chrome site data for the provider or signing out of the webmail tab also revokes access, and the extension will prompt you to reconnect

## Troubleshooting tips

- Ensure the provider tab remains signed in; background monitoring relies on active cookies
- If magic links are not detected, check the extension's background page (`chrome://extensions/` → Inspect views) for logs
- For Gmail and Outlook, two-factor prompts may require manual approval the first time—complete them once and re-run the automation
