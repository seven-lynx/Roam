'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const supabase = createClient();

  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    if (!email) return;
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.resend({ type: 'signup', email });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setResent(true);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-16 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <Image src="/icon-512.png" alt="Roam" width={64} height={64} />
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Check your inbox</h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            We sent a confirmation link to{' '}
            {email ? <strong className="text-zinc-700 dark:text-zinc-300">{email}</strong> : 'your email address'}.
            {' '}Click the link to activate your account.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {resent ? (
          <p className="text-sm text-green-600 dark:text-green-400">Email resent — check your inbox again.</p>
        ) : (
          <button
            onClick={handleResend}
            disabled={loading || !email}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white underline underline-offset-2 disabled:opacity-50"
          >
            {loading ? 'Sending…' : "Didn't get it? Resend"}
          </button>
        )}

        <Link
          href="/signup"
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          ← Use a different address
        </Link>
      </div>
    </div>
  );
}
