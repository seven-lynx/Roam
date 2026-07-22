---
name: vercel-cli
description: "Interact with Vercel via the CLI. Use when: tailing runtime logs, listing/inspecting deployments, managing environment variables. Production deploys go via git push — never use 'vercel deploy' for production."
argument-hint: "<command>: logs, ls, inspect, env ls, env pull, env add"
---

# Skill: Vercel CLI

**Binary:** located via `$env:USERPROFILE\AppData\Roaming\npm\vercel.cmd`
**Version:** 54.6.1
**Project:** See `copilot-instructions.md` Vercel section for project name and identifiers.
**Token:** stored in `web/.env.local` as `VERCEL_TOKEN` — load securely, never echo.

The `vercel.cmd` binary is not on PATH in VS Code terminal — always use the full path.

---

## Auth

The CLI authenticates via token. Set it once per session:

```powershell
$env:VERCEL_TOKEN = (Get-Content web\.env.local | Select-String 'VERCEL_TOKEN=(.+)').Matches.Groups[1].Value
```

Or pass `--token $env:VERCEL_TOKEN` explicitly on each command.

---

## Runtime Logs (most useful feature)

Tail live logs from the production deployment — far better than the SSE API:

```powershell
$env:VERCEL_TOKEN = (Get-Content web\.env.local | Select-String 'VERCEL_TOKEN=(.+)').Matches.Groups[1].Value
$vercelCli = "$env:USERPROFILE\AppData\Roaming\npm\vercel.cmd"
# Project name — see copilot-instructions.md Vercel section
& $vercelCli logs --token $env:VERCEL_TOKEN --follow <PROJECT_NAME>
```

Show logs for a specific deployment:

```powershell
& $vercelCli logs --token $env:VERCEL_TOKEN <deployment-url>
```

---

## Deployments

List recent deployments:

```powershell
& $vercelCli ls --token $env:VERCEL_TOKEN <PROJECT_NAME>
```

Inspect a specific deployment:

```powershell
& $vercelCli inspect --token $env:VERCEL_TOKEN <deployment-url>
```

---

## Environment Variables

List all env vars for the project:

```powershell
& $vercelCli env ls --token $env:VERCEL_TOKEN
```

Pull env vars to a local file (does NOT reveal secret values — use for key names only):

```powershell
& $vercelCli env pull --token $env:VERCEL_TOKEN web\.env.vercel
```

Add a new env var:

```powershell
& $vercelCli env add KEY_NAME production --token $env:VERCEL_TOKEN
# Prompts for value interactively
```

---

## Notes

- **Normal deploys go via `git push`** — don't use `vercel deploy` for production.
- Logs via `--follow` only stream from connection time onward; use Vercel dashboard for historical logs.
- The token in `web/.env.local` is `VERCEL_TOKEN=vcp_...` — never commit this file.