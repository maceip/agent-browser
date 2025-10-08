# GDPR Cookie Banner Test Suite

A complete test environment for demonstrating smart GDPR/cookie modal detection and dismissal.

## 🎯 What This Tests

This test suite demonstrates the **smart first-visit detection** that prevents unnecessary modal checks:

1. **First Visit** → No cookies → Banner appears → Auto-detect & dismiss → Cookies set
2. **Second Visit** → Cookies exist → Banner skipped → Auto-modal SKIPS check ✨

## 🏗️ Architecture

- **React Media Site**: Realistic news site with hero, articles, and navigation
- **GDPR Banner**: Cookie consent modal with backdrop and "Accept All" button
- **Cookie Logic**: Checks for consent cookie before showing banner
- **Debug Console**: Real-time logging of detection status

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd extension/test/gdpr
bun install
```

### 2. Build Extension

```bash
cd ../../..  # Back to agent-browser root
bun run --cwd extension build
```

### 3. Start Test Server

```bash
cd extension/test/gdpr
bun run dev
```

Server starts at: http://localhost:3500

### 4. Run Automated Test

In a new terminal:

```bash
cd extension/test/gdpr
bun run test
```

This launches Chrome with the extension and test site loaded.

## 🎭 Test Scenarios

The test suite now supports **5 different scenarios** to test various GDPR behaviors:

1. **Normal** (Default) - Standard first-visit behavior
2. **Delayed** - Banner shows on 2nd page, not first
3. **Never** - No banner (simulates non-EU sites)
4. **Persistent** - Always shows, even with consent (buggy sites)
5. **Random** - 50% chance on each page (chaos testing)

**Change scenario:** Use dropdown in navigation bar

See **[SCENARIOS.md](./SCENARIOS.md)** for detailed documentation.

---

## 🧪 Manual Testing

### Test Flow (Normal Scenario)

1. **Homepage (First Visit)**
   ```
   Visit: http://localhost:3500/

   Expected:
   ✓ Scenario: "normal"
   ✓ GDPR banner appears after 500ms
   ✓ Debug shows: "No consent found - showing banner"
   ✓ Auto-modal detects banner
   ✓ Clicks "Accept All" (or you can click manually)
   ✓ Cookies set: gdpr_consent=accepted
   ✓ Banner dismisses
   ```

2. **Story Page (Second Visit)**
   ```
   Click: "Featured Story" in nav
   Visit: http://localhost:3500/story

   Expected:
   ✓ Debug shows: "Cookies exist: true"
   ✓ Debug shows: "GDPR consent: accepted"
   ✓ Debug shows: "Consent already given - banner skipped"
   ✓ NO banner appears
   ✓ Auto-modal SKIPS detection (smart!)
   ```

3. **Reset & Repeat**
   ```
   Click: "Clear Cookies (Reset)" in nav

   Expected:
   ✓ All cookies cleared
   ✓ Page reloads
   ✓ Banner appears again (no cookies)
   ✓ Can repeat test
   ```

### Test Different Scenarios

Try each scenario to test edge cases:

**Delayed Scenario:**
```
1. Select "Delayed" from dropdown
2. Visit / → No banner
3. Visit /story → Banner shows
4. Accept → Cookies set
5. Visit / → No banner (cookies exist)
```

**Persistent Scenario:**
```
1. Select "Persistent" from dropdown
2. Visit / → Banner shows → Accept
3. Visit /story → Banner STILL shows (bug!)
4. Auto-modal SKIPS (smart! cookies exist)
5. Proves no infinite dismiss loops ✨
```

See **[SCENARIOS.md](./SCENARIOS.md)** for all test cases.

## 📊 Debug Console

The top-right debug console shows real-time status:

- 🔵 **Blue (Info)**: Page load, cookie status
- 🟢 **Green (Success)**: Banner hidden, cookies set
- 🟡 **Yellow (Warning)**: Banner shown, cookies cleared

Example output:
```
17:23:45: Page: /
17:23:45: Cookies exist: false
17:23:45: GDPR consent: none
17:23:45: No consent found - showing banner
17:23:50: Cookie set: gdpr_consent=accepted
17:23:50: GDPR banner hidden
```

## 🔍 What to Observe

### First Visit (No Cookies)
- ✅ `document.cookie.length === 0`
- ✅ `isLikelyFirstVisit()` returns `true`
- ✅ Auto-modal handler checks for GDPR modals
- ✅ Detects banner and clicks "Accept All"
- ✅ Cookies are set

### Second Visit (Cookies Exist)
- ✅ `document.cookie.length > 0`
- ✅ `isLikelyFirstVisit()` returns `false`
- ✅ Auto-modal handler **SKIPS** GDPR check
- ✅ No banner appears (site already knows consent)
- ✅ No unnecessary detection or clicks

## 🎨 Site Features

### Homepage (/)
- Hero section with breaking news
- Article grid with 3 cards
- Navigation bar
- GDPR banner (conditionally shown)

### Story Page (/story)
- Full article layout
- Featured story with sections
- Quote block
- Back to homepage link

## 🛠️ Files

```
extension/test/gdpr/
├── README.md              # This file
├── package.json           # Dependencies
├── server.ts              # Bun server (HMR enabled)
├── index.html             # Main HTML (both routes)
├── app.tsx                # React app (routing)
├── test-automation.ts     # Automated test launcher
```

## 🔧 Configuration

### Server Port
Default: `3500`

Change in `server.ts`:
```typescript
const PORT = 3500;
```

### Banner Delay
Default: `500ms`

Change in `index.html`:
```javascript
setTimeout(showBanner, 500);
```

### Cookie Expiration
Default: `365 days`

Change in `index.html`:
```javascript
function setCookie(name, value, days = 365) { ... }
```

## 🐛 Troubleshooting

### Banner Not Appearing
- Check browser console for errors
- Verify cookies are cleared (check DevTools → Application → Cookies)
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

### Auto-Modal Not Working
- Verify extension is loaded (check `chrome://extensions`)
- Check extension is enabled
- Open DevTools console for `[Auto Modal]` logs
- Ensure `onlyFirstVisit: true` is set in auto-modal config

### Server Won't Start
- Check port 3500 is not in use: `lsof -i :3500`
- Kill process if needed: `kill -9 <PID>`
- Try different port in `server.ts`

## 📝 Notes

### Smart Detection Logic

The auto-modal handler uses this logic for GDPR/cookie modals:

```typescript
// In modal-detector.ts
isLikelyFirstVisit() {
  const hasCookies = document.cookie.length > 0;

  if (hasCookies) return false; // Skip check!

  const isRootPath = pathname === '/';
  const isNewSession = !referrer || differentOrigin;

  return !hasCookies && (isRootPath || isNewSession);
}

// In auto-modal-handler.ts
if (config.onlyFirstVisit &&
    (modal.type === 'gdpr' || modal.type === 'cookie-consent')) {

  if (!modal.metadata.isFirstVisit) {
    console.log('Skipping GDPR modal (not first visit)');
    return; // Smart skip!
  }
}
```

### Why This Matters

1. **Performance**: No unnecessary DOM queries on pages with cookies
2. **Accuracy**: Respects user's previous consent decision
3. **UX**: No flickering or double-dismissals
4. **Efficiency**: Saves CPU cycles by skipping checks

## 🎓 Learning Points

This test demonstrates:

- ✅ Cookie-based first-visit detection
- ✅ Smart modal dismissal logic
- ✅ Origin-aware consent tracking
- ✅ Efficient detection skipping
- ✅ Real-world GDPR implementation patterns

## 🚦 Success Criteria

The test is successful when:

1. ✅ First visit shows banner
2. ✅ Banner is detected and dismissed
3. ✅ Cookies are set correctly
4. ✅ Second visit does NOT show banner
5. ✅ Auto-modal logs show "Skipping GDPR modal"
6. ✅ Debug console confirms cookie existence
7. ✅ Reset test works (clear cookies)

---

**Happy Testing!** 🎉

For issues or questions, check the main auto-modal documentation at `/AUTO_MODAL_SYSTEM.md`
