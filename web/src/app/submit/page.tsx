'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { LoadingPage } from '@/components/UI';
import { createClient } from '@/lib/supabase/client';
import { useRequireAuth } from '@/lib/hooks';

type Category = { id: string; label: string; emoji: string };

const FALLBACK_CATEGORIES: Category[] = [
  { id: 'c1000000-0000-0000-0000-000000000001', label: 'Science & Nature', emoji: '🔬' },
  { id: 'c1000000-0000-0000-0000-000000000002', label: 'Technology', emoji: '💻' },
  { id: 'c1000000-0000-0000-0000-000000000003', label: 'Arts & Culture', emoji: '🎨' },
  { id: 'c1000000-0000-0000-0000-000000000004', label: 'History & Ideas', emoji: '📜' },
  { id: 'c1000000-0000-0000-0000-000000000005', label: 'Games & Hobbies', emoji: '🎮' },
  { id: 'c1000000-0000-0000-0000-000000000006', label: 'Weird & Wonderful', emoji: '🌀' },
  { id: 'c1000000-0000-0000-0000-000000000007', label: 'People & Places', emoji: '🌍' },
  { id: 'c1000000-0000-0000-0000-000000000008', label: 'Mind & Body', emoji: '🧠' },
];

export default function SubmitPage() {
  const { isReady } = useRequireAuth();
  const supabase = createClient();

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('categories')
          .select('id, name, icon, sort_order')
          .order('sort_order');
        if (data && data.length > 0) {
          setCategories(data.map((c) => ({ id: c.id, label: c.name, emoji: c.icon })));
        }
      } catch {
        // keep fallback
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let normalized: string;
    try {
      normalized = new URL(url.trim()).toString();
    } catch {
      setError('Please enter a valid URL (e.g. https://example.com/article).');
      return;
    }

    setLoading(true);
    try {
      const { error: fnError } = await supabase.functions.invoke('submit-url', {
        body: {
          url: normalized,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          category_id: categoryId || undefined,
        },
      });

      if (fnError) {
        // fnError.message is the JSON body from the function
        let msg = fnError.message;
        try {
          const parsed = JSON.parse(msg);
          msg = parsed.error ?? msg;
        } catch { /* not JSON */ }
        setError(msg);
        return;
      }

      setSuccess(true);
      setUrl('');
      setTitle('');
      setDescription('');
      setCategoryId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!isReady) return <LoadingPage />;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/profile" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm mb-8 inline-block">
          ← Back to profile
        </Link>

        <div className="flex flex-col gap-2 mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Submit a URL</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Found something worth sharing? Submissions go to a moderation queue before going live.
            Max 10 per hour.
          </p>
        </div>

        {success ? (
          <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 px-6 py-8 flex flex-col items-center gap-4 text-center">
            <p className="text-lg font-semibold text-green-800 dark:text-green-300">Submitted for review</p>
            <p className="text-sm text-green-700 dark:text-green-400">
              Your URL is in the moderation queue. If approved, it will appear in discovery.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSuccess(false)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Submit another
              </button>
              <Link
                href="/profile"
                className="rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Back to profile
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* URL */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="url" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                URL <span className="text-red-500">*</span>
              </label>
              <input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="https://example.com/interesting-article"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              />
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Title <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="What's this page about?"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Description <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Briefly describe why this is worth reading…"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white resize-none"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="category" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Category <span className="text-zinc-400 font-normal">(optional — helps the reviewer)</span>
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              >
                <option value="">— Select a category —</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {loading ? 'Submitting…' : 'Submit for review'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
