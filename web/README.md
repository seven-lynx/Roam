# Roam Web Platform

The Next.js 16 web application for Roam. The web surface is the account-management hub: onboarding, auth, profile, settings, privacy/terms, collections, public profiles, and the admin moderation area.

## Tech Stack

- **Next.js 16** with App Router
- **React 19** for UI components
- **TypeScript 5** for type safety
- **Tailwind CSS 4** for styling
- **Supabase SSR client** for authentication and data access
- **next-themes** for dark mode
- **Jest 29.7.0** for testing
- **Sentry** for error tracking
- **Vercel** for deployment

## Features

### Onboarding
- **Create account** — Google OAuth, GitHub OAuth, or email/password
- **Pick interests** — select categories you care about (pillar or topic mode)
- **Email verification** — confirmation flow for email sign-up

### Account hub
- **Profile** — view and edit public profile details, manage collections and saved URLs
- **Settings** — discovery mode, email notifications, appearance (light/dark/system), change password, data export, account deletion
- **Password reset** — request and complete password changes via `/forgot-password` and `/auth/reset-password`

### Social & Gamification
- **Public profiles** (`/u/[username]`) — view user profiles with activity, collections, badges, and XP
- **Collections** (`/collections/[slug]`) — public collection browsing
- **Follow/unfollow** — manage follows from profile pages
- **Leaderboard** (`/leaderboard`) — weekly, monthly, and all-time XP rankings
- **Badge gallery** (`/badges`) — 70+ badges with unlock details and progress tracking

### Admin
- **Moderation queue** — review and approve/reject submissions with detail view, filtering, search, sort
- **Undo decisions** — re-open previously decided items
- **Dashboard statistics** — 15 stat cards (content, engagement, users) with request-time caching
- **Dead links tab** — review user-reported broken links

### Other
- **URL submission** (`/submit`) — submit new URLs for moderation
- **How It Works** (`/how-it-works`) — product tour
- **Android Beta** (`/android-beta`) — beta tester sign-up
- **Privacy / Terms** — public legal pages

## Route Map

| Route | Type | Auth required | Purpose |
|---|---|---|---|
| `/` | Server Component | No | Landing page |
| `/join` | Client Component | No | Create account / sign in (tabbed OAuth + email) |
| `/signup` | Client Component | No | Alternative sign-up entry point |
| `/auth/callback` | Route handler | No | OAuth code exchange + routing |
| `/auth/verify-email` | Client Component | No | Email confirmation screen with resend |
| `/forgot-password` | Client Component | No | Request password reset email |
| `/auth/reset-password` | Client Component | No | Set new password from email link |
| `/u/[username]` | Server Component | No | Public user profile + activity |
| `/collections/[slug]` | Server Component | No | Public collection view |
| `/collections` | Client Component | No | Browse all public collections |
| `/leaderboard` | Client Component | No | Weekly, monthly, and all-time XP rankings |
| `/badges` | Client Component | No | Badge gallery with unlock details |
| `/submit` | Client Component | No | Submit new URL for moderation |
| `/profile` | Server shell + Client island | Yes | View / edit profile, collections, and saved URLs |
| `/settings` | Client Component | Yes | Preferences and account controls |
| `/admin` | Server shell + Client Component | Yes (admin role) | Moderation queue + analytics |
| `/how-it-works` | Server Component | No | Product overview and features |
| `/android-beta` | Client Component | No | Android beta sign-up page |
| `/forgot-password` | Client Component | No | Request password reset email |
| `/privacy` | Server Component | No | Privacy policy |
| `/terms` | Server Component | No | Terms of service |
| `/api/unsubscribe` | Route handler | No | Email notification unsubscribe |

## Development Setup

### Prerequisites
- Node.js 20+ and pnpm 10+
- `.env.local` file with required variables (see below)

### Environment Variables

Create `.env.local` in the `web/` directory:

```
NEXT_PUBLIC_SUPABASE_URL=https://<YOUR_PROJECT>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_SENTRY_DSN=https://...@...ingest.us.sentry.io/...
SENTRY_AUTH_TOKEN=your_sentry_auth_token  # Server-side only. Required in Vercel for @sentry/nextjs source map uploads
```

### Install & Run

```bash
cd web

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open http://localhost:3000
```

The server hot-reloads as you edit files.

## Project Structure

```
web/
├── src/
│   ├── app/               # Next.js App Router pages and layouts
│   │   ├── admin/         # Admin moderation dashboard (protected)
│   │   ├── api/           # API route handlers
│   │   ├── auth/          # OAuth callback, verify-email, reset-password
│   │   ├── badges/        # Badge gallery with unlock details
│   │   ├── collections/   # Public collection listing + [slug] detail
│   │   ├── error.tsx      # Global error boundary
│   │   ├── forgot-password/
│   │   ├── how-it-works/  # Product tour
│   │   ├── privacy/       # Privacy Policy
│   │   ├── profile/       # Profile view + edit (protected)
│   │   ├── settings/      # User account settings (protected)
│   │   ├── signup/        # Alternative sign-up flow
│   │   ├── submit/        # URL submission
│   │   ├── terms/         # Terms of Service
│   │   ├── u/             # Public user profiles ([username])
│   │   └── android-beta/  # Beta program sign-up
│   ├── components/        # Reusable React components
│   │   ├── Header.tsx     # Navigation header (server component)
│   │   ├── Footer.tsx     # Site footer
│   │   ├── ErrorBoundary.tsx
│   │   ├── FeedbackWidget.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── supabase/      # Supabase client factories
│   │   │   ├── client.ts  # Client-side Supabase instance
│   │   │   ├── server.ts  # Server-side Supabase instance
│   │   │   └── shared.ts  # Shared validation
│   │   ├── env.ts         # Environment variable validation
│   │   ├── hooks.ts       # Shared React hooks
│   │   ├── logger.ts      # Structured logging + Sentry
│   │   ├── constants.ts   # Shared constants
│   │   └── interests.ts   # Interest/category utilities
│   ├── globals.css        # Tailwind CSS imports
│   └── layout.tsx         # Root layout with ThemeProvider + ErrorBoundary
├── public/                # Static assets (logos, icons)
├── jest.config.js         # Jest testing configuration
├── jest.setup.js          # Test environment setup
├── next.config.ts         # Next.js configuration (with Sentry)
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies
```

## Key Files

### Authentication & Data
- **`src/lib/supabase/client.ts`** — Creates Supabase client for browser (persistent session, auto-refresh)
- **`src/lib/supabase/server.ts`** — Creates Supabase client for server components (request-scoped)
- **`src/lib/supabase/shared.ts`** — Shared env var validation for both clients

### Pages
- **`src/app/admin/page.tsx`** — Server-side auth check, redirects non-admins
- **`src/app/admin/AdminPageClient.tsx`** — Client-side queue UI with filtering, search, sorting, tabs
- **`src/app/admin/ModerationDetail.tsx`** — Modal for detailed submission review and undo
- **`src/app/layout.tsx`** — Root layout wrapping all pages with ErrorBoundary and ThemeProvider
- **`src/app/profile/page.tsx`** — Server shell with parallel data fetch, hands off to ProfileClient
- **`src/app/auth/callback/route.ts`** — OAuth code exchange, routes new vs returning users

### Utilities
- **`src/lib/env.ts`** — Validates NEXT_PUBLIC_* env vars at module import time
- **`src/components/ErrorBoundary.tsx`** — React class component catching render-time errors
- **`src/lib/logger.ts`** — Structured logging with Sentry integration and PII sanitization

## Common Tasks

### Add a New Page
1. Create folder in `src/app/` (e.g., `my-page/`)
2. Add `page.tsx` with Server or Client Component
3. If it needs auth, check user in server component and redirect
4. For client interactivity, create a separate Client Component file

### Query Data
```typescript
// Browser (client.ts)
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
const { data, error } = await supabase
  .from('urls')
  .select('*')
  .limit(10);

// Server (server.ts)
import { createClient } from '@/lib/supabase/server';
const supabase = await createClient();
const { data, error } = await supabase
  .from('urls')
  .select('*')
  .limit(10);
```

### Add a Component
1. Create `.tsx` file in `src/components/`
2. Add `'use client'` directive if it uses browser APIs or hooks
3. Import in page files as needed

### Test
```bash
pnpm test          # Run all tests (watch mode)
pnpm test:ci       # CI mode (coverage + no-watch)
pnpm test --coverage
```

## Debugging

### Check Environment Variables
```bash
# In browser console (development only):
window.__env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '***' // masked for security
}
```

### View Database Queries
Supabase client logs queries to console in development mode. Check Network tab for real-time updates via PostgREST.

### Error Boundaries
If a component render fails, the ErrorBoundary catches it and shows a fallback UI instead of a blank page. Check browser console for the actual error.

## Testing

### Run Tests
```bash
pnpm test
```

### Add a Test
Create a `.test.ts` or `.test.tsx` file next to the code you want to test. Jest will automatically discover it.

```typescript
// Example: src/lib/utils.test.ts
import { myFunction } from './utils';

describe('myFunction', () => {
  it('should do something', () => {
    expect(myFunction()).toEqual('expected');
  });
});
```

## Deployment

Deployed automatically to Vercel on every push to `main` branch.

### Before deploying:
1. Ensure all tests pass: `pnpm test:ci`
2. Check for TypeScript errors: `pnpm tsc --noEmit`
3. Review your changes: `git diff origin/main`

### Vercel environment variables:
Set these in the Vercel dashboard for the production deployment:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` (for source maps)

## Troubleshooting

### Port 3000 already in use
```powershell
# Windows: Find and kill the process on port 3000
netstat -ano | findstr :3000
# Take the PID from the output, then:
taskkill /PID <PID> /F

# Or use a different port:
pnpm dev -- -p 3001
```

### Supabase connection errors
1. Check `.env.local` has correct URL and key
2. Verify network connectivity
3. Check Supabase project status at supabase.com/dashboard

### 404 errors
- Check the page file exists in `src/app/`
- Remember Next.js folder names create the URL path
- Restart dev server after adding new pages

### Module not found errors
- Check import paths use `@/` aliases (defined in `tsconfig.json`)
- Clear `.next` cache and restart:
  - **Windows:** `rmdir /s /q .next && pnpm dev`
  - **macOS/Linux:** `rm -rf .next && pnpm dev`

## Further Reading

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Sentry for JavaScript](https://docs.sentry.io/platforms/javascript/)
- [Main project README](../README.md) — architecture overview