---
name: supabase-cli
description: "Interact with Supabase via the CLI. Use when: pushing DB migrations, deploying Edge Functions, managing the local Supabase instance. Always use the scoop binary with --workdir; npx/PATH don't work reliably in VS Code."
argument-hint: "<command>: db push, functions deploy, db reset, migration new"
---

# Skill: Supabase CLI

**Binary:** located via `$env:USERPROFILE\scoop\shims\supabase.exe`
**Project ref:** found in `supabase/config.toml`

---

## Push Migrations

Push all pending migrations to the remote project:

```powershell
$supabase = "$env:USERPROFILE\scoop\shims\supabase.exe"
$repo = (Get-Location).Path
& $supabase db push --workdir $repo --yes
```

---

## Deploy Edge Functions

Deploy a single Edge Function:

```powershell
$supabase = "$env:USERPROFILE\scoop\shims\supabase.exe"
$repo = (Get-Location).Path
& $supabase functions deploy <function-name> --project-ref <PROJECT_REF> --workdir $repo
```

Deploy all Edge Functions:

```powershell
& $supabase functions deploy --project-ref <PROJECT_REF> --workdir $repo
```

---

## Create a New Migration

```powershell
$supabase = "$env:USERPROFILE\scoop\shims\supabase.exe"
$repo = (Get-Location).Path
& $supabase migration new <migration-name> --workdir $repo
```

Migrations are written to `supabase/migrations/` with a timestamp prefix. After editing the SQL, push with `db push`.

---

## Local Development

Start the local Supabase stack:

```powershell
$supabase = "$env:USERPROFILE\scoop\shims\supabase.exe"
$repo = (Get-Location).Path
& $supabase start --workdir $repo
```

Stop and reset the local database:

```powershell
& $supabase db reset --workdir $repo
```

---

## Notes

- Always use `--workdir` pointing to repo root — Supabase CLI resolves config and migrations from there.
- The project ref is in `supabase/config.toml` under `[project]` → `id`.
- Edge Functions run on Deno. Use `import` syntax, not `require`.
- All user-facing data access is gated by RLS policies. Do not bypass RLS.