# Roam Supabase Backend

Roam's backend runs on Supabase and provides authentication, the PostgreSQL schema, Row-Level Security, and the Edge Functions that power discovery, ratings, submissions, collections, follows, profiles, feedback, and moderation.

## What lives here

- `migrations/` — schema changes and RLS policies (142 migration files)
- `functions/` — 22 Deno Edge Functions
- `config.toml` — Supabase project configuration

## Current responsibilities

- Serve the discovery RPC that the app clients call to get a URL
- 22 Deno Edge Functions for complex operations: `roam`, `rate`, `submit-url`, `save-url`, `collection`, `follow`, `profile`, `feedback`, `report-url`, `log-failed-urls`, `leaderboard`, `share-url`, `delete-user`, `export-user`, `beta-signup`, `send-bulk-email`, `push-notify`, `activity-feed`, `admin-moderation`, `cron-streak-cleanup`, `report-engagement`, `scrape-url`
- Persist users, URLs, ratings, collections, follows, saved URLs, push tokens, notifications, and moderation data
- Enforce access control with RLS instead of client-side trust
- Keep the public HTTP API documented: see [docs/API.md](../docs/API.md)

## Working on the backend

- Add schema changes as migrations in `migrations/`
- Keep Edge Function input validation strict and explicit
- Update [docs/API.md](../docs/API.md) when request or response shapes change
- Use `supabase db push` to apply migrations; `supabase functions deploy <name>` to deploy functions

## Useful references

- [API reference](../docs/API.md) — full request/response contracts for all functions
- [ROADMAP](../docs/ROADMAP.md) — build history and upcoming work
- [CONTEXT](../docs/CONTEXT.md) — current-state briefing and architectural decisions
- [Main project README](../README.md) — architecture overview and development setup