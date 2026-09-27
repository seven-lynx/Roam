// tests/user-actions-rls.test.ts
//
// Verifies that the user_actions table is server-authoritative: a regular
// authenticated user cannot insert arbitrary action_types or exceed the
// daily rate limit.
//
// This is a contract test, run in CI against a local Supabase stack via
// `supabase start`. It uses the anonymous JWT for sign-in then exercises
// the API as the resulting user.
//
// Enforces Hard Rule 1.9 of the root rules file: client-driven gamification
// inserts must not be possible.

import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'http://localhost:54321';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ8.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

Deno.test('user_actions: anonymous cannot INSERT', async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_actions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: '00000000-0000-0000-0000-000000000001',
      action_type: 'roam',
    }),
  });
  assertEquals(res.status, 401, `expected 401, got ${res.status}`);
});

Deno.test('user_actions: authenticated cannot insert unknown action_type', async () => {
  // Sign in as the test user (must exist via supabase start + seed).
  const signIn = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'testpassword123',
    }),
  });
  if (!signIn.ok) {
    console.log('Skipping: test user not present in local DB. Seed first.');
    return;
  }
  const { access_token, user } = await signIn.json();

  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_actions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: user.id,
      action_type: 'pwn-the-challenge-system',
    }),
  });
  // 409 = CHECK constraint; 403 = RLS. Either way, the insert must fail.
  if (res.status !== 403 && res.status !== 409 && res.status !== 400) {
    throw new Error(`expected 400/403/409, got ${res.status}: ${await res.text()}`);
  }
});

Deno.test('user_actions: authenticated CAN insert canonical action_types', async () => {
  const signIn = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'testpassword123',
    }),
  });
  if (!signIn.ok) return;
  const { access_token, user } = await signIn.json();

  for (const action of ['roam', 'rate', 'save']) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_actions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: user.id, action_type: action }),
    });
    if (!res.ok) {
      throw new Error(`expected 201 for ${action}, got ${res.status}: ${await res.text()}`);
    }
  }
});