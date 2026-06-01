# Roam Supabase Backend

Roam’s backend runs on Supabase and provides authentication, the PostgreSQL schema, Row-Level Security, and the Edge Functions that power discovery, ratings, submissions, collections, follows, profiles, feedback, and moderation.

## What lives here

- `migrations/` — schema changes and RLS policies
- `functions/` — Deno Edge Functions
- `API.md` — current function and RPC contracts
- `TESTING.md` — migration, function, and RLS verification steps

## Current responsibilities

- Serve the discovery RPC that the app clients call to get a URL
- Persist users, URLs, ratings, collections, follows, and moderation data
- Enforce access control with RLS instead of client-side trust
- Keep the public HTTP API documented in one place: [API.md](API.md)

## Working on the backend

- Add schema changes as migrations in `migrations/`
- Keep Edge Function input validation strict and explicit
- Update [API.md](API.md) when request or response shapes change
- Use [TESTING.md](TESTING.md) before shipping migrations or function changes

## Useful references

- [API reference](API.md)
- [Backend testing guide](TESTING.md)
- [Main project README](../README.md)
