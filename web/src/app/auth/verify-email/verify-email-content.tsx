'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function VerifyEmailContent() {
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
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 bg-screen">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <Image src="/icon-512.png" alt="Roam" width={64} height={64} />
        <div>
          <h1 className="text-2xl font-bold text-ink">Check your inbox</h1>
          <p className="mt-2 text-muted">
            We sent a confirmation link to{' '}
            {email ? <strong className="text-muted">{email}</strong> : 'your email address'}.
            {' '}Click the link to activate your account.
          </p>
        </div>

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}

        {resent ? (
          <p className="text-sm text-ok">Email resent — check your inbox again.</p>
        ) : (
          <button
            onClick={handleResend}
            disabled={loading || !email}
            className="text-sm text-muted hover:text-ink underline underline-offset-2 disabled:opacity-50"
          >
            {loading ? 'Sending…' : "Didn't get it? Resend"}
          </button>
        )}

        <Link
          href="/signup"
          className="text-sm text-muted hover:text-ink transition-colors"
        >
          ← Use a different address
        </Link>
      </div>
    </div>
  );
}