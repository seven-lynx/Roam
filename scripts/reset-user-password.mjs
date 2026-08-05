/**
 * Manual password reset script using Supabase Admin API.
 *
 * Usage:
 *   node scripts/reset-user-password.mjs <email> <new-password>
 *
 * Example:
 *   node scripts/reset-user-password.mjs user@example.com "MyN3wP@ssw0rd"
 *
 * This bypasses AAL2 reauthentication requirements by using the service_role key,
 * so it can be used to recover accounts where the user has lost access.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root
const envPath = resolve(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  env[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1);
}

const SUPABASE_URL = env.SUPABASE_URL || 'https://yrhckctwtdjowulfuaqc.supabase.co';
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Usage: node scripts/reset-user-password.mjs <email> <new-password>');
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error('ERROR: Password must be at least 8 characters.');
  process.exit(1);
}

async function main() {
  console.log(`Looking up user: ${email}...`);

  // Step 1: List all users and filter client-side (Supabase filter syntax can be unreliable)
  const listUrl = `${SUPABASE_URL}/auth/v1/admin/users`;
  console.log(`Fetching: ${listUrl}`);

  const listRes = await fetch(listUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });

  if (!listRes.ok) {
    const body = await listRes.text();
    console.error(`Failed to list users (${listRes.status}): ${body}`);
    process.exit(1);
  }

  const raw = await listRes.json();
  const allUsers = Array.isArray(raw) ? raw : (raw.users || []);
  console.log(`API returned ${allUsers.length} total user(s)`);

  // Filter by email client-side
  const users = allUsers.filter(u => u.email?.toLowerCase() === email.toLowerCase());

  if (users.length === 0) {
    console.error(`ERROR: No user found with email "${email}". Found ${allUsers.length} users total.`);
    if (allUsers.length > 0) {
      console.log('Available emails:', allUsers.map(u => u.email).join(', '));
    }
    process.exit(1);
  }

  const user = users[0];
  console.log(`Found user: ${user.id} (${user.email})`);

  // Step 2: Update the user's password via Admin API
  const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      password: newPassword,
      email_confirm: true, // Ensure email stays confirmed
    }),
  });

  if (!updateRes.ok) {
    const body = await updateRes.text();
    console.error(`Failed to update password (${updateRes.status}): ${body}`);
    process.exit(1);
  }

  const updatedUser = await updateRes.json();
  console.log(`Password successfully reset for ${updatedUser.email} (${updatedUser.id})`);
  console.log('The user can now log in with the new password.');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});