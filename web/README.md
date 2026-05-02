# Roam Web Platform

The Next.js 16 web application for Roam discovery. Provides user accounts, interest management, discovery interface, URL submissions, and admin moderation dashboard.

## Tech Stack

- **Next.js 16** with App Router
- **React 19** for UI components
- **TypeScript 5** for type safety
- **Tailwind CSS 4** for styling
- **Supabase SSR client** for authentication and data access
- **Jest 29.7.0** for testing
- **Sentry** for error tracking
- **Vercel** for deployment

## Features

### Core Discovery
- **Roam button** — get a random page matched to your interests
- **Interest categories** — select and manage your topic preferences
- **Community voting** — rate pages with thumbs up/down
- **Collections** — save pages to public or private collections
- **User profiles** — view your stats and public profile

### Account Management
- **Authentication** — email/password or Google OAuth
- **Interest profile** — customize what you discover
- **Account settings** — manage auth, privacy, notifications
- **Following** — follow other users and see their activity
- **Activity history** — track pages you've rated

### Admin Features
- **Moderation queue** — review and approve/reject URL submissions
- **Detail view** — full metadata with Safe Browsing check result
- **Undo capability** — reverse wrong decisions
- **Filtering & search** — find submissions by status, URL, title
- **Real-time updates** — instant queue refresh

## Development Setup

### Prerequisites
- Node.js 20+ and pnpm 10+
- .env.local file with required variables (see below)

### Environment Variables

Create `.env.local` in the `web/` directory:

```
NEXT_PUBLIC_SUPABASE_URL=https://yrhckctwtdjowulfuaqc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_HNqqRWeISKlQ6TRvOvsAAQ_MqEbP5ak
NEXT_PUBLIC_SENTRY_DSN=https://...@...ingest.us.sentry.io/...
SENTRY_AUTH_TOKEN=your_sentry_auth_token  # Only needed in Vercel for source map uploads
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
│   │   ├── dashboard/     # User discovery interface
│   │   ├── join/          # Signup page
│   │   ├── u/[username]/  # User profiles
│   │   ├── c/[slug]/      # Collection detail pages
│   │   ├── urls/          # Submitted URLs listing
│   │   ├── settings/      # User account settings
│   │   ├── privacy/       # Privacy Policy
│   │   └── terms/         # Terms of Service
│   ├── components/        # Reusable React components
│   │   └── ErrorBoundary.tsx  # Catches render-time errors
│   ├── lib/
│   │   ├── supabase/      # Supabase client factories
│   │   │   ├── client.ts  # Client-side Supabase instance
│   │   │   ├── server.ts  # Server-side Supabase instance
│   │   │   └── shared.ts  # Shared validation
│   │   └── env.ts         # Environment variable validation
│   ├── globals.css        # Tailwind CSS imports
│   └── layout.tsx         # Root layout with error boundary
├── public/                # Static assets (logos, icons)
├── .env.local            # Local environment variables (not committed)
├── jest.config.ts        # Jest testing configuration
├── next.config.ts        # Next.js configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies
```

## Key Files

### Authentication & Data
- **`src/lib/supabase/client.ts`** — Creates Supabase client for browser (persistent session, auto-refresh)
- **`src/lib/supabase/server.ts`** — Creates Supabase client for server components (request-scoped)
- **`src/lib/supabase/shared.ts`** — Shared env var validation for both clients

### Pages
- **`src/app/admin/page.tsx`** — Server-side auth check, redirects non-admins
- **`src/app/admin/AdminPageClient.tsx`** — Client-side queue UI with filtering, search, sorting
- **`src/app/admin/ModerationDetail.tsx`** — Modal for detailed submission review
- **`src/app/layout.tsx`** — Root layout wrapping all pages with ErrorBoundary

### Utilities
- **`src/lib/env.ts`** — Validates NEXT_PUBLIC_* env vars at module import time
- **`src/components/ErrorBoundary.tsx`** — React class component catching render-time errors

## Common Tasks

### Add a New Page
1. Create folder in `src/app/` (e.g., `my-page/`)
2. Add `page.tsx` with Server or Client Component
3. If it needs auth, check user in server component and redirect
4. For client interactivity, create a separate Client Component file

### Query Data
```typescript
// Browser (client.ts)
const supabase = createClient();
const { data, error } = await supabase
  .from('urls')
  .select('*')
  .limit(10);

// Server (server.ts)
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
pnpm test          # Run all tests
pnpm test --watch  # Watch mode
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
1. Ensure all tests pass: `pnpm test`
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
```bash
# Kill the process:
lsof -ti :3000 | xargs kill -9

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
- Clear `.next` cache: `rm -rf .next && pnpm dev`

## Further Reading

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Sentry for JavaScript](https://docs.sentry.io/platforms/javascript/)

