/**
 * @jest-environment node
 *
 * RLS is the security boundary, and `security.test.ts` cannot see it: those cases
 * assert against object literals, so dropping a policy leaves every one of them
 * green (issue #156). This file talks to a real PostgREST with two real JWTs.
 *
 * It runs only when the environment names a local stack, because it creates users
 * and rows:
 *
 *   supabase start
 *   $env:RLS_TEST_SUPABASE_URL = 'http://127.0.0.1:54321'
 *   $env:RLS_TEST_SUPABASE_ANON_KEY = (supabase status -o env | Select-String '^ANON_KEY=').Line.Split('=')[1].Trim('"')
 *   pnpm -C web exec jest --watchAll=false web/src/__tests__/rls.integration.test.ts
 *
 * Never `service_role`: its bypass would make every assertion below pass whatever
 * the policies say, which is how the August 2026 outage stayed invisible.
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// jest.setup.js stubs `@supabase/supabase-js` for the unit suites ("tests never
// touch the network"). This file's entire point is the network, so it takes the
// real module back.
jest.unmock('@supabase/supabase-js');

const SUPABASE_URL = process.env.RLS_TEST_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.RLS_TEST_SUPABASE_ANON_KEY;

/** Mailpit, where the local stack drops the confirmation mail. */
const MAILPIT_URL = process.env.RLS_TEST_MAILPIT_URL ?? 'http://127.0.0.1:54324';

const PASSWORD = 'rls-local-password';

const suite = SUPABASE_URL && SUPABASE_ANON_KEY ? describe : describe.skip;

/** Two throwaway accounts, one per run: the local stack keeps users between resets. */
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

interface Account {
  client: SupabaseClient;
  userId: string;
  email: string;
}

async function confirmEmail(email: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const list = (await (await fetch(`${MAILPIT_URL}/api/v1/messages?limit=50`)).json()) as {
      messages?: { ID: string; To?: { Address: string }[] }[];
    };
    const match = (list.messages ?? []).find((message) =>
      (message.To ?? []).some((to) => to.Address === email)
    );

    if (match) {
      const body = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${match.ID}`)).json()) as {
        Text?: string;
        HTML?: string;
      };
      const link = /\bhttps?:\/\/[^\s"'<>]*\/auth\/v1\/verify\?[^\s"'<>]+/.exec(
        `${body.Text ?? ''} ${body.HTML ?? ''}`
      );
      if (!link) throw new Error(`confirmation mail for ${email} carried no verify link`);
      await fetch(link[0], { redirect: 'manual' });
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`no confirmation mail for ${email}`);
}

async function signUp(label: string): Promise<Account> {
  const email = `rls-${label}-${RUN}@local.test`;
  const client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.signUp({ email, password: PASSWORD });
  if (error) throw error;
  if (!data.user) throw new Error('signUp returned no user');

  // The local stack has email confirmation on (config.toml: [auth.email]
  // enable_confirmations), so the address is confirmed the way a person would:
  // through the mail the stack just sent.
  if (!data.session) {
    await confirmEmail(email);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw signInError;
  }

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('no user after sign-in');

  return { client, userId: userData.user.id, email };
}

suite('RLS, exercised with real JWTs', () => {
  let alice: Account;
  let bob: Account;

  beforeAll(async () => {
    alice = await signUp('alice');
    bob = await signUp('bob');
  }, 60_000);

  afterAll(async () => {
    // The owner can always delete its own row; the other rows this file writes are
    // denied by the policies under test, so there is nothing else to clean up.
    await alice.client.from('user_settings').delete().eq('user_id', alice.userId);
  }, 30_000);

  describe('user_settings (owner-only ALL policy)', () => {
    it('lets the owner write and read its own row', async () => {
      const { error: writeError } = await alice.client
        .from('user_settings')
        .upsert({ user_id: alice.userId, discovery_mode: 'discovery' }, { onConflict: 'user_id' });
      expect(writeError).toBeNull();

      const { data, error } = await alice.client
        .from('user_settings')
        .select('user_id, discovery_mode')
        .eq('user_id', alice.userId);

      expect(error).toBeNull();
      expect(data).toEqual([{ user_id: alice.userId, discovery_mode: 'discovery' }]);
    });

    it('hides that row from another signed-in user', async () => {
      const { data, error } = await bob.client
        .from('user_settings')
        .select('user_id')
        .eq('user_id', alice.userId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('refuses another user update, leaving the row untouched', async () => {
      const { data, error } = await bob.client
        .from('user_settings')
        .update({ discovery_mode: 'focused' })
        .eq('user_id', alice.userId)
        .select('user_id');

      expect(error).toBeNull();
      expect(data).toEqual([]);

      const { data: after } = await alice.client
        .from('user_settings')
        .select('discovery_mode')
        .eq('user_id', alice.userId);
      expect(after).toEqual([{ discovery_mode: 'discovery' }]);
    });

    it('refuses an insert that claims another user id', async () => {
      const { error } = await bob.client
        .from('user_settings')
        .insert({ user_id: alice.userId, discovery_mode: 'focused' });

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
    });
  });

  describe('user_tag_weights (owner-read only, no write policy)', () => {
    it('lets the owner select', async () => {
      const { data, error } = await alice.client
        .from('user_tag_weights')
        .select('user_id, tag_id, weight')
        .eq('user_id', alice.userId);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('refuses a client write, which is what keeps the triggers the only writer', async () => {
      const { error } = await alice.client
        .from('user_tag_weights')
        .insert({ user_id: alice.userId, tag_id: '00000000-0000-0000-0000-000000000000', weight: 1 });

      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');
    });
  });
});
