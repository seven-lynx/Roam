'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BadgeDisplay, CATEGORY_LABELS } from '@/components/badges/BadgeDisplay';
import type { BadgeData } from '@/components/badges/BadgeDisplay';

const CATEGORIES = ['exploration', 'collecting', 'curating', 'social', 'streaks', 'contributing', 'engagement', 'milestone', 'secret', 'gift'] as const;

const TIERS = [
  { value: null, label: 'All Tiers' },
  { value: 1, label: 'Bronze' },
  { value: 2, label: 'Silver' },
  { value: 3, label: 'Gold' },
  { value: 4, label: 'Platinum' },
  { value: 5, label: 'Legendary' },
];

export function BadgeGalleryClient() {
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);
  const [showLockedOnly, setShowLockedOnly] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        setIsSignedIn(!!session);

        if (session) {
          const { data, error: err } = await supabase.rpc('get_user_badges', { p_user_id: session.user.id });
          if (err) throw new Error(err.message);
          setBadges((data ?? []) as unknown as BadgeData[]);
        } else {
          // Fallback: fetch public badge definitions
          const { data, error: err } = await supabase
            .from('badges')
            .select('id, slug, name, description, icon, category, tier, xp_reward, parent_badge_slug, is_gift_only, is_hidden')
            .eq('is_hidden', false)
            .order('category');
          if (err) throw new Error(err.message);
          setBadges((data ?? []).map((b: Record<string, unknown>) => ({
            ...b,
            is_unlocked: false,
            unlocked_at: null,
            progress_current: 0,
            granted_by: null,
          })) as unknown as BadgeData[]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load badges');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = badges.filter((b) => {
    if (selectedCategory && b.category !== selectedCategory) return false;
    if (selectedTier !== null && b.tier !== selectedTier) return false;
    if (showUnlockedOnly && !b.is_unlocked) return false;
    if (showLockedOnly && b.is_unlocked) return false;
    if (b.is_hidden && !b.is_unlocked && !isSignedIn) return false; // hide secrets from non-logged-in
    return true;
  });

  const unlockedCount = badges.filter(b => b.is_unlocked).length;
  const totalCount = badges.length;

  return (
    <div className="min-h-full bg-screen">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink">Badge Gallery</h1>
          <p className="text-sm text-muted mt-1">
            {isSignedIn
              ? `${unlockedCount} unlocked · ${totalCount - unlockedCount} remaining`
              : `${totalCount} badges to discover`}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <select
            value={selectedCategory ?? ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="rounded-lg border border-line px-3 py-2 text-sm bg-panel text-ink"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
            ))}
          </select>

          <select
            value={selectedTier ?? ''}
            onChange={(e) => setSelectedTier(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-line px-3 py-2 text-sm bg-panel text-ink"
          >
            {TIERS.map((t) => (
              <option key={t.label} value={t.value ?? ''}>{t.label}</option>
            ))}
          </select>

          {isSignedIn && (
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => { setShowUnlockedOnly(!showUnlockedOnly); setShowLockedOnly(false); }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showUnlockedOnly
                    ? 'bg-panel bg-panel text-ink text-ink'
                    : 'bg-panel-2 text-muted'
                }`}
              >
                Unlocked
              </button>
              <button
                onClick={() => { setShowLockedOnly(!showLockedOnly); setShowUnlockedOnly(false); }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showLockedOnly
                    ? 'bg-panel bg-panel text-ink text-ink'
                    : 'bg-panel-2 text-muted'
                }`}
              >
                Locked
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-line border-line border-t-line border-t-line" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger border-danger bg-panel-2 bg-panel-2/30 p-4 text-sm text-danger text-danger">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted">
                <span className="text-4xl block mb-3">🏅</span>
                <p className="text-sm">No badges match your filters.</p>
              </div>
            ) : (
              <BadgeDisplay badges={filtered} showLocked={!showUnlockedOnly} showSecret={isSignedIn} />
            )}
          </>
        )}
      </div>
    </div>
  );
}