'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/components/AuthProvider';

export default function AndroidBetaPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState(session?.user?.email ?? '');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('submitting');
    setMessage('');

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/beta-signup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? 'Something went wrong — please try again.');
        setStatus('error');
        return;
      }
      setMessage(data.message ?? "You're on the list!");
      setStatus('success');
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.');
      setStatus('error');
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-md flex flex-col gap-6 text-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Join the Android Beta</h1>
          <p className="mt-3 text-zinc-500 dark:text-zinc-400">
            The Roam Android app is in closed beta. Drop your email below and we&rsquo;ll let you know when
            a spot opens up.
          </p>
        </div>

        {status === 'success' ? (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-6">
            <p className="text-green-700 dark:text-green-300 text-lg font-semibold">
              {message}
            </p>
            <p className="text-green-600 dark:text-green-400 text-sm mt-2">
              We&rsquo;ll reach out when the beta expands. No spam, ever.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
            />

            {status === 'error' && (
              <p className="text-red-500 text-sm">{message}</p>
            )}

            <button
              type="submit"
              disabled={!email.trim() || status === 'submitting'}
              className="rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold py-3 text-base hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === 'submitting' ? 'Joining…' : 'Join the Android Beta'}
            </button>
          </form>
        )}

        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          No spam. Just a one-time email when the beta expands.
        </p>
      </div>
    </div>
  );
}