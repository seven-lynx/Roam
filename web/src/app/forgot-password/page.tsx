'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { validateEmail } from '@/lib/validation';

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleEmailChange(value: string) {
    setEmail(value);
    if (value) {
      const result = validateEmail(value);
      setEmailError(result.error ?? null);
    } else {
      setEmailError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateEmail(email);
    if (!result.valid) {
      setEmailError(result.error ?? 'Invalid email');
      return;
    }

    setLoading(true);
    setError(null);

    const origin = window.location.origin;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/reset-password`,
    });

    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSubmitted(true);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-16 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <Image src="/icon-512.png" alt="Roam" width={64} height={64} className="mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">Reset your password</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {submitted ? (
          <div className="text-center flex flex-col gap-4">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Check your inbox — a reset link has been sent to <strong>{email}</strong>.
              The link expires in 1 hour.
            </p>
            <Link
              href="/join?mode=signin"
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-2">{error}</p>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white ${emailError ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}
                placeholder="you@example.com"
              />
              {emailError && <p className="text-xs text-red-600">{emailError}</p>}
            </div>
            <button
              type="submit"
              disabled={loading || !email || !!emailError}
              className="w-full rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <Link
              href="/join?mode=signin"
              className="text-center text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              ← Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
