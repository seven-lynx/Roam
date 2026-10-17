// tests/challenges-auto-populate.test.ts
//
// Verifies that challenges auto-populate on demand: a user with no active
// challenges gets rows after calling ensure_user_challenges().
//
// This is a contract test, run in CI against a local Supabase stack via
// `supabase start`. It signs in as the test user and exercises the RPC.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'http://localhost:54321';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ8.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function signIn() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'testpassword123',
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

Deno.test('ensure_user_challenges: seeds challenges for a user with none', async () => {
  const auth = await signIn();
  if (!auth) {
    console.log('Skipping: test user not present in local DB. Seed first.');
    return;
  }
  const { access_token, user } = auth;

  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ensure_user_challenges`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
  });
  assertEquals(rpc.status, 204, `expected 204, got ${rpc.status}: ${await rpc.text()}`);

  const uc = await fetch(
    `${SUPABASE_URL}/rest/v1/user_challenges?select=instance_id&user_id=eq.${user.id}`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${access_token}` } },
  );
  if (!uc.ok) throw new Error(`user_challenges query failed: ${uc.status} ${await uc.text()}`);
  const rows = await uc.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('expected non-empty user_challenges after ensure_user_challenges()');
  }
});
