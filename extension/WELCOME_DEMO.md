# Welcome Page Demo Guide

## Quick Start

### Load Extension for First Time

1. **Open Chrome/Edge**
   ```
   chrome://extensions
   ```

2. **Enable Developer Mode** (top right)

3. **Load Unpacked**
   - Select: `/Users/rpm/agent-browser/extension/public`

4. **Welcome Page Opens Automatically** 🎉

---

## Visual Walkthrough

### Landing Animation

When welcome page loads, you'll see:

```
    ┌─────────────────────────┐
    │                         │
    │    🤖 Floating Avatar   │  ← Animated float + glow
    │    (pixel art style)    │
    │                         │
    └─────────────────────────┘

  ✨ Welcome to Agent Browser ✨
     (glowing text animation)

   Enable magic link automation
      by connecting your email
```

**Animations Active:**
- Avatar floats up/down (6s loop)
- Pixel glow pulses (2s loop)
- Text shadow glow (2s loop)
- Particles floating in background
- Gradient shift in background

---

### Step 1: Email Input

```
╔════════════════════════════════════╗
║  [01] Enter Your Email             ║
║                                    ║
║  ┌──────────────────────────────┐ ║
║  │ user@gmail.com      📧 Gmail │ ║ ← Icon appears on type
║  └──────────────────────────────┘ ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║ ← Animated underline
║                                    ║
║  Detected Provider: GMAIL          ║ ← Auto-detected
║                                    ║
║  ┌──────────────────────────────┐ ║
║  │    Continue  →               │ ║ ← Enabled when valid
║  └──────────────────────────────┘ ║
╚════════════════════════════════════╝
```

**Try These Examples:**

| Type | Result |
|------|--------|
| `user@gmail.com` | ✅ Gmail icon + enabled |
| `work@outlook.com` | ✅ Outlook icon + enabled |
| `me@yahoo.com` | ✅ Yahoo icon + enabled |
| `name@proton.me` | ✅ ProtonMail icon + enabled |
| `invalid@` | ❌ No icon, button disabled |

**Animations:**
- Icon bounces in when detected
- Underline expands on focus
- Provider name pulses
- Continue button glows on hover

---

### Step 2: Authentication

Click Continue → Slides to Step 2:

```
╔════════════════════════════════════╗
║  [02] Authenticate Email Access    ║
║                                    ║
║  We'll open a new tab to Gmail     ║
║  Please sign in to grant access    ║
║                                    ║
║  ┌──────────────────────────────┐ ║
║  │  Open Gmail  ↗               │ ║
║  └──────────────────────────────┘ ║
║                                    ║
║  ┌──────────────────────────────┐ ║
║  │  ← Back                      │ ║
║  └──────────────────────────────┘ ║
╚════════════════════════════════════╝
```

**Click "Open Gmail":**

```
╔════════════════════════════════════╗
║  ⟳ Waiting for authentication...  ║ ← Spinner appears
║                                    ║
║  (New tab opened to Gmail login)   ║
╚════════════════════════════════════╝
```

**In New Tab:**
- Sign in to Gmail normally
- Extension monitors your login
- Detects when you reach inbox

**Auto-Detection:**
- Watches for inbox URL
- Polls for authentication cookies
- Saves session automatically

---

### Step 3: Success

After successful login → Slides to Step 3:

```
╔════════════════════════════════════╗
║  [03] Setup Complete!              ║
║                                    ║
║        ┌─────────┐                 ║
║        │    ✓    │                 ║ ← Pops in with scale animation
║        └─────────┘                 ║
║      (green, glowing)              ║
║                                    ║
║  Email automation is now enabled   ║
║  user@gmail.com                    ║
║                                    ║
║  ┌──────────────────────────────┐ ║
║  │  Start Automating  🚀         │ ║
║  └──────────────────────────────┘ ║
╚════════════════════════════════════╝
```

**Click "Start Automating":**
- Welcome tab closes
- Extension ready to use
- Email provider configured

---

## Color Palette

The design uses colors inspired by the pixel art avatar:

| Color | Usage | Hex |
|-------|-------|-----|
| **Primary Blue** | Buttons, highlights | `#4169e1` |
| **Purple** | Background, shadows | `#8b5cf6` |
| **Gold** | Accents, particles | `#ffd700` |
| **Dark BG** | Main background | `#0a0a0f` |
| **Card BG** | Content cards | `#141420` |
| **Success Green** | Checkmark | `#00ff88` |

---

## Keyboard Navigation

- `Tab` - Navigate between inputs/buttons
- `Enter` - Submit on email input
- `Escape` - (Future: close/back)

---

## Testing Different Providers

### Gmail
```typescript
Type: "test@gmail.com"
Icon: Red/blue/yellow Gmail logo
Opens: https://accounts.google.com/
```

### Outlook
```typescript
Type: "test@outlook.com"
Icon: Blue Outlook logo
Opens: https://login.live.com/
```

### Yahoo
```typescript
Type: "test@yahoo.com"
Icon: Purple Yahoo logo
Opens: https://login.yahoo.com/
```

### ProtonMail
```typescript
Type: "test@proton.me"
Icon: Purple Proton logo
Opens: https://account.proton.me/login
```

### iCloud
```typescript
Type: "test@icloud.com"
Icon: Blue cloud logo
Opens: https://www.icloud.com/
```

---

## Debugging

### Open Developer Console

**On Welcome Page:**
1. Right-click → Inspect
2. Console tab
3. Look for `[Welcome]` logs

**Sample Console Output:**
```
[Welcome] Welcome page initialized
[Welcome] User authenticated - detected inbox URL
[Welcome] Email provider config saved: {email: "user@gmail.com", ...}
[Welcome] Cookies detected: 12
```

### Check Stored Configuration

**Console:**
```javascript
chrome.storage.local.get('emailProviderConfig', (data) => {
  console.log(data.emailProviderConfig);
});
```

**Expected Output:**
```javascript
{
  email: "user@gmail.com",
  provider: "Gmail",
  providerDomain: "gmail.com",
  inboxUrl: "https://mail.google.com/mail/u/0/#inbox",
  cookieDomains: [".google.com", ".gmail.com", ...],
  setupComplete: true,
  setupDate: "2025-10-08T..."
}
```

---

## Re-Running Setup

To test again after completing setup:

1. **Clear Storage:**
   ```javascript
   chrome.storage.local.remove('emailProviderConfig');
   ```

2. **Reload Extension:**
   - Go to `chrome://extensions`
   - Click reload icon ↻

3. **Manually Open Welcome:**
   - Create new tab
   - Navigate to: `chrome-extension://[your-extension-id]/welcome.html`

---

## Performance Notes

- **Initial Load**: ~100ms (HTML + CSS + JS)
- **Animation FPS**: 60fps on modern devices
- **Particle Count**: 30 (adjustable in code)
- **Storage Size**: ~500 bytes per config

---

## Mobile/Responsive

Welcome page is responsive:

**Desktop (> 768px):**
- Full width cards
- Large avatar (200px)
- 2.5rem headings

**Mobile (< 768px):**
- Compressed padding
- Smaller avatar (150px)
- 2rem headings
- Touch-friendly buttons

---

Enjoy the futuristic onboarding experience! 🚀
