'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export function UsernamePrompt() {
  const { session } = useAuth();
  const supabase = createClient();

  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = username.trim().toLowerCase();
    if (!clean || clean.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(clean)) {
      setError('Only letters, numbers, hyphens, and underscores are allowed.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: err } = await supabase
      .from('profiles')
      .upsert({ id: session!.user.id, username: clean, display_name: clean })
      .eq('id', session!.user.id);

    setLoading(false);
    if (err) {
      setError(err.message.includes('unique') ? 'That username is already taken.' : err.message);
    } else {
      // Reload to update AuthProvider profile state
      window.location.reload();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Choose a username</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Pick a username to complete your profile. You can change it later in Settings.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white ${error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}
              placeholder="yourname"
              autoFocus
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <p className="text-xs text-zinc-400">Letters, numbers, hyphens, underscores. Min 3 characters.</p>
          </div>
          <button
            type="submit"
            disabled={loading || username.trim().length < 3}
            className="w-full rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {loading ? 'Saving…' : 'Set username'}
          </button>
        </form>
      </div>
    </div>
  );
}
