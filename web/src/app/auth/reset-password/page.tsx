'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { validatePassword, validatePasswordsMatch, getPasswordStrengthColor, getPasswordStrengthLabel } from '@/lib/validation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [sessionReady, setSessionReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'fair' | 'good' | 'strong'>('weak');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exchange the token_hash from the email link for a session
  useEffect(() => {
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type');

    if (!tokenHash || type !== 'recovery') {
      setInitError('Invalid or expired reset link. Please request a new one.');
      return;
    }

    supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).then(({ error: err }) => {
      if (err) {
        setInitError(err.message);
      } else {
        setSessionReady(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePasswordChange(value: string) {
    setNewPassword(value);
    if (!value) { setPasswordError(null); setPasswordStrength('weak'); return; }
    const v = validatePassword(value);
    setPasswordError(v.error ?? null);
    setPasswordStrength(v.strength);
    if (confirmPassword) setConfirmError(validatePasswordsMatch(value, confirmPassword).error ?? null);
  }

  function handleConfirmChange(value: string) {
    setConfirmPassword(value);
    if (!value) { setConfirmError(null); return; }
    setConfirmError(validatePasswordsMatch(newPassword, value).error ?? null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.replace('/profile'), 2000);
    }
  }

  const isValid = newPassword && confirmPassword && !passwordError && !confirmError && passwordStrength !== 'weak';

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-16 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <Image src="/icon-512.png" alt="Roam" width={64} height={64} className="mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">Set a new password</h1>
        </div>

        {initError ? (
          <div className="text-center flex flex-col gap-4">
            <p className="text-sm text-red-600">{initError}</p>
            <Link href="/forgot-password" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
              Request a new reset link →
            </Link>
          </div>
        ) : success ? (
          <p className="text-center text-sm text-green-600 dark:text-green-400">
            Password updated. Redirecting to your profile…
          </p>
        ) : !sessionReady ? (
          <p className="text-center text-sm text-zinc-500">Verifying link…</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-2">{error}</p>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">New password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => handlePasswordChange(e.target.value)}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white ${passwordError ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}
              />
              {newPassword && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className={`h-1 rounded-full transition-all ${getPasswordStrengthColor(passwordStrength)}`}
                      style={{ width: { weak: '25%', fair: '50%', good: '75%', strong: '100%' }[passwordStrength] }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500">{getPasswordStrengthLabel(passwordStrength)}</span>
                </div>
              )}
              {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Confirm password</label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => handleConfirmChange(e.target.value)}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white ${confirmError ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}
              />
              {confirmError && <p className="text-xs text-red-600">{confirmError}</p>}
            </div>
            <button
              type="submit"
              disabled={loading || !isValid}
              className="w-full rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
