// account.ts — account lifecycle actions available from the popup.
//
// Password change only. Data export needs an authenticated file download and
// account deletion is irreversible, so both stay on the web settings page where
// the flows already exist (see docs/ROADMAP.md, EXT.5).

import { getSupabase } from '../lib/supabase';
import type { Response } from '../lib/messages';
import { validatePassword } from '../lib/validate';

export async function changePassword(currentPassword: string, newPassword: string): Promise<Response<null>> {
  const ruleError = validatePassword(newPassword);
  if (ruleError) return { ok: false, error: ruleError };
  if (currentPassword === newPassword) {
    return { ok: false, error: 'Choose a password you have not used here before.' };
  }

  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  if (!data.session || !email) return { ok: false, error: 'Not signed in.' };

  // Re-authenticate first: a stale session must not be able to rotate the
  // password, which is the same guard the web settings page uses.
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (authError) return { ok: false, error: 'That current password is not right.' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
