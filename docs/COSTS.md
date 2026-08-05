# Roam — Project Costs

**Last updated:** May 31, 2026

---

## One-Time Costs

| Item | Cost | Status | Notes |
|---|---|---|---|
| Chrome Web Store developer account | $5 | ✅ Paid | Required for extension submission |
| Google Play developer account | $25 | ✅ Paid | Required for Play Store submission (6.17–6.19) |
| `roamtheweb.app` domain (first year) | ~$14 | ✅ Paid | Registered via Cloudflare; `.app` TLD at Cloudflare Registrar rates |

**Total one-time (paid to date): ~$44**

---

## Monthly Recurring Costs (Current, Pre-Launch)

| Service | Plan | Cost/month | Notes |
|---|---|---|---|
| **Supabase** | Pro | $25.00 | Started 2026-04-30; includes 8 GB storage, 250 GB egress, 100K MAUs, $10 compute credit (Micro instance) |
| **Cloudflare** | Free (DNS + Email Routing) | ~$1.17 | Domain renewal amortised (~$14/year for `.app`) |
| **Vercel** | Hobby (free) | $0 | Web app hosting; custom domains supported on free tier |
| **Sentry** | Developer (free) | $0 | Error tracking for web and Android; 5K errors/month included |
| **GitHub** | Free (public repo) | $0 | Source control + CI |

**Total monthly (current): ~$26/month**

---

## What the Supabase Cap Warning Is About

Supabase Pro includes a **spend cap** (on by default) that throttles/rejects requests when usage quotas are hit rather than charging overages. You're likely seeing warnings on one or more of:

| Quota | Included | Current estimate | Concern |
|---|---|---|---|
| **Database storage** | 8 GB | ~4–6 GB (3.2M URL rows + indexes) | ⚠️ Getting close; dead URL cleanup will recover ~1.5 GB as rows are retired |
| **Compute (Micro)** | $10 credit → 1 GB RAM, 2-core ARM | Stressed by long-running `roam()` queries | ✅ Fixed in v22 — halved I/O per call by restoring `inactive = FALSE` filter |
| **Egress** | 250 GB/month | Pre-launch: negligible | ✅ No concern yet |
| **MAUs** | 100,000/month | Pre-launch: <100 | ✅ No concern yet |
| **Edge Function invocations** | 500K/month (free tier carry-over) | Pre-launch: low | ✅ No concern yet |

The roam() v21 bug (missing `inactive = FALSE`) was scanning 3.2M rows instead of 1.7M on every call — nearly double the compute I/O. With Android users retrying after timeouts, every failed roam attempt triggered multiple full-table traversals. **v22 cuts this roughly in half.**

The dead URL cleanup (currently ~34% complete) will also shrink the active pool further, reducing both storage and I/O.

---

## Monthly Cost at Scale

These are estimates assuming the project gains traction. Supabase compute is the only meaningful variable.

| MAU tier | Roam calls/day (est.) | Supabase compute needed | Monthly total |
|---|---|---|---|
| Pre-launch (<500 MAU) | <5K | Micro ($0 after credit) | **~$26/month** |
| Light traction (1K–5K MAU) | 5K–50K | Micro or Small (+$5 after credit) | **~$31/month** |
| Moderate traction (10K–25K MAU) | 50K–250K | Small or Medium (+$5–$50 after credit) | **~$31–$76/month** |
| Significant traction (50K+ MAU) | 250K+ | Medium or Large (+$50–$100 after credit) | **~$76–$126/month** |

Key overage rates if spend cap is turned off:
- Additional storage: $0.125/GB/month
- Additional egress: $0.09/GB
- Additional MAUs: $0.00325/MAU

Vercel Hobby is sufficient through early traction. If you need analytics, team access, or higher build limits, Vercel Pro is $20/month.

---

## Total Spent to Date (May 31, 2026)

| Item | Amount |
|---|---|
| Supabase Pro — May 2026 (1 month) | $25.00 |
| Domain registration — `roamtheweb.app` | ~$14.00 |
| Chrome Web Store developer account | $5.00 |
| Google Play developer account | $25.00 |
| **Total** | **~$69.00** |
