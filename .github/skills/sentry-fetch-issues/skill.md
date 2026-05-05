# Skill: Fetch & Diagnose Sentry Issues

**Project:** Roam Android  
**Org slug:** `7-lynx` | **Project slug:** `roam-android`  
**Token:** stored in `local.properties` as `SENTRY_AUTH_TOKEN`

---

## 1. Pull unresolved issues

```powershell
$t = (Get-Content .\local.properties | Select-String 'SENTRY_AUTH_TOKEN=(.+)').Matches.Groups[1].Value
$h = @{Authorization="Bearer $t"}
Invoke-RestMethod "https://us.sentry.io/api/0/projects/7-lynx/roam-android/issues/?query=is:unresolved&limit=25" -Headers $h |
  ForEach-Object { "$($_.shortId) [$($_.level)] x$($_.count) last:$($_.lastSeen) — $($_.title)" }
```

Output includes numeric `id` (e.g. `7456531621`) needed for step 2.

---

## 2. Fetch latest event for an issue

```powershell
$r = Invoke-WebRequest "https://us.sentry.io/api/0/issues/<NUMERIC_ID>/events/latest/" -Headers $h -UseBasicParsing
$r.Content | Out-File "$env:TEMP\sentry_event.json" -Encoding utf8
```

---

## 3. Parse the event (use regex — NOT ConvertFrom-Json)

> PowerShell 5.1's `ConvertFrom-Json` silently fails on deep Sentry JSON. Use regex on the raw string.

```powershell
$raw = Get-Content "$env:TEMP\sentry_event.json" -Raw

# Exception type & message
[regex]::Matches($raw, '"type"\s*:\s*"([^"]+)"')        | Select-Object -First 3 | ForEach-Object { "Type:   $($_.Groups[1].Value)" }
[regex]::Matches($raw, '"value"\s*:\s*"([^"]{1,300})"') | Select-Object -First 3 | ForEach-Object { "Value:  $($_.Groups[1].Value)" }

# HTTP details
[regex]::Matches($raw, '"url"\s*:\s*"([^"]+supabase[^"]+)"') | Select-Object -First 3 | ForEach-Object { "URL:    $($_.Groups[1].Value)" }
[regex]::Matches($raw, '"status_code"\s*:\s*(\d+)')           | Select-Object -First 5 | ForEach-Object { "Status: $($_.Groups[1].Value)" }

# Stack frames (last 10 function names)
[regex]::Matches($raw, '"function"\s*:\s*"([^"]+)"') | Select-Object -Last 10 | ForEach-Object { "  $($_.Groups[1].Value)" }
```

---

## 4. Resolve an issue

```powershell
Invoke-RestMethod "https://us.sentry.io/api/0/issues/<NUMERIC_ID>/" -Method Put `
  -Headers $h -Body '{"status":"resolved"}' -ContentType "application/json"
```

---

## Notes

- Token needs scopes: `event:read`, `project:read`, `org:read`
- Numeric issue IDs come from the list in step 1 (`.id` field, not `.shortId`)
- All endpoints use `https://us.sentry.io` (US region, per token payload)

