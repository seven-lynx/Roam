# 🚨 Critical Issues — Immediate Action Required

**Before submitting to app stores, address these 5 items:**

---

## 1. No Automated Testing Framework

**Status:** 🔴 BLOCKING  
**Impact:** Cannot verify refactoring doesn't break features; store reviewers cannot validate security  
**Time to Fix:** 16 hours total

### What's Missing
- Zero test files in entire codebase
- No Jest/Vitest/pgTAP setup
- No CI test execution
- RLS policies untested
- URL normalization logic (duplicated) never validated

### What to Do
```bash
# 1. Add testing dependencies
cd web && pnpm add -D jest @testing-library/react @testing-library/dom
cd ../extension && pnpm add -D vitest @testing-library/dom
cd ../supabase && pnpm add -D pgtap  # PostgreSQL testing

# 2. Write critical tests
# - supabase/tests/rls.sql (RLS policy tests)
# - web/src/__tests__/dashboard.test.tsx (page rendering)
# - extension/src/__tests__/queue.test.ts (queue logic)
# - scripts/__tests__/normalize.test.mjs (URL normalization both ways)

# 3. Wire into CI (see issue #2)
```

**Minimum viable test coverage:**
- ✅ RLS policies: 100% (10 policies = 20 test cases)
- ✅ Edge Functions: 80% (5 functions = 10 test cases)
- ✅ URL normalization: 100% (both Node.js + Deno identical)
- ✅ React components: 50% (critical paths only: dashboard, join flow)

**Reference:** [Full details in AUDIT_REPORT.md § 1](AUDIT_REPORT.md#-critical-zero-test-coverage)

---

## 2. No CI/CD Pipeline

**Status:** 🔴 BLOCKING  
**Impact:** Manual deployments are error-prone; no pre-submit validation; rollback impossible  
**Time to Fix:** 4 hours

### What's Missing
- No `.github/workflows/` directory
- No automated testing on push
- No linting enforcement
- Extension/Android built manually then uploaded to stores
- No release tracking (Git tags, changelog)

### What to Do
```bash
# 1. Create GitHub Actions workflow
touch .github/workflows/build.yml

# 2. Workflow should:
# - Run on every push and PR
# - Lint (ESLint, Prettier)
# - Type-check (TypeScript)
# - Build (web, extension, Android)
# - Test (Jest, Vitest, pgTAP)
# - Upload artifacts
# - Block merge if any step fails

# 3. Add branch protection in GitHub
# Settings → Branches → Add rule for main
# Require status checks (build, test, lint) pass before merge
```

**Example workflow skeleton:**
```yaml
name: Build & Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm -r build
```

**Reference:** [Full details in AUDIT_REPORT.md § 2](AUDIT_REPORT.md#-critical-no-github-actions-pipeline)

---

## 3. Safe Browsing API May Be Bypassed

**Status:** 🔴 BLOCKING  
**Impact:** Malicious URLs could be submitted if Google API fails; privacy violation  
**Time to Fix:** 2 hours

### What's Wrong
File: [supabase/functions/submit-url/index.ts](supabase/functions/submit-url/index.ts)

```typescript
// Current code enforces key at startup but unclear what happens on API failure
if (!SAFE_BROWSING_API_KEY) {
  throw new Error('SAFE_BROWSING_API_KEY environment variable is required')
}

async function checkSafeBrowsing(url: string, apiKey: string): Promise<boolean> {
  const res = await fetch(...);  // What if this returns 503?
  const data = await res.json();
  return !data.matches || data.matches.length === 0;  // Silently accepts on error?
}
```

**Problem:** If Google's API is down (503), or times out, or returns malformed JSON, behavior is undefined.

### What to Do
```typescript
// Fix: Explicit error handling
async function checkSafeBrowsing(url: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}', {
      // ... request
      signal: AbortSignal.timeout(5000),  // 5s timeout
    });

    if (res.status >= 500) {
      // Google API is down — REJECT submission to be safe
      throw new Error('Safe Browsing service temporarily unavailable');
    }
    if (!res.ok) {
      throw new Error('Safe Browsing API error: ' + res.status);
    }

    const data = await res.json();
    return !data.matches || data.matches.length === 0;
  } catch (error) {
    // NEVER silently accept — default to REJECT
    Sentry.captureException(error);
    throw error;  // Submission will be rejected with 500
  }
}
```

**Testing:**
```bash
# Test Safe Browsing failure modes
curl -X POST http://localhost:54321/functions/v1/submit-url \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com"}'

# Should return 200 if URL is clean
# Should return 422 if URL matches malware database
# Should return 503 if Google API is down (not 200)
```

**Reference:** [Full details in AUDIT_REPORT.md § 3.1](AUDIT_REPORT.md#-critical-safe-browsing-api-may-be-bypassed)

---

## 4. Debug Logging Exposes User Data in Production

**Status:** 🟡 HIGH  
**Impact:** User IDs, emails, URLs logged to browser console; visible to anyone with access  
**Time to Fix:** 2 hours

### What's Exposed
Files: [web/src/**/*.tsx](web/src/app/dashboard/page.tsx#L63), [extension/src/**/*.ts](extension/src/background/background.ts#L257)

Examples:
```typescript
// web/src/app/dashboard/page.tsx:63
console.error('Roam error:', error);  // Exposes error structure

// extension/src/background/background.ts:257
console.log('[roam-bg] Session found:', { email: session.user.email, userId: session.user.id });
// Logs: { email: "user@example.com", userId: "550e8400-e29b-41d4-a716-446655440000" }

// web/src/app/join/join-content.tsx:80
console.log('[roam] Auth state changed:', event, 'session:', session?.user.id);
// Logs user ID on every state change
```

**Attack scenario:** Attacker uses DevTools on public computer → sees user IDs → could correlate with public profiles

### What to Do
```typescript
// 1. Create logger utility
// web/src/lib/logger.ts
const isDev = process.env.NODE_ENV === 'development';

export const logger = isDev ? console : {
  log: () => {},     // no-op in production
  warn: () => {},
  error: (ctx: string, err: Error) => {
    // Only send to Sentry, never log details
    Sentry.captureException(err, { tags: { context: ctx } });
  },
};

// 2. Replace all console.log with logger.log
// BEFORE:
console.log('[roam] Auth state changed:', event, 'session:', session?.user.id);

// AFTER:
logger.log('[roam] Auth state changed');  // No user data

// 3. Replace console.error with logger.error
// BEFORE:
console.error('Roam error:', error);

// AFTER:
logger.error('dashboard', error);  // Sent to Sentry silently
```

**Files to fix (50+ occurrences):**
- [web/src/app/dashboard/page.tsx](web/src/app/dashboard/page.tsx)
- [web/src/app/join/join-content.tsx](web/src/app/join/join-content.tsx)
- [extension/src/background/background.ts](extension/src/background/background.ts)
- [extension/src/popup/popup.ts](extension/src/popup/popup.ts)
- [supabase/functions/roam/index.ts](supabase/functions/roam/index.ts)
- [extension/src/lib/queueManager.ts](extension/src/lib/queueManager.ts)
- [web/src/lib/supabase/client.ts](web/src/lib/supabase/client.ts)

**Reference:** [Full details in AUDIT_REPORT.md § 1.2](AUDIT_REPORT.md#-high-debug-logging-in-production-code)

---

## 5. No API Documentation

**Status:** 🔴 CRITICAL  
**Impact:** Impossible for store reviewers to understand security; new developers can't use API  
**Time to Fix:** 4 hours

### What's Missing
- Edge Function contracts not documented (parameters, responses, error codes)
- Database schema relationships not explained
- RLS policies not listed
- Rate limiting not user-facing
- Safe Browsing behavior not documented

### What to Do
```bash
# 1. Create API documentation
touch supabase/API.md

# 2. Document each Edge Function:
# POST /roam
# POST /submit-url
# POST /rate
# POST /collection
# POST /follow
# GET /profile
# POST /save-url
# POST /log-failed-urls
# POST /feedback

# 3. For each function document:
# - What it does
# - Authentication required?
# - Input parameters (type, required/optional)
# - Output format (JSON example)
# - Possible error codes (400, 401, 403, 422, 429, 500)
# - Rate limits
# - Security considerations
```

**Minimal example:**
```markdown
# Supabase API Reference

## POST /functions/v1/roam
Get a random discovery URL matching user preferences.

**Authentication:** Required (user must be signed in)

**Request body:**
```json
{
  "collection_id": "optional-uuid",
  "exclude_domain": "optional-domain.com",
  "subcategory_id": "optional-uuid"
}
```

**Response (200 OK):**
```json
{
  "id": "url-uuid",
  "url": "https://example.com/article",
  "title": "Page Title",
  "description": "Short description",
  "og_image_url": "https://cdn.example.com/image.jpg",
  "category_id": "uuid",
  "wilson_score": 0.87
}
```

**Errors:**
- 400: Invalid JSON or missing parameters
- 401: Unauthorized (not signed in)
- 404: No more URLs available for this user
- 500: Database or RPC error

---

## POST /functions/v1/submit-url
Submit a new URL to the discovery pool.

[... etc ...]
```

**Reference:** [Full details in AUDIT_REPORT.md § 5.1](AUDIT_REPORT.md#-critical-no-api-documentation)

---

## Verification Checklist

Before submitting to stores, verify:

- [ ] **Testing:** `pnpm test` runs and passes (>80% RLS coverage, Edge Function tests)
- [ ] **CI/CD:** `.github/workflows/build.yml` exists and runs on push
- [ ] **Safe Browsing:** Test with intentionally malicious URL; should return 422
- [ ] **Logging:** Run prod build; `npm start` produces no console output
- [ ] **API Docs:** `supabase/API.md` documents all functions with examples
- [ ] **No leaks:** Grep for `console.log`, `console.error` in build output — should be 0

---

## Quick Fix Script

```bash
#!/bin/bash
# Fix all 5 issues quickly

# 1. Create GitHub Actions
mkdir -p .github/workflows
cat > .github/workflows/build.yml << 'EOF'
name: Build & Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 24.x, cache: pnpm }
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm -r build
EOF

# 2. Create logger utility
mkdir -p web/src/lib
cat > web/src/lib/logger.ts << 'EOF'
const isDev = process.env.NODE_ENV === 'development';
export const logger = isDev ? console : {
  log: () => {},
  error: (ctx: string, err: Error) => {
    // Send to Sentry only
    import('./sentry').then(s => s.default.captureException(err, { tags: { context: ctx } }));
  }
};
EOF

# 3. Create API docs template
cat > supabase/API.md << 'EOF'
# Supabase API Reference

## Edge Functions

### POST /roam
Get a random discovery URL.
EOF

# 4. Create test directory
mkdir -p supabase/tests
cat > supabase/tests/rls.sql << 'EOF'
-- Test RLS policies
-- TODO: Add pgTAP tests
EOF

echo "✅ Critical issues scaffolding complete!"
echo "Next steps:"
echo "1. Replace console.log in 50+ files"
echo "2. Write test suites"
echo "3. Fix Safe Browsing error handling"
```

---

**Status:** These 5 issues are blocking app store submission.  
**Priority:** Fix in this order (1 → 2 → 3 → 4 → 5)  
**Timeline:** Should take 24-30 hours total  
**Review:** Once fixed, verify in [TASKS.md](TASKS.md) Stage 9

For detailed recommendations, see [AUDIT_REPORT.md](AUDIT_REPORT.md)
