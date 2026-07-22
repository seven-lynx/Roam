---
name: supabase-logs
description: "Fetch and analyze Supabase project logs (Edge Functions, Postgres, Auth, API) via Management REST API. Use when: investigating Supabase errors/warnings, debugging Edge Function failures, checking Postgres query errors, diagnosing RLS violations, or monitoring Auth issues. Project ref: yrhckctwtdjowulfuaqc."
argument-hint: "<command>: edge-logs, db-logs, auth-logs, all-logs, fn-invoke <name>"
---

# Skill: Fetch & Analyze Supabase Logs

**Project:** Roam
**Project Ref:** `yrhckctwtdjowulfuaqc`
**API Base:** `https://api.supabase.com`
**Token:** stored in `.env` as `SUPABASE_ACCESS_TOKEN` — load securely, never echo.
**Token scopes needed:** `Read` on API, Database, Functions, Auth

Generate token at: `https://app.supabase.com/account/tokens`

---

## 0. Token Loading

```powershell
$token = (Get-Content .env | Select-String 'SUPABASE_ACCESS_TOKEN=(.+)').Matches.Groups[1].Value
$headers = @{Authorization="Bearer $token"}
$ref = "yrhckctwtdjowulfuaqc"
```

---

## 1. Edge Function Logs

### 1a. List all Edge Functions

```powershell
Invoke-RestMethod "https://api.supabase.com/v1/projects/$ref/functions" -Headers $headers |
  ForEach-Object { "$($_.slug) — $($_.status) — $($_.version)" }
```

### 1b. Edge Function logs via CLI (primary method)

```powershell
# All Edge Function logs (last 24h), filtered to errors/warnings
npx supabase functions logs --project-ref $ref --limit 200 2>&1 | Select-String "error|warn|ERROR|WARN|fail|crash|timeout|5\d\d"

# Specific function logs (last 1h)
$fn = "<FN_SLUG>"
npx supabase functions logs $fn --project-ref $ref --since 1h --limit 50 2>&1
```

### 1c. Known function slugs

| Slug | Purpose |
|------|---------|
| `roam` | Main API endpoint |
| `save-url` | Save a URL for a user |
| `submit-url` | Submit/import a URL |
| `push-notify` | Push notification sender |
| `follow` | Follow/unfollow users |
| `profile` | User profile operations |
| `collection` | Collection CRUD |
| `leaderboard` | Leaderboard queries |
| `send-bulk-email` | Bulk email sending |
| `beta-signup` | Beta signup handler |

---

## 2. Postgres Database Logs (Management API)

### 2a. Fetch recent database errors

```powershell
$r = Invoke-WebRequest "https://api.supabase.com/v1/projects/$ref/analytics/logs?log_type=db&limit=100&severity=error" -Headers $headers -UseBasicParsing
$r.Content | Out-File "$env:TEMP\supabase_db_logs.json" -Encoding utf8
```

### 2b. Parse Postgres logs

```powershell
$raw = Get-Content "$env:TEMP\supabase_db_logs.json" -Raw

# RLS violations
[regex]::Matches($raw, '"message"\s*:\s*"([^"]{0,100}new row violates[^"]{0,200})"') | ForEach-Object { "RLS: $($_.Groups[1].Value)" }

# Constraint violations
[regex]::Matches($raw, '"message"\s*:\s*"([^"]{0,100}violates[^"]{0,200})"') | ForEach-Object { "Constraint: $($_.Groups[1].Value)" }

# Permission denied
[regex]::Matches($raw, '"message"\s*:\s*"([^"]{0,100}permission denied[^"]{0,200})"') | ForEach-Object { "Perm: $($_.Groups[1].Value)" }

# All error/warning messages (catch-all)
[regex]::Matches($raw, '"message"\s*:\s*"((?:[^"\\]|\\"){3,500})"') | ForEach-Object {
  $msg = $_.Groups[1].Value -replace '\\"', '"'
  if ($msg -match 'error|Error|ERROR|violates|permission|denied|fail|WARN|warn') { "LOG: $msg" }
}
```

---

## 3. Auth Logs (Management API)

### 3a. Fetch auth errors

```powershell
$r = Invoke-WebRequest "https://api.supabase.com/v1/projects/$ref/analytics/logs?log_type=auth&limit=50&severity=error" -Headers $headers -UseBasicParsing
$r.Content | Out-File "$env:TEMP\supabase_auth_logs.json" -Encoding utf8
```

### 3b. Parse auth logs

```powershell
$raw = Get-Content "$env:TEMP\supabase_auth_logs.json" -Raw
[regex]::Matches($raw, '"message"\s*:\s*"([^"]{1,500})"') | ForEach-Object {
  $msg = $_.Groups[1].Value
  if ($msg -match 'error|Error|fail|denied|invalid') { "AuthErr: $msg" }
}
```

---

## 4. Combined "All Errors" Quick Scan

```powershell
$token = (Get-Content .env | Select-String 'SUPABASE_ACCESS_TOKEN=(.+)').Matches.Groups[1].Value
$headers = @{Authorization="Bearer $token"}
$ref = "yrhckctwtdjowulfuaqc"

Write-Host "=== EDGE FUNCTIONS (last 2h errors) ===" -ForegroundColor Yellow
npx supabase functions logs --project-ref $ref --since 2h --limit 100 2>&1 | Select-String "error|Error|ERROR|fail|crash|timeout|5\d\d" | Select-Object -First 20

Write-Host "`n=== POSTGRES ERRORS ===" -ForegroundColor Yellow
$r = Invoke-WebRequest "https://api.supabase.com/v1/projects/$ref/analytics/logs?log_type=db&limit=30&severity=error" -Headers $headers -UseBasicParsing
$r.Content | Out-File "$env:TEMP\supa_errors.json" -Encoding utf8
$raw = Get-Content "$env:TEMP\supa_errors.json" -Raw
[regex]::Matches($raw, '"message"\s*:\s*"((?:[^"\\]|\\"){3,500})"') | ForEach-Object {
  $msg = $_.Groups[1].Value -replace '\\"', '"'
  if ($msg -match 'error|Error|violates|permission|fail|5\d{4}') { "PG: $msg" }
} | Select-Object -First 20

Write-Host "`n=== AUTH ERRORS ===" -ForegroundColor Yellow
$r = Invoke-WebRequest "https://api.supabase.com/v1/projects/$ref/analytics/logs?log_type=auth&limit=15&severity=error" -Headers $headers -UseBasicParsing
$r.Content | Out-File "$env:TEMP\supa_auth.json" -Encoding utf8
$raw = Get-Content "$env:TEMP\supa_auth.json" -Raw
[regex]::Matches($raw, '"message"\s*:\s*"([^"]{1,500})"') | ForEach-Object {
  $msg = $_.Groups[1].Value
  if ($msg -match 'error|Error|fail|denied|invalid|rate|limit') { "Auth: $msg" }
} | Select-Object -First 15
```

---

## 5. Common Error Patterns & Diagnosis

| Pattern | Likely Cause | Where to Fix |
|---------|-------------|-------------|
| `new row violates row-level security policy` | Missing/incorrect RLS policy | Check migration for the table mentioned |
| `violates foreign key constraint` | Missing parent row | Function logic inserting orphan rows |
| `violates not-null constraint` | Missing required field | Function not providing a required column |
| `duplicate key value violates` | Unique constraint conflict | Upsert logic or missing ON CONFLICT |
| `function execution timed out` | Slow function (>30s default) | Optimize function or increase timeout in config.toml |
| `JWT expired` / `token_not_found` | Stale client session | Client-side token refresh |
| `rate limit exceeded` | Too many API calls | Add backoff/batching |
| `5xx` HTTP status | Function crash/unhandled error | Check function for uncaught promises/exceptions |

---

## 6. Time-Filtered Queries

All analytics endpoints accept:
- `?since=1h` or `?since=2026-07-07T12:00:00Z`
- `?until=2026-07-07T20:00:00Z`
- `&severity=error` (error, warning, info, debug)
- `&limit=100` (max results)

---

## Notes

- Token needs `Read` scope on API, Functions, Database, Auth
- Management API rate limits — add `Start-Sleep -Seconds 1` between batched calls
- PowerShell `ConvertFrom-Json` may fail on deep responses — use regex parsing above
- For Edge Function logs, `npx supabase functions logs` via CLI is more reliable than the Management API
- Log retention: Free 1 day, Pro 7 days, Team+ 28 days