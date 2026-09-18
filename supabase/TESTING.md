# Roam Supabase Backend — Testing Guide

This guide covers the quickest checks for migrations, Edge Functions, and data access.

## 1. Migrations

Preview migrations before applying them.

```bash
cd supabase
supabase db push --dry-run
supabase migration list
```

Check that:
- New tables enable RLS.
- Policies match the intended ownership model.
- No migration introduces an unexpected privilege path.

## 2. Edge Functions

Run the functions locally or deploy to a branch before touching production.

```bash
supabase functions deploy roam
supabase functions deploy rate
supabase functions deploy submit-url
```

Validate:
- Auth checks happen before sensitive reads or writes.
- Error responses are handled gracefully.
- Function logs do not leak secrets.

## 3. API smoke tests

- Call `roam()` with a valid JWT and confirm a URL returns.
- Call `rate` with an invalid token and confirm rejection.
- Call `submit-url` with a known unsafe URL and confirm rejection.

## 4. RLS checks

- Confirm users can only read or mutate their own rows.
- Confirm admin-only paths reject non-admin accounts.
- Confirm private collections stay private unless explicitly shared.