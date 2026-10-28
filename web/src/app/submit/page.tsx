'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  const [duplicateMsg, setDuplicateMsg] = useState<string | null>(null);

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
    setDuplicateMsg(null);

    let normalized: string;
    try {
      normalized = new URL(url.trim()).toString();
    } catch {
      setError('Please enter a valid URL (e.g. https://example.com/article).');
      return;
    }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('submit-url', {
        body: {
          url: normalized,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          category_id: categoryId || undefined,
        },
      });

      if (fnError) {
        // supabase-js exposes the JSON body via FunctionsHttpError.context.
        // Parse it so we can branch on `duplicate` and surface the friendly message.
        type FnHttpError = { context?: Response };
        let body: { error?: string; message?: string; duplicate?: boolean } | null = null;
        const ctx = (fnError as FnHttpError).context;
        if (ctx && typeof ctx.json === 'function') {
          try { body = await ctx.json(); } catch { /* fall through */ }
        }
        if (!body) {
          try { body = JSON.parse(fnError.message); } catch { /* not JSON */ }
        }
        if (body?.duplicate) {
          setDuplicateMsg(body.message ?? 'This URL is already in our database.');
        } else {
          setError(body?.error ?? body?.message ?? fnError.message);
        }
        return;
      }

      if (data?.duplicate) {
        setDuplicateMsg(data.message ?? 'This URL is already in our database.');
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
    <div className="min-h-full bg-screen">
      <main className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/profile" className="text-muted hover:text-ink transition-colors text-sm mb-8 inline-block">
          ← Back to profile
        </Link>

        <div className="flex flex-col gap-2 mb-8">
          <h1 className="text-3xl font-bold text-ink">Submit a URL</h1>
          <p className="text-muted text-sm">
            Found something worth sharing? Submissions go to a moderation queue before going live.
            Max 10 per hour.
          </p>
        </div>

        {success ? (
          <div className="rounded-xl border border-ok border-ok bg-panel-2 bg-panel-2/30 px-6 py-8 flex flex-col items-center gap-4 text-center">
            <p className="text-lg font-semibold text-ok text-ok">Submitted for review</p>
            <p className="text-sm text-ok text-ok">
              Your URL is in the moderation queue. If approved, it will appear in discovery.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSuccess(false)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-panel-2 hover:bg-panel-2 transition-colors"
              >
                Submit another
              </button>
              <Link
                href="/profile"
                className="rounded-lg bg-panel bg-panel text-ink text-ink px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Back to profile
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* URL */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="url" className="text-sm font-medium text-muted">
                URL <span className="text-danger">*</span>
              </label>
              <input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="https://example.com/interesting-article"
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm bg-panel text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink focus:ring-line"
              />
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-sm font-medium text-muted">
                Title <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="What's this page about?"
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm bg-panel text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink focus:ring-line"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-sm font-medium text-muted">
                Description <span className="text-muted font-normal">(optional)</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Briefly describe why this is worth reading…"
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm bg-panel text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink focus:ring-line resize-none"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="category" className="text-sm font-medium text-muted">
                Category <span className="text-muted font-normal">(optional — helps the reviewer)</span>
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm bg-panel text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-line"
              >
                <option value="">— Select a category —</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {duplicateMsg && (
              <p className="text-sm text-gold bg-panel-2 bg-panel-2/40 rounded-lg px-4 py-2">
                {duplicateMsg}
              </p>
            )}

            {error && (
              <p className="text-sm text-danger bg-panel-2 bg-panel-2/40 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full rounded-lg bg-panel bg-panel text-ink text-ink py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {loading ? 'Submitting…' : 'Submit for review'}
            </button>
          </form>
        )}

        {/* Submission guidelines */}
        <section className="mt-12 rounded-xl border border-line p-6">
          <h2 className="text-lg font-semibold text-ink mb-3">
            Submission guidelines
          </h2>
          <ul className="text-sm text-muted space-y-2 list-disc list-inside">
            <li>Submit real, interesting pages — original writing, deep dives, and genuinely useful resources.</li>
            <li>No spam, affiliate/landing pages, login walls, or pure product pages.</li>
            <li>Every submission goes through moderation before it appears in the discovery pool.</li>
            <li>You can submit up to 10 URLs per hour.</li>
            <li>Quality, not quantity: the community&rsquo;s 👍👎 votes determine what rises to the top.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}