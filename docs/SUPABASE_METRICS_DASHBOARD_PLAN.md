# Supabase Metrics Dashboard — Implementation Plan

**Created:** 2026-08-02
**Status:** Planning complete, awaiting implementation
**Goal:** Replace the cobbled-together admin analytics with a unified Grafana dashboard combining Supabase infra metrics + Roam app metrics, without increasing Supabase resource consumption.

---

## Table of Contents

1. [Background & Context](#background--context)
2. [Key Discovery: The Metrics API vs Admin Dashboard](#key-discovery-the-metrics-api-vs-admin-dashboard)
3. [Resource Concern Analysis](#resource-concern-analysis)
4. [Current Admin Dashboard Inventory](#current-admin-dashboard-inventory)
5. [Phased Implementation Plan](#phased-implementation-plan)
6. [Phase 1: Grafana Cloud + Metrics API Scrape](#phase-1-grafana-cloud--metrics-api-scrape)
7. [Phase 2: Diagnostic Analysis](#phase-2-diagnostic-analysis)
8. [Phase 3: Custom App-Metrics Exporter](#phase-3-custom-app-metrics-exporter)
9. [Phase 4: Unified Dashboard & Alerting](#phase-4-unified-dashboard--alerting)
10. [Potential Resource Culprits (Hypotheses)](#potential-resource-culprits-hypotheses)
11. [Cost Estimate](#cost-estimate)
12. [Reference Material](#reference-material)

---

## Background & Context

Roam runs on Supabase ($25/mo plan) with roughly 10 regular users. Despite the small user base, Supabase has been issuing warnings about disk I/O, compute utilization, and nearing caps. The current admin dashboard (`web/src/app/admin/`) is a Next.js-based React app with server actions calling a monolithic `admin_analytics` RPC function. It works, but:

- Has no infrastructure-level visibility (CPU, memory, I/O, connections)
- Relies on manual page loads — no alerting, no push notifications
- May itself be contributing to resource pressure via expensive aggregation queries

Supabase's Metrics API (beta) provides a Prometheus-compatible scrape endpoint exposing ~200 Postgres performance and health metrics. This document outlines a phased plan to leverage it.

---

## Key Discovery: The Metrics API vs Admin Dashboard

These serve **completely different layers** and are complementary, not competitive:

| | Metrics API | Current Admin Dashboard |
|---|---|---|
| **What it measures** | Postgres infra: CPU, IO, WAL, connections, query stats, buffer cache | Business metrics: DAU, submissions, queue, categories, badges |
| **Format** | Prometheus time-series (scrape endpoint) | One-off RPC calls rendered as React components |
| **Retention** | Whatever your Prometheus instance stores (Grafana Cloud: 14 days free) | Current snapshot only; no history beyond materialized views |
| **Alerting** | Prometheus AlertManager (CPU > 80%, connection exhaustion, etc.) | None |
| **Live/Historical** | Real-time streaming, long-term trends | Static snapshots |

**Conclusion:** The Metrics API doesn't replace the admin dashboard. It fills the infrastructure blind spot. The "better dashboard" vision means combining both into one Grafana instance.

---

## Resource Concern Analysis

$25/mo for 10 users with resource warnings is abnormal. Possible explanations:

1. **Supabase's $25 tier genuinely has tight caps** — their pricing page advertises "2 GB database + 50 GB bandwidth + 500 MB egress" which is modest
2. **Something in Roam's codebase is inefficient** — see [Potential Resource Culprits](#potential-resource-culprits-hypotheses)
3. **Supabase's warnings may be aggressive/upsell-driven** — we need hard data from the Metrics API to verify

**Critical design constraint:** Whatever we build must not meaningfully increase Supabase load. The Metrics API endpoint is already being collected internally by Supabase — we're just reading pre-existing telemetry. A single HTTP GET every 60 seconds adds negligible overhead.

---

## Current Admin Dashboard Inventory

### Files

| File | Purpose |
|---|---|
| `web/src/app/admin/page.tsx` | Server component — auth gate (admin/moderator role check) |
| `web/src/app/admin/AdminPageClient.tsx` | Client component — 6-tab dashboard shell (queue, analytics, badges, reports, email, beta) |
| `web/src/app/admin/actions.ts` | Server actions — `getAdminAnalytics()`, `getAdminQueue()`, `getAdminReports()`, badge/email/beta management |
| `web/src/app/admin/views/AdminAnalytics.tsx` | 12 accordion sections: content overview, site activity, content health, submissions over time, submissions by category, moderation queue, top rated URLs, top rated categories, source breakdown, language distribution, content velocity, submission timing |
| `web/src/app/admin/views/AdminBadges.tsx` | Badge management UI |
| `web/src/app/admin/views/AdminEmail.tsx` | Bulk email tool |
| `web/src/app/admin/components/StatCard.tsx` | Reusable stat display |
| `web/src/app/admin/components/BarChart.tsx` | Reusable bar chart component |
| `web/src/app/admin/ModerationDetail.tsx` | Single submission detail view |

### Data Flow

```
AdminAnalytics.tsx
  └─ getAdminAnalytics()  [actions.ts]
       └─ supabase.rpc("admin_analytics")  [SQL function, uses service_role key]
            Returns 17 fields:
            ├── submissions_by_date
            ├── submissions_by_category
            ├── top_urls (Wilson scores)
            ├── queue_stats
            ├── top_rated_categories
            ├── source_breakdown
            ├── language_distribution
            ├── dead_by_category
            ├── active_users (DAU/WAU/MAU)
            ├── submissions_by_dow_hour
            ├── velocity (this_week vs last_week)
            ├── rejection_by_domain
            ├── daily_stats_last30
            └── total_counts
```

### Relevant Migrations

| Migration | Purpose |
|---|---|
| `20260708000000_admin_analytics_v2.sql` | Admin analytics RPC v2 |
| `20260708000001_admin_analytics_v3.sql` | Admin analytics RPC v3 |
| `20260708000002_admin_analytics_v4.sql` | Admin analytics RPC v4 |
| `20260718000000_admin_analytics_stable.sql` | Final/stable admin analytics |
| `20260718000001_report_materialized_views.sql` | Materialized views for report performance |
| `20260718000002_fix_refresh_no_concurrently.sql` | Fix MV refresh method |

---

## Phased Implementation Plan

### Phase 1: Grafana Cloud + Metrics API Scrape (Zero Added Load)
**Effort:** ~1-2 hours | **Cost:** $0

Set up Grafana Cloud free tier to scrape Supabase's Metrics API. Import Supabase's official dashboard JSON. This gives immediate infrastructure visibility with no additional Supabase load.

### Phase 2: Diagnostic Analysis
**Effort:** ~1 week of observation | **Cost:** $0

Observe the ~200 infra metrics to identify what's actually consuming resources. Test the hypotheses listed below. This phase directly addresses the "why am I getting warnings with 10 users?" question.

### Phase 3: Custom App-Metrics Exporter
**Effort:** ~1-2 days | **Cost:** $0

Build a lightweight Supabase Edge Function (`supabase/functions/metrics/index.ts`) that exposes Roam's business metrics (DAU, queue depth, velocity, etc.) in Prometheus format. Designed for minimal DB load: queries materialized views, scrapes at 5-min intervals.

### Phase 4: Unified Dashboard & Alerting
**Effort:** ~1-2 days | **Cost:** $0

Build Grafana panels correlating app metrics with infra metrics. Configure AlertManager rules for Slack/paging.

---

## Phase 1: Grafana Cloud + Metrics API Scrape

### Step 1: Get Your Supabase Project Reference

From your Supabase dashboard URL:
```
https://supabase.com/dashboard/project/<project-ref>
```
Or from any API call URL. This is the unique identifier for your project.

### Step 2: Create/Verify a Secret API Key

1. Go to **Supabase Dashboard → Project Settings → API Keys**
2. Under "Secret API Keys", copy or create a key starting with `sb_secret_...`
3. Leave this tab open — you'll need it in Step 4

### Step 3: Sign Up for Grafana Cloud

1. Go to https://grafana.com/products/cloud/
2. Sign up for the **free tier** (10,000 series metrics, 14-day retention, 50 GB logs, 3 active users)
3. Once logged in, note your Grafana Cloud instance URL (e.g., `https://yourorg.grafana.net`)

### Step 4: Configure Prometheus Scrape

In Grafana Cloud:

1. Navigate to **Connections → Add new connection → Hosted Prometheus metrics**
2. Click **Configure via remote_write** or **Send metrics** (Grafana Cloud's interface may vary)
3. If using Grafana Cloud's hosted Prometheus with a `prometheus.yml`, add a scrape config:

```yaml
scrape_configs:
  - job_name: 'supabase-roam'
    scrape_interval: 60s
    scheme: https
    metrics_path: '/customer/v1/privileged/metrics'
    basic_auth:
      username: 'service_role'
      password: 'sb_secret_...'   # ← Your Secret API key
    static_configs:
      - targets: ['<project-ref>.supabase.co']
        labels:
          project: 'roam'
          environment: 'production'
```

**Alternative — Grafana Agent / Alloy:** If Grafana Cloud requires their agent:

1. Install Grafana Alloy on any always-on machine (or a cheap VPS)
2. Configure it to scrape the Supabase endpoint and forward to Grafana Cloud
3. Or use Grafana Cloud's "Scrape using Grafana Cloud" feature if available in your region

**Alternative — Self-hosted Prometheus:** If you'd rather run locally:
- Install Prometheus on a machine you control
- Use the same scrape config above
- Pair with a local Grafana instance or forward to Grafana Cloud

### Step 5: Import Supabase's Dashboard

1. Go to **Dashboards → New → Import**
2. Import the dashboard JSON from: https://github.com/supabase/supabase-grafana
3. Clone the repo and find the dashboard JSON file (typically `supabase-grafana.json`)
4. Paste into Grafana's import dialog
5. Select your Prometheus data source
6. Click Import

You should immediately see ~200 charts: CPU utilization, IO throughput, WAL generation, buffer cache hit ratios, connection counts, query throughput, rollback rates, vacuum activity, etc.

### Step 6: Verify

1. Open Grafana Explorer
2. Query `pg_stat_database_blks_hit` or any other metric
3. Confirm data is flowing (metrics should appear within 60 seconds)
4. If no data: check auth (username must be literally `service_role`, password must be the full `sb_secret_...` string)

### What You Get (Phase 1 Deliverable)

- Infrastructure health at a glance
- Historical trends (14-day retention on free tier)
- Ability to answer: "Is my database on fire right now?"

---

## Phase 2: Diagnostic Analysis

### Investigation Plan

Spend 1 week observing Grafana. Look for:

#### A. Repeating CPU/IO Spikes

Check the CPU utilization and IO throughput panels for repeating patterns:
- **Every 6 hours?** → `cron-streak-cleanup` or `evaluate-badges` cron functions
- **Every hour?** → Materialized view refreshes
- **Every 24 hours?** → pg_cron scheduled maintenance

#### B. Query Throughput by Time

Overlay query throughput with user activity patterns:
- Do spikes correlate with user sessions?
- Is there a constant baseline even when no users are active? (→ cron/background jobs)

#### C. Connection Count

Monitor the `pg_stat_database_numbackends` metric:
- If connections climb and never release → connection leak
- If connections approach max → connection pool exhaustion risk

#### D. WAL Generation Rate

High WAL generation = lots of writes:
- Check if any Edge Function is doing excessive INSERT/UPDATE
- Badge evaluation writing to `user_badges` and `xp_log` even when nothing changed?

#### E. Buffer Cache Hit Ratio

`blks_hit / (blks_hit + blks_read)`:
- Below 95% → queries are going to disk, not memory
- Suggests working set exceeds available memory, or missing indexes

### Key Metrics to Watch

| Metric | What It Tells You |
|---|---|
| `process_cpu_seconds_total` | CPU consumption over time |
| `pg_stat_database_blks_hit` / `blks_read` | Buffer cache efficiency |
| `pg_stat_database_tup_fetched` / `tup_inserted` / `tup_updated` | Read vs write ratio |
| `pg_stat_database_numbackends` | Active connections |
| `pg_stat_bgwriter_buffers_clean` | Background writer load |
| `pg_stat_user_tables_seq_scan` | Full table scans (indexing gaps) |
| `pg_stat_user_tables_n_tup_ins` / `upd` / `del` | Per-table write volume |

### Action Based on Findings

| If you find... | Then... |
|---|---|
| High CPU from cron jobs | Optimize `evaluate_badges` SQL function, reduce cron frequency |
| Low buffer cache hit ratio | Add missing indexes, reduce working set |
| Connection leaks | Fix Edge Functions to close connections properly |
| Excessive full table scans | Add indexes on frequently filtered columns |
| Supabase warnings don't match Metrics API data | Screenshot both, file a support ticket with receipts |

---

## Phase 3: Custom App-Metrics Exporter

### Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Where it runs** | Supabase Edge Function | Keeps everything in your stack; no new infra |
| **Auth** | Bearer token in env var | Simple; scrape config passes it as header |
| **Scrape interval** | 5 minutes (not 60s) | App metrics don't need real-time resolution |
| **Data source** | Materialized views + direct queries | Avoids the heavy `admin_analytics` RPC |
| **Format** | Standard Prometheus text format | Compatible with any Prometheus scraper |

### File: `supabase/functions/metrics/index.ts`

```typescript
// Prometheus-compatible metrics exporter for Roam app metrics.
// Scraped by Grafana Cloud Prometheus every 5 minutes.
// Uses materialized views and lightweight queries to minimize DB load.
//
// Protect with a bearer token set in Supabase secrets:
//   METRICS_EXPORTER_TOKEN=<random-string>
//
// Scrape config for Grafana Cloud:
//   - job_name: 'roam-app-metrics'
//     scrape_interval: 5m
//     scheme: https
//     metrics_path: '/functions/v1/metrics'
//     bearer_token: '<METRICS_EXPORTER_TOKEN>'
//     static_configs:
//       - targets: ['<project-ref>.supabase.co']

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gauge(name: string, value: number, labels: Record<string, string> = {}, help?: string): string {
  const labelStr = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
  const metricName = `roam_${name}`;
  const lines: string[] = [];
  if (help) lines.push(`# HELP ${metricName} ${help}`);
  lines.push(`# TYPE ${metricName} gauge`);
  lines.push(`${metricName}${labelStr ? `{${labelStr}}` : ""} ${value}`);
  return lines.join("\n");
}

function counter(name: string, value: number, labels: Record<string, string> = {}, help?: string): string {
  const labelStr = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
  const metricName = `roam_${name}`;
  const lines: string[] = [];
  if (help) lines.push(`# HELP ${metricName} ${help}`);
  lines.push(`# TYPE ${metricName} counter`);
  lines.push(`${metricName}${labelStr ? `{${labelStr}}` : ""} ${value}`);
  return lines.join("\n");
}

// ─── Main ────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth check
  const expectedToken = Deno.env.get("METRICS_EXPORTER_TOKEN");
  if (expectedToken) {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (token !== expectedToken) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { ...corsHeaders },
      });
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const metrics: string[] = [];

    // ── Active Users ──────────────────────────────────────────────────
    // Query daily_stats_mv for the most recent row
    const { data: statsData } = await supabase
      .from("daily_stats_mv")
      .select("date, dau, mau, new_users, total_roams, total_saves, total_submits")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (statsData) {
      metrics.push(gauge("dau", statsData.dau, {}, "Daily active users"));
      metrics.push(gauge("mau", statsData.mau, {}, "Monthly active users"));
      metrics.push(gauge("new_users_today", statsData.new_users, {}, "New users today"));
      metrics.push(counter("total_roams", statsData.total_roams, {}, "Total URL roams served"));
      metrics.push(counter("total_saves", statsData.total_saves, {}, "Total URLs saved"));
      metrics.push(counter("total_submits", statsData.total_submits, {}, "Total URL submissions"));
    }

    // ── Moderation Queue ─────────────────────────────────────────────
    const { data: queueData } = await supabase.rpc("queue_stats_summary"); // lightweight RPC
    // Or fall back to individual counts:
    if (!queueData) {
      const { count: pending } = await supabase
        .from("moderation_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      const { count: approved } = await supabase
        .from("moderation_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved");
      const { count: rejected } = await supabase
        .from("moderation_queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "rejected");
      metrics.push(gauge("queue_pending", pending ?? 0, {}, "Moderation queue pending items"));
      metrics.push(gauge("queue_approved", approved ?? 0, {}, "Moderation queue approved items"));
      metrics.push(gauge("queue_rejected", rejected ?? 0, {}, "Moderation queue rejected items"));
    }

    // ── Content Health ────────────────────────────────────────────────
    const { data: deadData } = await supabase.rpc("dead_by_category_summary"); // lightweight RPC
    if (deadData) {
      for (const row of deadData) {
        metrics.push(
          gauge(
            "dead_url_pct",
            row.dead_pct ?? 0,
            { category: row.category },
            "Percentage of dead URLs by category"
          )
        );
        metrics.push(
          gauge(
            "urls_by_category",
            row.total ?? 0,
            { category: row.category },
            "Total URLs by category"
          )
        );
      }
    }

    // ── Velocity ──────────────────────────────────────────────────────
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const { count: thisWeekCount } = await supabase
      .from("moderation_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("reviewed_at", thisWeekStart.toISOString());

    const { count: lastWeekCount } = await supabase
      .from("moderation_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("reviewed_at", lastWeekStart.toISOString())
      .lt("reviewed_at", thisWeekStart.toISOString());

    metrics.push(gauge("velocity_this_week", thisWeekCount ?? 0, {}, "Approved URLs this week"));
    metrics.push(gauge("velocity_last_week", lastWeekCount ?? 0, {}, "Approved URLs last week"));

    // ── Total URLs ────────────────────────────────────────────────────
    const { count: totalUrls } = await supabase
      .from("urls")
      .select("*", { count: "exact", head: true })
      .eq("inactive", false);

    metrics.push(counter("total_urls_active", totalUrls ?? 0, {}, "Total active URLs in pool"));

    // ── User Count ────────────────────────────────────────────────────
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    metrics.push(gauge("total_users", totalUsers ?? 0, {}, "Total registered users"));

    // ── Edge Function Info ────────────────────────────────────────────
    metrics.push(gauge("exporter_scrape_ts", Date.now() / 1000, {}, "Unix timestamp of this scrape"));

    // Return Prometheus text
    const body = metrics.join("\n\n") + "\n";

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("metrics export failed", err);
    return new Response("Internal server error", {
      status: 500,
      headers: { ...corsHeaders },
    });
  }
});
```

### Deployment Steps

1. Create the function:
   ```bash
   cd supabase/functions/metrics
   # Write index.ts (content above)
   ```

2. Deploy with secret:
   ```bash
   supabase secrets set METRICS_EXPORTER_TOKEN=<generate-a-random-token>
   supabase functions deploy metrics --no-verify-jwt
   ```

3. Test locally:
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://<project-ref>.supabase.co/functions/v1/metrics
   ```

4. Add scrape config to Grafana Cloud:
   ```yaml
   - job_name: 'roam-app-metrics'
     scrape_interval: 5m
     scheme: https
     metrics_path: '/functions/v1/metrics'
     bearer_token: '<token>'
     static_configs:
       - targets: ['<project-ref>.supabase.co']
         labels:
           project: 'roam'
           source: 'app'
   ```

### DB Load Analysis

| Query | Frequency | Est. Cost |
|---|---|---|
| `daily_stats_mv` single row | Every 5 min | Sequential scan on materialized view (cached) |
| `moderation_queue` count by status (3 queries) | Every 5 min | Index scan on `status` column |
| `dead_by_category_summary` RPC | Every 5 min | Should query materialized view |
| Velocity counts (2 queries) | Every 5 min | Index scan on `reviewed_at` |
| Total URL count | Every 5 min | Index scan |
| Total user count | Every 5 min | Index scan |

**Total:** ~9 lightweight queries every 5 minutes ≈ 0.03 queries/second. Negligible.

### Recommendations Before Building

- **Create `dead_by_category_summary` RPC** if it doesn't exist (or query the materialized view directly)
- **Create `queue_stats_summary` RPC** that returns `{pending, approved, rejected}` in one query instead of three separate counts
- **Verify `daily_stats_mv` exists** after your `20260718000001_report_materialized_views.sql` migration

---

## Phase 4: Unified Dashboard & Alerting

### Dashboard Panels to Build

#### Row 1: Infra + App Health Overview
- DB CPU (from Metrics API) — gauge with 80% threshold line
- DAU (from app exporter) — sparkline
- Active connections (from Metrics API) — gauge
- Queue pending (from app exporter) — stat with color threshold
- Buffer cache hit ratio (from Metrics API) — gauge with 95% threshold

#### Row 2: Correlation Panels
- **DAU vs DB CPU** — dual Y-axis line chart (are users causing load?)
- **Submission velocity vs Write IOPS** — dual Y-axis line chart (are submissions driving writes?)
- **Queue pending vs Connection count** — are queue backlogs correlated with connection pressure?

#### Row 3: Content Health
- Dead link % by category — bar chart (from app exporter)
- Total URLs by category — bar chart (from app exporter)
- Velocity week-over-week — stat panel with trend arrow

#### Row 4: Postgres Deep Dive
- All ~200 charts from Supabase's imported dashboard

### Alert Rules (Prometheus AlertManager)

```yaml
groups:
  - name: roam_alerts
    rules:
      - alert: HighCPU
        expr: process_cpu_seconds_total{job="supabase-roam"} > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database CPU > 80% for 5 minutes"
          description: "CPU on {{ $labels.instance }} is {{ $value | humanizePercentage }}"

      - alert: ConnectionPoolExhaustion
        expr: pg_stat_database_numbackends{job="supabase-roam"} / 60 > 0.8
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Connection pool nearing exhaustion"

      - alert: QueueBacklog
        expr: roam_queue_pending > 50
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Moderation queue has {{ $value }} pending items for >1 hour"

      - alert: HighDeadLinkRate
        expr: roam_dead_url_pct > 5
        for: 24h
        labels:
          severity: info
        annotations:
          summary: "{{ $labels.category }} has {{ $value }}% dead links"

      - alert: DAUDrop
        expr: (roam_dau / roam_dau offset 7d) < 0.7
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "DAU dropped 30% vs 7-day average"

      - alert: LowBufferCacheHitRatio
        expr: pg_stat_database_blks_hit / (pg_stat_database_blks_hit + pg_stat_database_blks_read) < 0.95
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Buffer cache hit ratio below 95% — queries hitting disk"
```

### Notification Destinations
1. **Slack** — #monitoring channel via Grafana Cloud's Slack integration
2. **Email** — Digest for `severity: info`, immediate for `severity: critical`
3. **Sentry** — Create issues via webhook for `severity: critical` alerts (optional)

### Admin Dashboard Integration (Optional)

You can embed key Grafana panels into the existing Next.js admin dashboard:

1. In Grafana, share a panel → **Embed → Iframe**
2. Copy the iframe URL
3. Add a new tab in `AdminPageClient.tsx`:
   ```tsx
   { id: "monitoring", label: "Monitoring", icon: "📡", color: "bg-cyan-600" }
   ```
4. Render the iframe:
   ```tsx
   {view === "monitoring" && (
     <iframe src="https://yourorg.grafana.net/d-solo/..." width="100%" height="800" />
   )}
   ```

Note: The Grafana instance must allow anonymous access or you need to use a shared public link. For security, consider keeping Grafana separate behind its own auth.

---

## Potential Resource Culprits (Hypotheses)

These are based on codebase analysis. The Metrics API will help confirm or rule out each one.

### 1. `evaluate-badges` Edge Function + SQL Function
- **Evidence:** 13 migration files fixing badge evaluation logic (`20260709000001` through `20260730000010`). The function is triggered via cron and does complex aggregation across multiple tables.
- **Concern:** May be doing full-table scans across `user_badges`, `xp_log`, `seen_urls`, and related tables on every run, even when no badges are due.
- **What to watch:** CPU spikes on the cron schedule (check `cron-secret-badges/index.ts` for frequency).

### 2. Materialized View Refreshes
- **Evidence:** `20260718000001_report_materialized_views.sql` creates materialized views. `20260718000002_fix_refresh_no_concurrently.sql` suggests they were initially using `CONCURRENTLY`.
- **Concern:** If MVs are refreshed on a schedule, each refresh does a full data scan. Non-concurrent refreshes lock the view.
- **What to watch:** Repeating IO spikes corresponding to the refresh interval.

### 3. `admin_analytics` RPC
- **Evidence:** Returns 17 aggregated datasets. Called every time the admin dashboard loads.
- **Concern:** If multiple admins/moderators reload the dashboard, or if it auto-refreshes, this single RPC call could be a significant compute consumer.
- **What to watch:** CPU spikes when the admin page is loaded.

### 4. Core `roam` Edge Function
- **Evidence:** Migration `20260729131443_roam_v30_subcategory_rotation_score_fn.sql` suggests scoring/rotation logic runs on each random-URL request.
- **Concern:** 10 users might generate 100s of roams per day. If each one triggers a complex scoring query, that's constant load.
- **What to watch:** Query throughput correlated with active user sessions.

### 5. Push Notifications
- **Evidence:** `push-notify` function, FCM integration, notification delivery.
- **Concern:** Probably not the issue, but notification fan-out could cause write spikes.
- **What to watch:** Write IO during notification sends.

### 6. Connection Pool Configuration
- **Evidence:** `supabase/config.toml` sets `default_pool_size = 20` and `max_client_conn = 100`.
- **Concern:** Edge Functions that don't close connections properly could exhaust the pool. 20 connections is modest but sufficient for 10 users — unless there's a leak.
- **What to watch:** `numbackends` metric — if it climbs and never drops, there's a leak.

---

## Cost Estimate

| Item | Cost | Notes |
|---|---|---|
| Grafana Cloud | **$0** | Free tier: 10K series, 14-day retention, 3 users |
| Supabase Metrics API | **$0** | Included with Supabase; no additional charge |
| Custom Edge Function | **$0** | Included in Supabase free Edge Function quota (500K invocations/mo). At 5-min scrape interval = ~8,640 invocations/mo, well within limits |
| **Total** | **$0** | No additional costs |

If you outgrow Grafana Cloud's free tier (unlikely with current scale), paid plans start at ~$29/mo.

---

## Reference Material

### Supabase Documentation
- Metrics API: https://supabase.com/docs/guides/telemetry/metrics
- Blog post: https://supabase.com/blog/metrics-api-observability
- Grafana integration: https://supabase.com/docs/guides/telemetry/metrics/grafana-cloud
- Supabase Grafana dashboard repo: https://github.com/supabase/supabase-grafana

### Grafana Cloud
- Sign-up: https://grafana.com/products/cloud/
- Free tier details: https://grafana.com/pricing/

### Key Endpoints

| Endpoint | Purpose | Auth |
|---|---|---|
| `https://<project-ref>.supabase.co/customer/v1/privileged/metrics` | Infra metrics (Prometheus) | HTTP Basic: `service_role` / `sb_secret_...` |
| `https://<project-ref>.supabase.co/functions/v1/metrics` | App metrics (Prometheus) | Bearer token (`METRICS_EXPORTER_TOKEN`) |

### Prometheus Text Format Reference
- Gauge: `metric_name{label="value"} 42`
- Counter: `metric_name{label="value"} 1337`
- Timestamp: `metric_name{label="value"} 42 1690900000` (optional, epoch seconds)
- Newline-separated, `\n\n` between metric families

### Related Roam Files
- `web/src/app/admin/actions.ts` — Current admin data fetching
- `web/src/app/admin/views/AdminAnalytics.tsx` — Current analytics UI
- `supabase/functions/` — Existing Edge Functions for reference
- `supabase/migrations/20260718000001_report_materialized_views.sql` — Materialized views
- `supabase/config.toml` — Pool configuration

---

## Appendix: Quick-Start Checklist

- [ ] Find Supabase project reference from dashboard URL
- [ ] Create/verify Secret API key (`sb_secret_...`) in Project Settings → API Keys
- [ ] Sign up for Grafana Cloud free tier
- [ ] Configure Prometheus scrape config pointing at Supabase Metrics endpoint
- [ ] Verify metrics are flowing in Grafana Explorer
- [ ] Import Supabase dashboard JSON from supabase-grafana repo
- [ ] Observe for 1 week — document CPU, IO, connection patterns
- [ ] Identify resource culprits based on observed data
- [ ] (Phase 3) Create `supabase/functions/metrics/index.ts`
- [ ] (Phase 3) Create `queue_stats_summary` and `dead_by_category_summary` RPCs
- [ ] (Phase 3) Deploy Edge Function with `METRICS_EXPORTER_TOKEN`
- [ ] (Phase 3) Add scrape config for app metrics (5-min interval)
- [ ] (Phase 4) Build unified Grafana dashboard panels
- [ ] (Phase 4) Configure AlertManager rules
- [ ] (Phase 4) Set up Slack/email notification channels