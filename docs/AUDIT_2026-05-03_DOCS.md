# Roam — Documentation-Based Project Audit

**Mode:** Documentation-only (CONTEXT.md, README files, ROADMAP.md, design docs, no source reads)  
**Auditor:** GitHub Copilot

---

## Subsystems Discovered

| Subsystem | Stack | Stage | Status |
|---|---|---|---|
| Web App | Next.js 16, React 19, TypeScript, Tailwind CSS | Stage 10–11 | In progress |
| Browser Extension | TypeScript, esbuild, MV3 | Stage 13 | Complete |
| Android App | Kotlin, Jetpack Compose, MVVM | Stage 14 | Complete (Play Store pending) |
| Supabase Backend | PostgreSQL, Deno Edge Functions (11) | Stage 9 | 31/37 tasks |
| Seeders | Node ESM, 26 scripts | Stage 5 | Complete, ~1.69M URLs |
| CI/CD | GitHub Actions | Stage 8 | Complete |

---

## Executive Summary

Roam is a StumbleUpon-style web discovery platform with a mature, multi-platform monorepo. The architecture is sound: server-side auth throughout, Supabase RLS on all tables, Sentry across all three client platforms, and a curated URL corpus of ~1.69M entries. The project is 74% complete (255/343 tasks). Critical user-facing infrastructure — the discovery algorithm, OAuth flows, and Sentry integration — appears complete and well-designed per documentation. The primary outstanding gaps are: E2E test suite (Stage 7, 0/9), several open security hardening tasks in Stage 9, and web UX polish in Stage 10.

---

## Strengths (Documentation-Verified)

| Strength | Source |
|---|---|
| Server-side auth with `getUser()` — never trusts client cookies | AGENTS.md, CLAUDE.md |
| RLS on every Supabase table | supabase/README.md, API.md |
| Sentry on web, extension, and Android | ROADMAP tasks 11.1, 13.x, android/README |
| Wilson score + calibrated-weight ranking algorithm | ALGORITHM.md |
| MV3 event-driven extension, no background loops | DESIGN.md, Stage 13 notes |
| Prefetch queue in both extension and Android ViewModel | extension/DESIGN.md, android/README |
| Safe Browsing enforcement on URL submissions | Stage 9 ROADMAP |
| Rate limiting on public endpoints | Stage 9 ROADMAP |
| Google OAuth + GitHub OAuth + email/password | ROADMAP Stage 10 |
| ISR + Cloudflare CDN + Vercel edge | web/CLAUDE.md |
| Trivy + TruffleHog security scanning in CI | CI documentation |

---

## Gaps Found

### Features

| Gap | Severity | Source |
|---|---|---|
| E2E test suite (Stage 7) | HIGH | 0/9 tasks started |
| Web app UX polish: URL check badge, collections UI, save-later (Stage 10) | MEDIUM | 15/21 tasks open |
| Web app follows/social features | MEDIUM | Stage 11 partial |
| Admin analytics dashboard | LOW | Task 11.23 listed open |

### Testing

| Gap | Severity | Note |
|---|---|---|
| No E2E tests anywhere (web, Android, extension) | HIGH | Stage 7: 0 tests written |
| Extension unit test coverage unverified | MEDIUM | Only setup mentioned in TESTING.md |
| Android instrumentation tests unverified | MEDIUM | TESTING.md mentions local+CI setup but no test count |

### Security

| Gap | Severity | Task |
|---|---|---|
| CORS wildcard on Edge Functions | MEDIUM | 9.34 open |
| Admin analytics endpoint permissions review | LOW | Task 11.23 |
| Password reset rate limiting | LOW | Task 10.x |

### Infrastructure

| Gap | Severity | Note |
|---|---|---|
| Play Store submission not yet submitted | MEDIUM | Scheduled 6.17–6.19 |
| Extension under review at Chrome Web Store + Firefox AMO | LOW | Waiting on store approval |
| No scheduled job for cleanup of stale DB entries | LOW | Not mentioned in docs |

### Documentation

| Gap | Source |
|---|---|
| ROADMAP Stage 14 quick-nav table shows 0/11 (likely stale) | ROADMAP.md |
| Android REFERENCE.md not kept in sync with ViewModel API surface | android/REFERENCE.md |

---

## Suggested Improvements

### Immediate
1. Begin Stage 7 E2E tests — Playwright for web, Espresso for Android. The zero-test state is the largest quality risk.
2. Fix CORS wildcard (task 9.34) — scope to `roamtheweb.app` + extension origin.

### Short-Term
3. Automate ROADMAP task count via CI comment rather than manual updates — stale entries already present.
4. Add `user_domain_cooldowns` cleanup cron job once domain diversity feature ships.
5. Verify extension key-length validation is enforced at build time.

### Long-Term
6. Sentry for Deno Edge Functions (`@sentry/deno`) — error visibility gap on server side.
7. Consider consolidating four different env-validation patterns into one shared utility.

---

## Open Questions

| # | Question |
|---|---|
| 1 | Are the 26 seeders run on a schedule or manually on demand? |
| 2 | Is there a disaster-recovery runbook if Supabase free tier hits limits? |
| 3 | What is the moderation workflow for the admin queue — manual only, or partially automated? |
| 4 | Does the Android app's deep-link scheme (`roam://`) conflict with any existing scheme? |
| 5 | Has the OAuth callback URL been registered on both Google Cloud Console and GitHub OAuth App for the production domain? |

---

*This report was produced from project documentation only. A follow-up code-level audit is in [AUDIT_2026-05-03_CODE.md](AUDIT_2026-05-03_CODE.md).*
