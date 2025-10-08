# GDPR Test Scenarios

The test server now supports **5 different scenarios** to test various real-world GDPR banner behaviors.

## 🎯 Available Scenarios

### 1️⃣ **Normal** (Default)
**Standard first-visit behavior**

- ✅ Shows banner when no consent cookie exists
- ❌ Hides banner when consent cookie exists
- 🎯 **Tests:** Standard smart detection

**Flow:**
```
Visit / → No cookies → Banner shows → Accept → Cookies set
Visit /story → Cookies exist → Banner skipped ✨
```

**Auto-modal behavior:**
- First visit: Detects and dismisses
- Second visit: Skips check (isLikelyFirstVisit = false)

---

### 2️⃣ **Delayed**
**Banner appears on second page, not first**

Some sites delay GDPR banners until user navigates deeper.

- ❌ Homepage (/) → No banner
- ✅ Story page (/story) → Banner shows (if no consent)
- 🎯 **Tests:** Banner on non-root pages, smart detection across navigation

**Flow:**
```
Visit / → No cookies → Banner SKIPPED (delayed mode)
Visit /story → No cookies → Banner SHOWS → Accept → Cookies set
Visit / again → Cookies exist → Banner SKIPPED ✨
```

**Auto-modal behavior:**
- Homepage: No modal to detect
- Story page (first visit): Detects and dismisses
- Future pages: Skips check (cookies exist)

**Why this matters:** Tests that auto-modal correctly handles banners that don't appear on root path.

---

### 3️⃣ **Never**
**Site without GDPR banner**

Some sites don't show cookie banners (non-EU, essential cookies only, etc.)

- ❌ Never shows banner
- 🎯 **Tests:** Auto-modal handles absence gracefully

**Flow:**
```
Visit / → No banner
Visit /story → No banner
Continue browsing → No banner ever
```

**Auto-modal behavior:**
- All pages: No modal detected
- No wasted cycles
- Graceful handling of missing modals

**Why this matters:** Ensures auto-modal doesn't break or slow down sites without GDPR banners.

---

### 4️⃣ **Persistent** (Buggy Behavior)
**Always shows, even with consent**

Simulates buggy sites that re-show GDPR banner despite consent.

- ✅ **Always** shows banner, even if cookies exist
- 🎯 **Tests:** Auto-modal handles repeated dismissals

**Flow:**
```
Visit / → Banner shows → Accept → Cookies set
Visit /story → Banner shows AGAIN (bug!) → Auto-dismiss
Visit / → Banner shows AGAIN (bug!) → Auto-dismiss
...continues forever
```

**Auto-modal behavior:**
- First visit: `isLikelyFirstVisit = true` → Detects and dismisses
- Second visit: `isLikelyFirstVisit = false` → SKIPS (cookies exist)
- Banner still shows (buggy site), but auto-modal correctly skips!

**Why this matters:**
- Demonstrates that `onlyFirstVisit: true` is **smart**
- Even if site is buggy and shows banner, auto-modal won't keep dismissing
- Respects that user already accepted cookies
- Prevents infinite dismiss loops

**Expected result:**
- Auto-modal dismisses ONCE (first visit)
- Future pages: Banner shows (site bug), but auto-modal skips
- User sees banner but it's not auto-dismissed again

---

### 5️⃣ **Random**
**Unpredictable behavior**

Banner randomly shows/hides on each page (50% chance).

- 🎲 Random: 50% chance of showing on each page
- 🎯 **Tests:** Auto-modal handles unpredictable patterns

**Flow:**
```
Visit / → Random (maybe shows, maybe doesn't)
Visit /story → Random (maybe shows, maybe doesn't)
Visit / → Random (maybe shows, maybe doesn't)
```

**Auto-modal behavior:**
- If banner appears: Detects and dismisses
- After accepting: `isLikelyFirstVisit = false` → Skips future checks
- Banner might still randomly appear (site behavior), but auto-modal skips

**Why this matters:**
- Tests detection robustness
- Ensures auto-modal handles edge cases
- Proves smart detection works even with chaos

---

## 🔧 How to Switch Scenarios

### In Browser UI
Use the **Scenario** dropdown in the navigation bar:

```
[ Scenario: Normal (first visit only) ▼ ]
```

Options:
- Normal (first visit only)
- Delayed (show on 2nd page)
- Never (no banner)
- Persistent (always show)
- Random (50% chance)

### Programmatically
```javascript
localStorage.setItem('gdpr_test_scenario', 'delayed');
location.reload();
```

### Via Console
```javascript
setScenario('persistent');
```

---

## 📊 Scenario Comparison

| Scenario | Homepage | Story Page | After Accept | Auto-Modal Behavior |
|----------|----------|------------|--------------|---------------------|
| **Normal** | Shows (no consent) | Shows (no consent) | Skipped | ✅ Detect → Dismiss → Skip |
| **Delayed** | Skipped | Shows (no consent) | Skipped | ✅ Skip → Detect → Skip |
| **Never** | Never | Never | Never | ✅ No detection needed |
| **Persistent** | Always shows | Always shows | Always shows | ✅ Detect once → Skip rest |
| **Random** | 50% chance | 50% chance | 50% chance | ✅ Detect if shown → Skip after accept |

---

## 🧪 Test Cases

### Test 1: Normal Scenario (Default)
```bash
1. Set scenario: "Normal"
2. Clear cookies
3. Visit / → Banner shows
4. Auto-modal dismisses
5. Visit /story → Banner skipped ✅
6. Debug shows: "Consent already given - banner skipped"
```

**Expected:** Smart detection works perfectly.

---

### Test 2: Delayed Scenario
```bash
1. Set scenario: "Delayed"
2. Clear cookies
3. Visit / → No banner
4. Visit /story → Banner shows
5. Auto-modal dismisses
6. Visit / → No banner ✅
7. Debug shows: "Consent already given - banner skipped"
```

**Expected:** Auto-modal handles delayed banners correctly.

---

### Test 3: Never Scenario
```bash
1. Set scenario: "Never"
2. Visit / → No banner
3. Visit /story → No banner
4. No auto-modal detection ✅
```

**Expected:** No errors, graceful handling.

---

### Test 4: Persistent Scenario (Important!)
```bash
1. Set scenario: "Persistent"
2. Clear cookies
3. Visit / → Banner shows
4. Auto-modal dismisses → Cookies set
5. Visit /story → Banner shows (bug!)
6. Auto-modal SKIPS (cookies exist) ✅
7. Banner remains visible (expected)
8. Debug shows: "Banner skipped (consent given)"
```

**Expected:**
- Auto-modal dismisses ONCE
- Future pages: Banner shows but NOT auto-dismissed
- Proves smart detection respects previous consent

---

### Test 5: Random Scenario
```bash
1. Set scenario: "Random"
2. Clear cookies
3. Visit / → Random chance
4. If banner shows → Auto-modal dismisses
5. Visit /story multiple times
6. Banner randomly appears/disappears
7. Auto-modal only dismisses on first consent ✅
```

**Expected:** Auto-modal handles chaos gracefully.

---

## 💡 Why These Scenarios Matter

### Real-World Patterns

1. **Normal**: 90% of sites (BBC, Guardian, NY Times)
2. **Delayed**: Some news sites, e-commerce (Amazon)
3. **Never**: Tech blogs, US-only sites
4. **Persistent**: Buggy sites, poorly implemented GDPR
5. **Random**: Edge case testing, chaos engineering

### What We're Testing

| Scenario | Tests |
|----------|-------|
| Normal | ✅ Standard smart detection |
| Delayed | ✅ Non-root page detection |
| Never | ✅ Graceful absence handling |
| Persistent | ✅ **No infinite loops** 🔥 |
| Random | ✅ Robustness under uncertainty |

### The Persistent Scenario is Key! 🔑

This scenario proves that `onlyFirstVisit: true` **prevents infinite dismiss loops**:

**Without smart detection:**
```
Visit 1: Dismiss → Cookies set
Visit 2: Dismiss again → Wasted
Visit 3: Dismiss again → Wasted
Visit 4: Dismiss again → Wasted
...forever
```

**With smart detection (`onlyFirstVisit: true`):**
```
Visit 1: Dismiss → Cookies set
Visit 2: SKIP (cookies exist) ✅
Visit 3: SKIP (cookies exist) ✅
Visit 4: SKIP (cookies exist) ✅
...smart skip forever
```

---

## 🎯 Debug Console Output Examples

### Normal Scenario
```
Scenario: normal
Page: /
Cookies exist: false
GDPR consent: none
Showing banner (no consent)
[User clicks Accept All]
Cookie set: gdpr_consent=accepted
GDPR banner hidden
```

### Delayed Scenario (Homepage)
```
Scenario: delayed
Page: /
Cookies exist: false
GDPR consent: none
Banner skipped (delayed (homepage skip))
```

### Delayed Scenario (Story Page)
```
Scenario: delayed
Page: /story
Cookies exist: false
GDPR consent: none
Showing banner (delayed mode)
```

### Persistent Scenario (Second Visit)
```
Scenario: persistent
Page: /story
Cookies exist: true
GDPR consent: accepted
Showing banner (persistent mode)
[Banner shows but auto-modal SKIPS]
```

### Never Scenario
```
Scenario: never
Page: /
Cookies exist: false
GDPR consent: none
Banner skipped (never mode)
```

---

## 🏆 Success Criteria

Test each scenario and verify:

- [ ] Normal: Dismiss once, skip after
- [ ] Delayed: No banner on /, shows on /story
- [ ] Never: No banner ever, no errors
- [ ] Persistent: Dismiss once, skip after (even though banner shows)
- [ ] Random: Handles unpredictability
- [ ] All scenarios: No infinite loops
- [ ] All scenarios: Smart detection works

---

**The test suite is now complete with realistic edge cases!** 🎉
