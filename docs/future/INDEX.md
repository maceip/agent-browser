# agent-browser Documentation Index

Complete documentation for clean-room MCP-controlled browser automation implementation.

---

## 🚀 Getting Started

**Start here if this is your first time:**

1. **[QUICK_START.md](./QUICK_START.md)** - Zero to working system in 10 minutes
   - Extension key generation
   - Build process
   - Installation steps
   - Verification
   - Common issues

2. **[INSTALLATION.md](./INSTALLATION.md)** - Detailed setup guide (prevents weeks of debugging)
   - Extension ID management (stable across builds)
   - Native messaging host setup
   - Server binary installation
   - Troubleshooting every past issue
   - Automated verification scripts

---

## 📐 Architecture & Design

**Read these to understand the system:**

3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system design
   - Requirements (performance, reliability, stealth)
   - Message flow diagrams
   - Component breakdown
   - What we kept vs removed from webtrans
   - Implementation phases
   - Success criteria

4. **[CONNECTION_PROTOCOL.md](./CONNECTION_PROTOCOL.md)** - WebSocket handshake specification
   - **CRITICAL:** Prevents week of debugging server/client mismatches
   - Exact message format with Zod schemas
   - Handshake sequence (HELLO → HELLO_ACK)
   - Request/response flow
   - Error codes
   - Heartbeat protocol
   - Testing procedures

---

## 🔧 Implementation Guides

**Read these when building specific features:**

5. **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - What to copy from webtrans
   - Files to copy as-is
   - Files to rewrite
   - Files to skip
   - Code examples for new implementations
   - File structure comparison
   - Migration checklist

6. **[PASSKEY_AUTOMATION.md](./PASSKEY_AUTOMATION.md)** - WebAuthn/Passkey support
   - Why critical (30% of modern sites)
   - Architecture (proxy + crypto worker)
   - Complete TypeScript implementation
   - MCP methods
   - Security considerations
   - Testing strategy

7. **[MISSING_FEATURES.md](./MISSING_FEATURES.md)** - Features we might leave behind
   - **CAPTCHA detection** (heuristic + full pipeline)
   - **Session storage** (persistent logins)
   - **Element caching** (performance)
   - Activity logging (V2)
   - Site context analysis (V2)
   - Priority queuing (V2)
   - Feature priority matrix

---

## 📚 Reference

**Quick lookups:**

8. **[README.md](./README.md)** - Project overview
   - Quick start (abbreviated)
   - MCP methods reference
   - Speed vs Stealth modes
   - Project structure
   - Comparison to webtrans

---

## 🎯 Reading Path by Role

### For Implementation Team

**Day 1:**
1. [QUICK_START.md](./QUICK_START.md) - Get it running
2. [INSTALLATION.md](./INSTALLATION.md) - Understand setup automation
3. [CONNECTION_PROTOCOL.md](./CONNECTION_PROTOCOL.md) - Understand message flow

**Day 2-3:**
4. [ARCHITECTURE.md](./ARCHITECTURE.md) - Full system design
5. [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - What to copy/rewrite

**Week 1-4:**
6. [PASSKEY_AUTOMATION.md](./PASSKEY_AUTOMATION.md) - Phase 3
7. [MISSING_FEATURES.md](./MISSING_FEATURES.md) - Phase 2-3 additions

### For Project Managers

**Overview:**
1. [README.md](./README.md) - Project overview
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - Phases and timeline

**Risk mitigation:**
3. [INSTALLATION.md](./INSTALLATION.md) - Setup automation
4. [CONNECTION_PROTOCOL.md](./CONNECTION_PROTOCOL.md) - Protocol spec
5. [MISSING_FEATURES.md](./MISSING_FEATURES.md) - Feature decisions

### For QA/Testing

**Setup:**
1. [QUICK_START.md](./QUICK_START.md) - Installation
2. [INSTALLATION.md](./INSTALLATION.md) - Troubleshooting

**Testing:**
3. [CONNECTION_PROTOCOL.md](./CONNECTION_PROTOCOL.md) - Protocol testing
4. [PASSKEY_AUTOMATION.md](./PASSKEY_AUTOMATION.md) - Passkey testing
5. [MISSING_FEATURES.md](./MISSING_FEATURES.md) - CAPTCHA testing

---

## 📊 Document Stats

| Document | Lines | Purpose | When to Read |
|----------|-------|---------|--------------|
| **README.md** | ~300 | Overview | First time |
| **QUICK_START.md** | ~400 | Setup guide | Before building |
| **INSTALLATION.md** | ~800 | Detailed setup | When debugging setup |
| **ARCHITECTURE.md** | ~500 | System design | Before implementing |
| **CONNECTION_PROTOCOL.md** | ~600 | Message protocol | Before writing client/server |
| **MIGRATION_GUIDE.md** | ~400 | Copy/rewrite guide | During implementation |
| **PASSKEY_AUTOMATION.md** | ~650 | WebAuthn feature | Phase 3 |
| **MISSING_FEATURES.md** | ~500 | Feature analysis | Phase 2-3 planning |

**Total:** ~4,150 lines of documentation

---

## 🔍 Quick Lookups

### "How do I...?"

**...set up the project?**
→ [QUICK_START.md](./QUICK_START.md)

**...fix extension ID mismatch?**
→ [INSTALLATION.md#extension-id-mismatch](./INSTALLATION.md#extension-id-mismatch)

**...understand the handshake?**
→ [CONNECTION_PROTOCOL.md#handshake-sequence](./CONNECTION_PROTOCOL.md#handshake-sequence)

**...implement passkey login?**
→ [PASSKEY_AUTOMATION.md](./PASSKEY_AUTOMATION.md)

**...detect CAPTCHAs?**
→ [MISSING_FEATURES.md#captcha-detection](./MISSING_FEATURES.md#captcha-detection)

**...know what to copy from webtrans?**
→ [MIGRATION_GUIDE.md#copy-as-is](./MIGRATION_GUIDE.md#copy-as-is)

**...validate messages?**
→ [CONNECTION_PROTOCOL.md#message-format](./CONNECTION_PROTOCOL.md#message-format)

**...test the connection?**
→ [CONNECTION_PROTOCOL.md#testing-the-protocol](./CONNECTION_PROTOCOL.md#testing-the-protocol)

---

## 🎯 Critical Prevention Points

These docs specifically prevent past pain:

### **Weeks of Extension ID Debugging** ❌
**Prevented by:** [INSTALLATION.md](./INSTALLATION.md)
- Stable key generation
- Auto-computed ID
- Verification scripts

### **Week of Connection Protocol Debugging** ❌
**Prevented by:** [CONNECTION_PROTOCOL.md](./CONNECTION_PROTOCOL.md)
- Exact message format
- Zod validation
- Test procedures

### **Overlooking Critical Features** ❌
**Prevented by:** [MISSING_FEATURES.md](./MISSING_FEATURES.md)
- Deep search of old implementation
- Feature priority matrix
- Implementation recommendations

---

## 🏗️ Implementation Timeline

Based on documentation:

**Week 1: Core Plumbing**
- Follow [QUICK_START.md](./QUICK_START.md) for setup
- Implement WebSocket per [CONNECTION_PROTOCOL.md](./CONNECTION_PROTOCOL.md)
- Copy automation handlers per [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

**Week 2: Reliability + Storage**
- Add session storage per [MISSING_FEATURES.md#session-storage](./MISSING_FEATURES.md#session-storage)
- Add element caching per [MISSING_FEATURES.md#element-caching](./MISSING_FEATURES.md#element-caching)
- Follow [ARCHITECTURE.md#phase-2](./ARCHITECTURE.md#phase-2)

**Week 3: Stealth + Passkeys + CAPTCHA**
- Implement passkeys per [PASSKEY_AUTOMATION.md](./PASSKEY_AUTOMATION.md)
- Add CAPTCHA detection per [MISSING_FEATURES.md#captcha-detection](./MISSING_FEATURES.md#captcha-detection)
- Follow [ARCHITECTURE.md#phase-3](./ARCHITECTURE.md#phase-3)

**Week 4: Polish**
- E2E tests per [CONNECTION_PROTOCOL.md#testing](./CONNECTION_PROTOCOL.md#testing)
- Badge UI
- Documentation

---

## 📝 Documentation Completeness

✅ **Setup:** Fully documented with automation
✅ **Architecture:** Complete system design
✅ **Protocol:** Exact message specification
✅ **Migration:** File-by-file guide
✅ **Features:** Deep analysis of what to include
✅ **Troubleshooting:** Every past issue documented

**Missing:** None - all bases covered

---

## 🚨 Before You Start

**Required reading:**
1. [QUICK_START.md](./QUICK_START.md)
2. [INSTALLATION.md](./INSTALLATION.md)
3. [CONNECTION_PROTOCOL.md](./CONNECTION_PROTOCOL.md)

**Skip at your own risk:**
- Extension ID will drift
- Connection will break mysteriously
- Critical features will be missed

**Time investment:** 2-3 hours to read thoroughly
**Time saved:** Weeks of debugging

---

## 📞 Help

If you're stuck:

1. **Check the index above** for relevant doc
2. **Search docs** for your error message
3. **Run verification:** `./scripts/verify-installation.sh`
4. **Check protocol:** Is message format correct?
5. **Review past issues:** Likely documented in INSTALLATION.md

---

## 🎉 Success Criteria

You know the docs worked if:

✅ Setup took <30 minutes
✅ Extension ID stable across rebuilds
✅ NMH connection works first try
✅ WebSocket authenticates correctly
✅ No "week of debugging" experiences
✅ All team members on same page

**If any of these failed, docs need improvement** - please update!
