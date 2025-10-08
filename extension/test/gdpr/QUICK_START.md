# GDPR Test Suite - Quick Start Guide

## 🚀 Start Server

```bash
cd extension/test/gdpr
./start-test.sh
```

Opens http://localhost:3500

## 🎯 5 Test Scenarios

Use the **Scenario** dropdown in the nav bar:

### 1. Normal (Default) ✅
**Standard first-visit behavior**
- Homepage: Shows banner (no cookies)
- Story page: No banner (cookies exist)
- **Tests:** Smart detection works

### 2. Delayed 🕐
**Banner on 2nd page, not first**
- Homepage: No banner
- Story page: Shows banner (no cookies)
- **Tests:** Non-root page detection

### 3. Never ⛔
**No GDPR banner**
- All pages: No banner
- **Tests:** Graceful handling of absence

### 4. Persistent 🔄 (IMPORTANT!)
**Buggy site - always shows**
- All pages: Banner always shows
- Auto-modal: Dismisses ONCE, then skips
- **Tests:** No infinite loops!

### 5. Random 🎲
**Chaos testing**
- Each page: 50% chance of banner
- **Tests:** Robustness

## 🧪 Quick Test (30 seconds)

### Test 1: Normal Scenario
```bash
1. Clear cookies
2. Visit / → Banner shows
3. Click "Accept All" (or let auto-modal do it)
4. Visit /story → No banner ✅
5. Debug shows: "Consent already given"
```

### Test 2: Persistent Scenario (Proves Smart Detection!)
```bash
1. Select "Persistent" from dropdown
2. Clear cookies
3. Visit / → Banner shows → Accept
4. Visit /story → Banner shows (bug!)
5. Watch: Auto-modal SKIPS! ✨
6. Debug shows: "Banner skipped (consent given)"
```

**Why this matters:**
- Banner still visible (site bug)
- But auto-modal WON'T dismiss it again
- Proves `onlyFirstVisit: true` prevents infinite loops

## 📊 What to Watch

### Debug Console (top-right)
```
Scenario: persistent
Page: /story
Cookies exist: true ← Key!
GDPR consent: accepted
Showing banner (persistent mode)
```

### Browser Console (F12)
```
[Auto Modal] Skipping GDPR/cookie modal (not first visit)
```

## ✅ Success Checklist

- [ ] Normal: Dismiss once, skip after
- [ ] Delayed: No banner on /, shows on /story
- [ ] Never: No errors, no banner
- [ ] Persistent: Dismiss once, skip after (even though banner shows)
- [ ] Random: Handles chaos

## 🎓 Key Learnings

1. **Smart detection** only checks when `document.cookie.length === 0`
2. **First-visit logic** prevents infinite dismiss loops
3. **Persistent scenario** proves it works with buggy sites
4. **Different scenarios** test real-world edge cases

## 📚 More Info

- Full docs: [README.md](./README.md)
- Scenario details: [SCENARIOS.md](./SCENARIOS.md)
- Visual demo: [DEMO.md](./DEMO.md)

---

**Test time: 2-5 minutes per scenario** ⏱️

**Total test suite: ~15 minutes** 🎉
