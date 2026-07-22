---
name: sentry-cli
description: "Interact with Sentry via the CLI. Use when: listing or resolving issues, managing releases, uploading source maps. For richer issue data, prefer the sentry-fetch-issues skill (REST API)."
argument-hint: "<command>: issues list, releases new, sourcemaps upload, issues resolve"
---

# Skill: Sentry CLI

**Binary:** located via `$env:USERPROFILE\AppData\Roaming\npm\sentry-cli.cmd`
**Version:** 3.4.3
**Org/Project:** See `copilot-instructions.md` Sentry section.
**Token:** stored in `android/local.properties` as `SENTRY_AUTH_TOKEN` — load securely, never echo.

The `sentry-cli.cmd` binary is not on PATH in VS Code terminal — always use the full path.

---

## Auth

Load token for a session:

```powershell
$token = (Get-Content android\local.properties | Select-String 'SENTRY_AUTH_TOKEN=(.+)').Matches.Groups[1].Value
```

Or configure globally (persists to `~/.sentryclirc`):

```powershell
$sentryCli = "$env:USERPROFILE\AppData\Roaming\npm\sentry-cli.cmd"
& $sentryCli login
```

---

## Issues

List unresolved issues:

```powershell
$token = (Get-Content android\local.properties | Select-String 'SENTRY_AUTH_TOKEN=(.+)').Matches.Groups[1].Value
$sentryCli = "$env:USERPROFILE\AppData\Roaming\npm\sentry-cli.cmd"
# Org and project slugs — see copilot-instructions.md Sentry section
& $sentryCli --auth-token $token issues list --org <ORG_SLUG> --project <PROJECT_SLUG>
```

> For richer output (id, title, count, level, lastSeen), the REST API in PowerShell is more convenient — see the `sentry-fetch-issues` skill or the Sentry section in `copilot-instructions.md`.

---

## Releases

Create a release and associate commits (run from repo root):

```powershell
$token = (Get-Content android\local.properties | Select-String 'SENTRY_AUTH_TOKEN=(.+)').Matches.Groups[1].Value
$sentryCli = "$env:USERPROFILE\AppData\Roaming\npm\sentry-cli.cmd"
$version = "<PROJECT_SLUG>@<versionName>"  # e.g. roam-android@1.0.0

& $sentryCli --auth-token $token releases --org <ORG_SLUG> new $version
& $sentryCli --auth-token $token releases --org <ORG_SLUG> set-commits $version --auto
& $sentryCli --auth-token $token releases --org <ORG_SLUG> finalize $version
```

> In practice the Android Gradle plugin (`io.sentry.android.gradle`) creates releases and uploads ProGuard mappings automatically on every build — you rarely need to do this manually.

---

## Source Maps (Web)

Upload source maps for a Next.js build (run from `web/`):

```powershell
$token = (Get-Content ..\android\local.properties | Select-String 'SENTRY_AUTH_TOKEN=(.+)').Matches.Groups[1].Value
$sentryCli = "$env:USERPROFILE\AppData\Roaming\npm\sentry-cli.cmd"

& $sentryCli --auth-token $token sourcemaps upload `
  --org <ORG_SLUG> --project <WEB_PROJECT_SLUG> `
  .next/static/chunks
```

---

## Resolve / Unresolve Issues via CLI

```powershell
$token = (Get-Content android\local.properties | Select-String 'SENTRY_AUTH_TOKEN=(.+)').Matches.Groups[1].Value
$sentryCli = "$env:USERPROFILE\AppData\Roaming\npm\sentry-cli.cmd"

# Resolve by issue ID
& $sentryCli --auth-token $token issues resolve --org <ORG_SLUG> <ISSUE_ID>
```

> The REST API is simpler for bulk operations — see `copilot-instructions.md` for the PowerShell `Invoke-RestMethod` patterns.

---

## Notes

- The Sentry Gradle plugin handles source map uploads and release creation automatically for Android — only use the CLI for manual overrides.
- The web Sentry project may not exist yet; Sentry is only confirmed integrated on Android.
- `sentry-cli.cmd` requires `--auth-token` on every command unless `~/.sentryclirc` is configured.