# RULES.md — Web Platform

Read `../RULES.md` first. This file adds web-specific rules.

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS 4
- `@supabase/ssr` with cookie-based sessions (client pattern in `web/src/lib/`)
- Jest + React Testing Library

## Hard rules (web-specific)

### W.1 Next.js 16 has breaking changes vs 14/15
Do not write Next.js code from memory. Check `node_modules/next/dist/docs/` for
current APIs and heed deprecation notices before writing any route, layout, or
data-fetching code.

### W.2 Middleware is `middleware.ts`, never `proxy.ts`
Next.js 16 reads `web/src/middleware.ts`. Do not reintroduce a `proxy.ts`.

### W.3 No duplicate component filenames
A file in `web/src/components/` must not share a name with a file under
`web/src/app/<route>/`. This caused the duplicate-`FollowButton` silent bug.

### W.4 RLS is the security boundary
Middleware redirects are UX, not security. The actual boundary is Supabase RLS.
Test policies with a real JWT in `web/src/__tests__/security.test.ts`.

## Conventions
- Server Components are the default; add `'use client'` only when needed.
- Auth uses `@supabase/ssr` — import clients from `web/src/lib/supabase/`.
- Tests are co-located in `__tests__/` and run with React Testing Library.
- Env validation lives in `web/src/lib/env.ts` — keep it in sync with the other
  four env schemas (see `../RULES.md` §3.2).
