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
      .update({ username: clean, display_name: clean })
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-screen/60 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm bg-panel rounded-2xl shadow-xl p-8 flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-ink">Choose a username</h2>
          <p className="mt-2 text-sm text-muted">
            Pick a username to complete your profile. You can change it later in Settings.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium text-muted">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-panel bg-panel-2 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink focus:ring-line ${error ? 'border-danger' : 'border-line'}`}
              placeholder="yourname"
              autoFocus
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            <p className="text-xs text-muted">Letters, numbers, hyphens, underscores. Min 3 characters.</p>
          </div>
          <button
            type="submit"
            disabled={loading || username.trim().length < 3}
            className="w-full rounded-lg bg-panel bg-panel text-ink text-ink py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {loading ? 'Saving…' : 'Set username'}
          </button>
        </form>
      </div>
    </div>
  );
}