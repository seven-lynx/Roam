# Deployment Checklist

## Pre-Deployment Verification

Complete all checks before initiating deployment to production.

### Environment Variables

#### Web (Next.js - `web/.env.local`)

- [ ] `NEXT_PUBLIC_SUPABASE_URL` set and valid (https://...)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set (public key, safe for client)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (private key, server-only)
- [ ] `SENTRY_AUTH_TOKEN` set for error tracking
- [ ] `NEXT_PUBLIC_SENTRY_DSN` set for client-side error reporting
- [ ] `NODE_ENV` = `production` in production deployment
- [ ] No console.log() statements in critical paths
- [ ] No hardcoded test data or test URLs

**Verification:**
```bash
cd web
grep -r "NEXT_PUBLIC_" .env.local
# Should show: SUPABASE_URL, SUPABASE_ANON_KEY, SENTRY_DSN
```

#### Android (`android/local.properties`)

- [ ] `firebase.apiKey` configured (if using Firebase)
- [ ] `google.oauth.clientId` set for OAuth
- [ ] `supabase.url` points to production
- [ ] `supabase.anonKey` is production key
- [ ] `sentry.dsn` configured
- [ ] No debug/test keys in release build

**Verification:**
```bash
cd android
grep -E "apiKey|clientId|supabase|sentry" local.properties
```

#### Supabase Cloud

- [ ] Project URL verified: https://xxx.supabase.co
- [ ] API keys copied from dashboard (project settings)
- [ ] Database region selected (US, EU, etc.)
- [ ] Backups configured (daily snapshots)
- [ ] CORS headers allow production domain

**Verification:**
- Visit https://app.supabase.com → Settings → API
- Verify anon key and service role key present

---

### Code Quality & Security

#### TypeScript & Linting

- [ ] No TypeScript errors: `npm run build` passes
- [ ] No ESLint warnings: `npm run lint` passes
- [ ] No unused imports
- [ ] No console.log() in production code (use logger)
- [ ] Type safety: no `any` types (unless justified)

```bash
cd web
npm run build      # Should complete without errors
npm run lint       # Should show 0 errors
```

#### Security Checks

- [ ] No API keys hardcoded in source code
- [ ] No private keys in `.git` history: `git log --all -S "PRIVATE_KEY"`
- [ ] `.env.local` in `.gitignore` (never commit)
- [ ] OAuth redirect URIs match deployment domain
- [ ] HTTPS enforced (no http://)
- [ ] SQL queries parameterized (not string concatenation)
- [ ] User input sanitized before storage
- [ ] Password hashing: bcrypt/Supabase Auth handles this

```bash
# Check for secrets in git history
git log --all -S "key\|secret\|token" --oneline

# Check env file not in git
git ls-files | grep ".env"  # Should be empty
```

#### Dependency Security

- [ ] No known vulnerabilities in dependencies
- [ ] Dependencies up to date (or stable versions)
- [ ] Lock file committed (`pnpm-lock.yaml`, `package-lock.json`)

```bash
npm audit            # Should show 0 vulnerabilities (or only low-severity)
npm outdated         # Check for available updates
```

---

### Database & Migrations

#### Supabase Migrations

- [ ] All migrations have been tested on staging
- [ ] Latest migration timestamp is recorded
- [ ] No destructive migrations in production (drop table, alter column type)
- [ ] Rollback procedure documented

**Latest Migrations:**
- [ ] 20260426000004_revert_to_working_roam.sql ✅
- [ ] Any new migrations from development branch

**Verification:**
```bash
cd supabase
supabase migration list     # List all applied migrations
supabase db push --dry-run  # Preview what would be deployed
```

#### Edge Functions

- [ ] All functions deployed: `supabase functions deploy`
- [ ] Functions tested in staging
- [ ] CORS headers configured
- [ ] Secrets (API keys) not hardcoded (use `supabase secrets set`)

**Functions to Deploy:**
- [ ] collection/* (list, create, update, delete)
- [ ] follow/* (follow/unfollow user)
- [ ] log-failed-urls
- [ ] profile/* (get, update)
- [ ] rate/* (submit rating)
- [ ] roam/* (discover, search)
- [ ] submit-url

**Verification:**
```bash
supabase functions list     # Deployed functions
supabase secrets list       # Check secrets set
```

#### RLS Policies

- [ ] Row Level Security (RLS) enabled on all tables
- [ ] Policies tested (deny unauthorized access)
- [ ] Policies allow legitimate user access
- [ ] Admin policies (if any) restricted to service role

**Verification:**
- [ ] Unauthenticated user cannot access private data
- [ ] User cannot access other users' private collections
- [ ] User cannot modify data they don't own

```bash
# In Supabase dashboard: Database → RLS Policies
# Verify each table has appropriate policies
```

---

### API & Endpoints

#### Supabase RPC Functions

- [ ] All custom functions tested
- [ ] Parameter types validated
- [ ] Return types match expected schema

#### HTTP Endpoints

- [ ] All routes respond with correct status codes (200, 404, 500)
- [ ] Error responses include message (not raw error)
- [ ] CORS headers correct
- [ ] Rate limiting configured (if needed)

**Sample Endpoints to Test:**
```bash
# After deployment
curl https://roamtheweb.app/api/health
curl https://roamtheweb.app/api/collections
curl https://roamtheweb.app/api/profile
```

---

### Build Artifacts

#### Web Build

- [ ] Production build succeeds: `npm run build`
- [ ] No build warnings (only info)
- [ ] Build time < 5 minutes
- [ ] Output size reasonable (main bundle < 250KB gzipped)

```bash
cd web
npm run build
# Check output in .next/
ls -lh .next/static/chunks/ | sort -k5 -h
```

#### Android Build

- [ ] Release AAB builds: `./gradlew bundleRelease`
- [ ] APK buildable: `./gradlew assembleRelease`
- [ ] Signing configured (keystore path, alias, passwords)
- [ ] Version code incremented (in `build.gradle.kts`)
- [ ] Version name matches release (e.g., "1.0.0")

```bash
cd android
./gradlew bundleRelease   # Creates app/build/outputs/bundle/release/app-release.aab
./gradlew assembleRelease # Creates APK
```

---

### Testing

#### Manual Testing

- [ ] Core user flow tested (signup → rate → follow)
- [ ] OAuth flow works (Google login)
- [ ] Mobile responsive design verified
- [ ] Dark mode works
- [ ] All pages load without errors
- [ ] Forms validate input correctly
- [ ] Error messages are user-friendly

**Test Checklist:**
- [ ] Web signup/login works
- [ ] Android OAuth completes
- [ ] Collections can be created
- [ ] URLs can be rated
- [ ] Users can follow each other
- [ ] Deep links work (Android)
- [ ] No console errors (F12 → Console)
- [ ] No Sentry errors in last 24 hours

#### Automated Tests

- [ ] Unit tests pass: `npm run test`
- [ ] E2E tests pass (if available): `npm run test:e2e`
- [ ] GitHub Actions CI/CD passes

```bash
cd web
npm run test           # Jest unit tests
npm run test:e2e       # Playwright E2E tests (if configured)
npm run build          # Next.js static analysis
npm run lint           # ESLint
```

#### Performance

- [ ] Page load time < 3s on 4G (Lighthouse)
- [ ] Largest Contentful Paint (LCP) < 2.5s
- [ ] Cumulative Layout Shift (CLS) < 0.1
- [ ] First Input Delay (FID) < 100ms

```bash
# Run Lighthouse audit
npm run build
npm start
# Open DevTools → Lighthouse → Generate Report
```

---

### Documentation

- [ ] README.md updated with latest features
- [ ] TESTING.md created (web/TESTING.md, android/TESTING.md)
- [ ] DEPLOYMENT_CHECKLIST.md kept current
- [ ] API documentation up to date
- [ ] Setup instructions work (tested on fresh machine)

---

## Deployment Procedure

### Pre-Deployment Notifications

- [ ] Notify stakeholders of scheduled deployment
- [ ] Schedule deployment during low-traffic window (if possible)
- [ ] Have rollback procedure ready
- [ ] Team members available for monitoring

### Web Deployment (Vercel)

**Option 1: Automatic (GitHub Push)**

```bash
# Ensure all checks above pass
git add .
git commit -m "chore: pre-deployment verification complete"
git push origin main

# Vercel auto-deploys on push to main
# Watch: https://vercel.com/dashboard
```

**Option 2: Manual (Vercel CLI)**

```bash
npm install -g vercel
vercel deploy --prod
```

**What Gets Deployed:**
- Web app (Next.js)
- API routes (if any in `/api`)
- Static assets
- Environment variables

**Estimated Time:** 2-5 minutes

### Supabase Deployment (CLI)

**Migrations:**
```bash
cd supabase
supabase db push   # Apply pending migrations
```

**Edge Functions:**
```bash
supabase functions deploy
```

**Secrets:**
```bash
supabase secrets set SENTRY_AUTH_TOKEN=<token>
supabase secrets set GOOGLE_CLIENT_SECRET=<secret>
# etc.
```

**Estimated Time:** 1-2 minutes

### Android Deployment (Google Play)

**Prerequisites:**
- [ ] App signing certificate configured
- [ ] Version code incremented
- [ ] Release notes prepared
- [ ] Screenshots/descriptions updated

**Steps:**
```bash
cd android
./gradlew bundleRelease
# Upload to Google Play Console
# https://play.google.com/console
```

**Estimated Time:** 30 minutes to 24 hours (Google Play review)

---

## Post-Deployment Verification

### Monitoring (First 30 minutes)

- [ ] Vercel deployment status: ✅ (watch dashboard)
- [ ] No 5xx errors in logs
- [ ] Sentry error count stable (not increasing rapidly)
- [ ] Website loads correctly
- [ ] Home page loads in < 3 seconds
- [ ] Can sign up / log in
- [ ] Can create collection
- [ ] Can view dashboard

**Check Links:**
- Production URL: https://roamtheweb.app
- Vercel Dashboard: https://vercel.com/dashboard
- Sentry Dashboard: https://sentry.io/organizations/7-lynx/
- Supabase Dashboard: https://app.supabase.com

### Health Checks

#### Web Health Endpoint

```bash
curl https://roamtheweb.app/api/health
# Expected response: { "status": "ok" } or similar
```

#### Database Connection

```bash
# In Supabase dashboard, check:
# - Database is online
# - Latest migration applied
# - RLS policies enabled
# - No database locks
```

#### API Latency

- [ ] API responses < 500ms (normal load)
- [ ] API responses < 1000ms (peak load)
- [ ] No timeout errors

**Verify via:**
```bash
curl -w "@curl-format.txt" https://roamtheweb.app/api/collections
# Check response time in curl output
```

### Error Tracking (Sentry)

- [ ] No new critical errors
- [ ] Error rate < 0.1% (1 error per 1000 requests)
- [ ] No unexpected error patterns
- [ ] Auth errors handled gracefully

**Check Sentry:**
1. https://sentry.io → Roam Project
2. Filter: Last 30 minutes
3. Look for spikes or new error types

### Performance Monitoring

- [ ] Page load times reasonable
- [ ] No unusual slowness
- [ ] Database queries optimized
- [ ] API response times stable

**Check Vercel Analytics:**
1. https://vercel.com/dashboard → Roam Project → Analytics
2. Verify metrics are normal

### User Testing

- [ ] Can sign up with email/password
- [ ] Can sign up with Google OAuth
- [ ] Session persists after refresh
- [ ] Can create and edit collections
- [ ] Can rate URLs
- [ ] Can follow users
- [ ] Mobile layout responsive
- [ ] Dark mode works

---

## Rollback Procedure

### If Critical Issues Found

1. **Stop current deployment immediately**
   - Stop any ongoing deployments in Vercel/GitHub Actions

2. **Identify root cause**
   - Check Sentry for errors
   - Review recent commits
   - Check database state

3. **Revert changes**

   **Option A: Git revert (safer)**
   ```bash
   git log --oneline -5
   # Find last known-good commit
   git revert <bad-commit-hash>
   git push origin main
   # Vercel auto-deploys reverted code
   ```

   **Option B: Git reset (if not public yet)**
   ```bash
   git reset --hard <good-commit-hash>
   git push origin main --force
   ```

4. **Restore database (if needed)**
   - Supabase → Backups → Restore point
   - Choose snapshot from before deployment
   - Estimated time: 5-10 minutes

5. **Notify stakeholders**
   - Explain issue and rollback
   - Provide ETA for re-deployment

6. **Post-Mortem**
   - Document what went wrong
   - Update testing procedures
   - Add to KNOWN_ISSUES if applicable

---

## Post-Deployment Report

### Deployment Summary

| Item | Status | Time | Notes |
|------|--------|------|-------|
| Code Review | ✅/❌ | - | - |
| Tests Pass | ✅/❌ | - | - |
| Build Success | ✅/❌ | - | - |
| Vercel Deploy | ✅/❌ | - | - |
| Supabase Deploy | ✅/❌ | - | - |
| Health Checks | ✅/❌ | - | - |
| Error Rate | ✅/❌ | - | - |

### Issues & Resolutions

| Issue | Severity | Resolved | Resolution |
|-------|----------|----------|-----------|
|       |          |          |           |

### Deployment Date & Time

- **Date:** ___________
- **Start Time:** ___________
- **End Time:** ___________
- **Deployed By:** ___________
- **Approved By:** ___________

---

## Known Deployment Issues

| Issue | Platform | Status | Workaround |
|-------|----------|--------|-----------|
| Vercel cold start > 2s | Web | 🟡 KNOWN | Upgrade plan or implement edge caching |
| Supabase migration timeout | Backend | 🟡 KNOWN | Run large migrations during low-traffic window |
| Android Google Play review delay | Android | 🟡 NORMAL | Allow 24-48 hours for review |

---

## Next Deployment

### Scheduled Date
- **Target:** ___________
- **Reason:** ___________

### Changes Planned
- [ ] Feature: ___________
- [ ] Fix: ___________
- [ ] Update: ___________

---

## Appendix: Useful Commands

### Vercel Deployment
```bash
# Status
vercel status

# Deploy to production
vercel deploy --prod

# View logs
vercel logs roam
```

### Supabase Management
```bash
# Login
supabase login

# List deployments
supabase projects list

# Push migrations
supabase db push

# Deploy functions
supabase functions deploy

# View function logs
supabase functions logs <function-name>
```

### GitHub Release
```bash
# Create release
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0
# Then create release on GitHub from tag
```

### Monitoring
```bash
# Vercel
curl https://roamtheweb.app/api/health

# Sentry
# Dashboard: https://sentry.io/organizations/7-lynx/

# Supabase Logs
# Dashboard: https://app.supabase.com/project/*/logs
```

