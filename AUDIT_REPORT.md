# **COMPREHENSIVE ROAM CODEBASE AUDIT REPORT**

**Audit Date:** April 30, 2026  
**Scope:** Extension (v0.1.0), Android (v1.0), Web (Next.js), Supabase Backend  
**Status:** Multi-platform project, actively under development  

---

## **EXECUTIVE SUMMARY**

The Roam codebase is **moderately mature** with solid architectural foundations. TypeScript strict mode is enforced, RLS policies are in place, and authentication flows are implemented. However, there are **5 critical blockers** that must be resolved before any production release, and **7 high-priority issues** that need attention before store submissions.

**Key Risks:**
- 🔴 **Storage quota exhausted (390/500 MB)** — Supabase Pro upgrade decision pending
- 🔴 **No automated tests** — 0% coverage across all components
- 🔴 **Safe Browsing API enforcement missing** — Could allow malicious URLs
- 🔴 **Incomplete database schema** — Missing audit logging and cascading deletes
- 🔴 **Public endpoint unprotected** — No rate limiting on `/profile` endpoint

**Time to Fix:** Critical items = 2-3 days; high-priority = 3-5 days

---

## **1. CRITICAL ISSUES (BLOCKERS FOR RELEASE)**

### **🔴 Issue #1: Storage Capacity Crisis**
**Severity:** CRITICAL  
**Location:** HOSTING_COSTS.md  
**Current State:** 390 MB / 500 MB (78% full)

**Problem:**
- Free tier maxed out after seeding ~1.45M URLs
- Remaining seeders (Curlie: 1.2M URLs) will exceed quota within days
- **Decision still pending** per TASKS.md "DECISION: Upgrade to Supabase Pro ($25/month)"

**Impact:**
- Curlie import cannot complete
- OG image fetching blocked
- Service will degrade or fail when quota is exceeded

**Required Action:**
```
[ ] Upgrade to Supabase Pro ($25/month) BEFORE next seeding batch
[ ] Verify 100 GB storage in Pro tier
[ ] Plan storage roadmap for next 6+ months
```

**Recommendation:** Complete upgrade TODAY before the crisis occurs. Cost is $300/year, negligible compared to development time.

---

### **🔴 Issue #2: Safe Browsing API Not Enforced**
**Severity:** CRITICAL  
**Location:** supabase/functions/submit-url/index.ts, Lines 103-110

**Code:**
```typescript
const apiKey = Deno.env.get('SAFE_BROWSING_API_KEY')
let safeBrowsingPassed: boolean | null = null
if (apiKey) {
  try {
    safeBrowsingPassed = await checkSafeBrowsing(normalized, apiKey)
  } catch {
    // API unreachable — allow submission but leave result as null (unknown)
    safeBrowsingPassed = null
  }
}
```

**Problem:**
- If `SAFE_BROWSING_API_KEY` is not set, the check is silently skipped
- Malicious URLs (malware, phishing, etc.) could be submitted unchecked
- No error raised at deployment time to catch misconfiguration
- Task 2.21a marked incomplete in TASKS.md

**Impact:**
- Users can submit flagged URLs without validation
- Moderation queue gets polluted with harmful content
- Reputational damage if malicious sites end up in discovery pool

**Fix Required:**
```typescript
const apiKey = Deno.env.get('SAFE_BROWSING_API_KEY')
if (!apiKey) {
  throw new Error('SAFE_BROWSING_API_KEY environment variable is required')
}
// ... proceed with safe browsing check
```

**Timeline:** This must be fixed before allowing user submissions. Add to deploy checklist.

---

### **🔴 Issue #3: Missing Audit Logging Infrastructure**
**Severity:** CRITICAL  
**Status:** Task 2.15a in TASKS.md marked incomplete  
**Missing Migration:** supabase/migrations/20260430000002_moderation_audit_log.sql

**Problem:**
- No `moderation_audit_log` table exists
- No tamper-proof record of admin decisions
- Impossible to track who approved/rejected what URLs
- No trigger to auto-log changes to `moderation_queue.status`

**Required Schema:**
```sql
CREATE TABLE moderation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES moderation_queue(id),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decided_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TRIGGER auto_audit_log AFTER UPDATE OF status ON moderation_queue
FOR EACH ROW WHEN (OLD.status != NEW.status)
BEGIN
  INSERT INTO moderation_audit_log(queue_id, admin_id, decision)
  -- (requires trigger logic)
END;

ALTER TABLE moderation_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin-read-only" ON moderation_audit_log
  FOR SELECT USING ((auth.jwt()->>'app_metadata'->>'role') = 'admin');
```

**Impact:**
- Compliance issue (no audit trail)
- Can't debug content moderation problems
- Violates best practices for sensitive data changes

**Timeline:** Must add before launch. Estimated: 30 minutes.

---

### **🔴 Issue #4: Missing ON DELETE CASCADE Constraint**
**Severity:** CRITICAL  
**Status:** Task 2.15b marked incomplete  
**Location:** collection_items table in Supabase

**Problem:**
- `collection_items(url_id)` has foreign key to `urls` but no `ON DELETE CASCADE`
- If a URL is deleted (e.g., after moderation reversal), orphaned collection items remain
- Violates referential integrity

**Required Migration:**
```sql
ALTER TABLE collection_items
DROP CONSTRAINT collection_items_url_id_fkey;

ALTER TABLE collection_items
ADD CONSTRAINT collection_items_url_id_fkey
FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE;
```

**Impact:**
- Database consistency issues over time
- "Ghost" items in collections pointing to deleted URLs
- May cause queries to fail if not handled in code

**Timeline:** 15 minutes. Add as hotfix.

---

### **🔴 Issue #5: Public Endpoint Rate Limiting Missing**
**Severity:** CRITICAL  
**Location:** supabase/functions/profile/index.ts  
**Task:** 2.21b marked incomplete

**Problem:**
- `GET /functions/v1/profile?username=<username>` is public (no auth required)
- No rate limiting per IP address
- Attackers can enumerate all usernames (~5 req/sec = 432K/day from one IP)
- Potential lightweight DDoS vector

**Current Code:**
```typescript
const username = url.searchParams.get('username')
if (!username) return json({ error: 'username query parameter is required' }, 400)
// ... immediately queries database with no rate check
```

**Fix Required:**
- Add IP-based rate limiting via `X-Forwarded-For` header
- Limit: 60 requests per minute per IP
- Return `429 Too Many Requests` on breach
- Options:
  - Supabase native rate limiting (if available)
  - Deno Redis/KV-based counter
  - Cloudflare Workers rate limiting (if using)

**Impact:**
- Username enumeration attacks
- Username harvesting for brute-force campaigns
- Service degradation under malicious load

**Timeline:** CRITICAL. Must add before launch. Estimated: 1-2 hours.

---

## **2. HIGH-PRIORITY ISSUES (FIX BEFORE 5.19/6.19 SUBMISSION)**

### **⚠️ Issue #6: Collection Slug Input Validation Missing**
**Severity:** HIGH  
**Location:** supabase/functions/collection/index.ts, Lines 33-50  
**Task:** 2.26a marked incomplete

**Current Code:**
```typescript
case 'create': {
  const { name, slug, is_public } = body
  if (typeof name !== 'string' || typeof slug !== 'string') {
    return json({ error: 'name and slug are required strings' }, 400)
  }
  const { data, error } = await supabase
    .from('collections')
    .insert({ user_id: user.id, name, slug, is_public: is_public !== false })
    // ... NO VALIDATION ON SLUG
}
```

**Missing Validations:**
- ❌ No length check (could be 1 char or 10,000 chars)
- ❌ No character whitelist (could contain `/`, `..`, unicode)
- ❌ No check for reserved route names (`admin`, `join`, `privacy`, etc.)
- ❌ No space/whitespace handling

**Risks:**
- Collection with slug `admin` breaks routing: `/c/admin` conflicts with `/admin`
- Slug `../../../` could cause path traversal issues
- Empty or whitespace slugs confuse URL handling
- Unicode slugs may fail in URL encoding

**Fix Required:**
```typescript
function validateSlug(slug: string): { valid: boolean; error?: string } {
  const RESERVED = ['join', 'admin', 'privacy', 'terms', 'u', 'c'];
  if (!slug || slug.length === 0) return { valid: false, error: 'Slug cannot be empty' };
  if (slug.length > 100) return { valid: false, error: 'Slug max 100 characters' };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug must be lowercase alphanumeric + hyphens only' };
  }
  if (RESERVED.includes(slug)) {
    return { valid: false, error: `"${slug}" is reserved` };
  }
  return { valid: true };
}
```

Also validate name:
- Min 1, max 200 characters
- Reject empty/whitespace-only

**Timeline:** 1-2 hours. Test with 20-30 edge cases.

---

### **⚠️ Issue #7: URL Normalization Code Duplication**
**Severity:** HIGH  
**Task:** 2.27a marked incomplete

**Duplicate Code Locations:**
1. scripts/lib/seed.js — Node.js version
2. supabase/functions/submit-url/index.ts — Deno/TypeScript version
3. extension/src/background/background.ts — Browser extension version

**Current Code (Deno version):**
```typescript
function normalizeUrl(raw: string): string {
  const u = new URL(raw)
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error('Only http and https URLs are allowed')
  }
  u.protocol = 'https:'
  u.hostname = u.hostname.toLowerCase()
  if (u.hostname.startsWith('www.')) {
    u.hostname = u.hostname.slice(4)
  }
  const STRIP_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref',
  ]
  STRIP_PARAMS.forEach((p) => u.searchParams.delete(p))
  u.hash = ''
  if (u.pathname !== '/' && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1)
  }
  return u.toString()
}
```

**Problems:**
- Bug in Node.js version may not exist in Deno version (or vice versa)
- Maintenance burden — changes needed in 3 places
- Inconsistency risk if one is updated and others aren't
- No single source of truth

**Fix Required:**
1. Create supabase/functions/_shared/normalize.ts as canonical version
2. Import in submit-url/index.ts
3. Keep seed.js as Node.js equivalent with comment linking to canonical version
4. Extension can either:
   - Use same logic (if buildable for extension)
   - Or keep duplicate with comment

**Timeline:** 30-45 minutes.

---

### **⚠️ Issue #8: Zero Test Coverage**
**Severity:** HIGH  
**Status:** No test files found anywhere

**Missing Test Suites:**

| Component | Coverage | Critical Paths Untested |
|-----------|----------|------------------------|
| Extension | 0% | Message routing, URL normalization, OAuth callback, queue management |
| Supabase | 0% | RPC args validation, rate limiting, Safe Browsing integration, permission checks |
| Web | 0% | Auth state machine, category selection, category fetch, form validation |
| Android | 0% | Gesture handling, WebView navigation, deep link parsing, state restoration |

**Critical Test Cases Needed:**

**Extension (background.ts):**
```typescript
// Test message dispatch routing
test('dispatch routes GET_STATE correctly', async () => {
  const req: Request = { type: 'GET_STATE' }
  const response = await dispatch(req)
  expect(response.ok).toBe(true)
  expect((response as Response<StateData>).data.signedIn).toBeDefined()
})

// Test URL normalization
test('normalizeUrl enforces https', () => {
  expect(normalizeUrl('http://example.com')).toMatch(/^https:/)
})

// Test OAuth callback
test('exchangeCode exchanges code for session', async () => {
  // Mock Supabase response
  const response = await exchangeCode('fake-code')
  expect(response.ok).toBe(true)
})
```

**Timeline:** 5-10 days for comprehensive coverage. Start with critical paths (2-3 days).

---

### **⚠️ Issue #9: Hardcoded Category IDs in Client Code**
**Severity:** HIGH  
**Location:** web/src/app/join/join-content.tsx, Lines 8-15

**Current Code:**
```typescript
const CATEGORIES = [
  { id: "c1000000-0000-0000-0000-000000000001", label: "Science & Nature", emoji: "🔬" },
  { id: "c1000000-0000-0000-0000-000000000002", label: "Technology", emoji: "💻" },
  // ... 6 more hardcoded UUIDs
];
```

**Problem:**
- If category IDs ever change, UI breaks
- Not DRY — categories defined in database AND code
- No way to add new categories without code changes

**Better Approach:**
```typescript
useEffect(() => {
  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('id, name, emoji')
      .order('id')
    setCategories(data || [])
  }
  fetchCategories()
}, [])
```

**Timeline:** 1-2 hours.

---

### **⚠️ Issue #10: Android ProGuard Configuration Incomplete**
**Severity:** HIGH  
**Location:** android/app/proguard-rules.pro

**Issue:**
- File exists but content not verified to whitelist Supabase Kotlin client
- Without rules, ProGuard may obfuscate/strip classes needed at runtime

**Required Rules:**
```proguard
# Supabase Kotlin client
-keep class io.github.jan.supabase.** { *; }
-keepclassmembers class io.github.jan.supabase.** { *; }

# Jetpack Compose runtime
-keep class androidx.compose.runtime.** { *; }
-keepclassmembers class androidx.compose.runtime.** { *; }

# OkHttp/HTTP clients
-keep class okhttp3.** { *; }
-keepclassmembers class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Kotlinx serialization
-keepclassmembers class kotlin.** { <methods>; }
-keep class kotlinx.serialization.** { *; }
```

**Timeline:** 30 minutes.

---

### **⚠️ Issue #11: OAuth Callback Flow Lacks Comprehensive Testing**
**Severity:** HIGH

**Test Status:**
- Extension: Manual only (no automated tests)
- Web: No tests documented
- Android: No tests documented

**Needed:**
1. Extension Firefox OAuth testing
2. Web JWT extraction and session handling
3. Android deep link parsing and state restoration

**Timeline:** 2-3 days for comprehensive testing.

---

## **3. MEDIUM-PRIORITY IMPROVEMENTS**

### **🟡 Issue #12: Error Messages Not User-Friendly**
**Severity:** MEDIUM  
**Locations:** Multiple

Examples of poor error messages:
- "400: uid mismatch" (extension) → should be "Your session expired"
- "Error: Invalid JSON" (Supabase) → should be "Submission format is incorrect"
- "Cannot read property 'url' of undefined" (Android) → should be "Failed to load web page"

**Timeline:** 2-3 hours to audit and improve all error paths.

---

### **🟡 Issue #13: Missing Loading States in UI**
**Severity:** MEDIUM  
**Locations:** Web and Android

**Examples:**
- Join page: "Save preferences" button doesn't show loading state
- Android config bottom sheet: "Add to collection" dialog doesn't show loading spinner
- Web category fetch: No skeleton/placeholder during load

**Fix:** Add loading indicators to all async operations.

**Timeline:** 4-6 hours across both platforms.

---

### **🟡 Issue #14: Environment Variable Validation Missing**
**Severity:** MEDIUM  
**Status:** Each service loads env vars without validation

**Current Code (all services):**
```typescript
const supabaseUrl = env.SUPABASE_URL
const supabaseAnonKey = env.SUPABASE_ANON_KEY
// ... no checks if undefined
```

**Fix Required:**
```typescript
const validateEnv = (vars: string[]) => {
  const missing = vars.filter(v => !process.env[v])
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(', ')}`)
  }
}
validateEnv(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SAFE_BROWSING_API_KEY'])
```

**Timeline:** 1 hour for all services.

---

### **🟡 Issue #15: Documentation Gaps**
**Severity:** MEDIUM

**Missing Docs:**
- [ ] Web OAuth flow diagram
- [ ] Android deep link routing reference
- [ ] Supabase RLS policy explanation
- [ ] Safe Browsing API integration guide
- [ ] Rate limiting strategy document
- [ ] Database schema diagram (ERD)
- [ ] Deployment runbook

**Timeline:** 5-10 hours to write comprehensive docs.

---

## **4. LOW-PRIORITY POLISH ITEMS**

### **🟢 Issue #16: Unused/Dead Code**
- [extension/src/popup/popup.ts](extension/src/popup/popup.ts#L50) — unused `roam_visited` storage check
- [android/app/src/main/java/.../MainViewModel.kt](android/app/src/main/java/app/roam/android/viewmodel/MainViewModel.kt) — TODO comments for unimplemented features
- [web/src/app/admin/](web/src/app/admin/) — incomplete admin dashboard, should be removed or finished

**Timeline:** 1-2 hours to clean up.

---

### **🟢 Issue #17: Logging Could Be More Comprehensive**
**Current State:** Good logging in background.ts and Supabase functions, but:
- Web app has minimal logging (hard to debug production issues)
- Android has no structured logging (crashes are mystery)

**Better Approach:**
- Add Sentry/LogRocket integration for error tracking
- Structured logging with correlation IDs
- Client-side error boundaries

**Timeline:** Low priority, nice-to-have.

---

### **🟢 Issue #18: README.md Could Be Enhanced**
- Current README is minimal
- Add architecture diagram
- Add development setup guide
- Add testing guide
- Add deployment instructions

**Timeline:** 3-4 hours to expand.

---

## **5. SUBMISSION READINESS SUMMARY**

### **Chrome Web Store (5.17) - Status: ⚠️ HOLD**

**Blockers:**
- [ ] Safe Browsing API validation must be enforced (Issue #2)
- [ ] Category IDs must be fetched dynamically, not hardcoded (Issue #9)

**High-Priority Fixes:**
- [ ] Audit logging added (Issue #3)
- [ ] Comprehensive OAuth testing (Issue #11)

**Store Listing Checklist:**
- [x] Extension packaged as ZIP
- [x] Icons prepared (16, 32, 48, 128 px)
- [x] Manifest v3 compliant
- [ ] Privacy policy URL: `https://roamtheweb.app/privacy`
- [ ] Detailed description (50-500 chars)
- [ ] Category selected (Productivity)
- [ ] Screenshot prepared
- [ ] Safe Browsing API enforcement verified (CRITICAL)

**Estimated Fix Time Before Submission:** 2-3 days

---

### **Firefox AMO (5.19) - Status: ⚠️ HOLD**

**Blockers:**
- [ ] Same as Chrome (#2, #9)
- [ ] Firefox OAuth testing not documented (Issue #11)

**Additional Checks:**
- [ ] Firefox manifest syntax verified
- [ ] Cross-browser callback handling verified
- [ ] Rate limiting added (Issue #5)

**Estimated Fix Time Before Submission:** 2-3 days

---

### **Android Play Store (6.19) - Status: ⏸️ NOT YET**

**Critical Blockers:**
- [ ] Signed release APK not yet generated
- [ ] ProGuard rules not verified (Issue #10)
- [ ] Rate limiting added (Issue #5)
- [ ] Audit logging added (Issue #3)
- [ ] ON DELETE CASCADE constraints added (Issue #4)

**High-Priority:**
- [ ] Loading states added (Issue #13)
- [ ] Error messages improved (Issue #12)

**Estimated Fix Time Before Submission:** 4-5 days

---

### **Web App (roamtheweb.app) - Status: ⏸️ BETA ONLY**

**Critical Blockers:**
- [ ] Safe Browsing API validation (Issue #2)
- [ ] Rate limiting (Issue #5)
- [ ] Audit logging (Issue #3)
- [ ] Dynamic category fetching (Issue #9)

**High-Priority:**
- [ ] Loading states (Issue #13)
- [ ] Error messages (Issue #12)
- [ ] Environment variable validation (Issue #14)

**Estimated Fix Time:** 5-7 days

---

## **6. RECOMMENDED FIX PRIORITY ORDER**

**Phase 1 (Day 1-2): Critical Infrastructure**
1. Safe Browsing API enforcement (Issue #2) — 30 min
2. Rate limiting on `/profile` (Issue #5) — 2 hours
3. Audit logging migration (Issue #3) — 30 min
4. ON DELETE CASCADE (Issue #4) — 15 min
5. Category ID dynamic fetch (Issue #9) — 2 hours

**Phase 2 (Day 2-3): Database & Validation**
6. URL normalization shared code (Issue #7) — 1 hour
7. Collection slug validation (Issue #6) — 2 hours
8. Environment variable validation (Issue #14) — 1 hour
9. ProGuard rules (Issue #10) — 30 min

**Phase 3 (Day 3+): Testing & QA**
10. Comprehensive OAuth testing (Issue #11) — 3 days
11. Test coverage (Issue #8) — 5-10 days (lower priority)
12. Error messages & loading states (Issues #12, #13) — 4-6 hours

**Phase 4 (Parallel): Documentation**
- README expansion (Issue #18) — 3-4 hours
- Docs gaps (Issue #15) — 5-10 hours
- Code cleanup (Issue #16) — 1-2 hours

---

## **7. DECISION POINTS NEEDED**

| Decision | Impact | Options |
|----------|--------|---------|
| **Supabase Pro Upgrade** | Storage crisis | Pay $25/month or implement compression/archiving |
| **Test Framework** | Coverage approach | Vitest? Jest? Deno test runner? |
| **Logging Platform** | Error visibility | Sentry? LogRocket? Simple console? |
| **Rate Limiting Backend** | Username enumeration | Redis? Supabase KV? Cloudflare? |
| **Admin Dashboard** | Moderation UI | Keep & implement? Remove temporarily? |

---

## **CONCLUSION**

**Status:** Project is ~70% feature-complete but ~40% production-ready.

**Critical Path:** Fix issues #2, #3, #4, #5, #9 within 2-3 days to unblock Chrome/Firefox submissions.

**Realistic Timeline:**
- Chrome/Firefox stores: **5.17 & 5.19 by May 7** (if Phase 1-2 completed)
- Android Play Store: **6.19 by May 14** (if also Phase 3 OAuth testing complete)
- Web app: **roamtheweb.app beta → public by May 21** (with test coverage)

**Go/No-Go Recommendation:** **DO NOT SUBMIT** to stores until all Critical issues (#1-5) are resolved. Estimated ETA: **May 7-10.**

**Next Actions:**
1. ✅ Schedule Supabase Pro upgrade TODAY
2. ✅ Assign Issue #2 (Safe Browsing API validation) — blocking everything
3. ✅ Assign Issue #5 (Rate limiting) — blocking security
4. ✅ Create Deno test file for Supabase functions (Issue #8 start)
5. ✅ Schedule OAuth testing sprint (Issue #11)

