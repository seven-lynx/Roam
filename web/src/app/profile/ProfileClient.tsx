'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/hooks';
import { Toast } from '@/components/UI';
import { UsernamePrompt } from '@/components/UsernamePrompt';
import { CollectionsManager } from './CollectionsManager';
import type { CollectionRow } from './CollectionsManager';
import { SavedUrlsManager } from './SavedUrlsManager';
import type { SavedUrlRow } from './SavedUrlsManager';
import { InterestPicker } from '@/components/InterestPicker';
import type { Subcategory } from '@/components/InterestPicker';
import { saveUserInterests, type InterestMode } from '@/lib/interests';
import { LevelProgress } from '@/components/badges/LevelProgress';
import { BadgeDisplay } from '@/components/badges/BadgeDisplay';
import type { BadgeData } from '@/components/badges/BadgeDisplay';

type Category = { id: string; label: string; emoji: string };
export type Profile = {
  id: string;
  username: string | null;
  email?: string;
  bio?: string | null;
  avatar_url?: string | null;
  is_public?: boolean;
  xp_total?: number;
  level?: number;
  streak_days?: number;
  max_streak?: number;
  badge_count?: number;
} | null;

interface ProfileClientProps {
  userId: string;
  email: string;
  profile: Profile;
  allCategories: Category[];
  allSubcategories: Subcategory[];
  initialCategoryIds: string[];
  initialTopicIds: string[];
  initialCollections: CollectionRow[];
  initialSavedUrls: SavedUrlRow[];
  initialBadges?: Record<string, unknown>[];
}

type Tab = 'collections' | 'saved' | 'badges' | 'about';

export function ProfileClient({ userId, email, profile, allCategories, allSubcategories, initialCategoryIds, initialTopicIds, initialCollections, initialSavedUrls, initialBadges }: ProfileClientProps) {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<Tab>('collections');

  // Profile privacy
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  // Toast for copy confirmation
  const { toast, showToast, dismiss } = useToast();

  // Bio editing
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [editingBio, setEditingBio] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  // Interest selection
  const initialMode: InterestMode = initialTopicIds.length > 0 ? 'topics' : 'pillars';
  const [interestMode, setInterestMode] = useState<InterestMode>(initialMode);
  const [selectedPillars, setSelectedPillars] = useState<Set<string>>(new Set(initialCategoryIds));
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set(initialTopicIds));
  const [interestsDirty, setInterestsDirty] = useState(false);
  const [interestsSaving, setInterestsSaving] = useState(false);
  const [interestsSaved, setInterestsSaved] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const badges: BadgeData[] = (initialBadges ?? []).map((b: Record<string, unknown>) => ({
    id: b.id as string,
    slug: b.slug as string,
    name: b.name as string,
    description: b.description as string,
    icon: b.icon as string,
    category: b.category as string,
    tier: b.tier as number,
    required_count: b.required_count as number | null,
    is_unlocked: b.is_unlocked as boolean,
    unlocked_at: b.unlocked_at as string | null,
    progress_current: b.progress_current as number,
    is_hidden: b.is_hidden as boolean,
    is_gift_only: b.is_gift_only as boolean,
    xp_reward: b.xp_reward as number,
    parent_badge_slug: b.parent_badge_slug as string | null,
    granted_by: b.granted_by as string | null,
  }));

  const unlockedCount = badges.filter(b => b.is_unlocked).length;

  async function saveBio() {
    setBioLoading(true);
    const { error: err } = await supabase.from('profiles').update({ bio }).eq('id', userId);
    setBioLoading(false);
    if (err) { setError(err.message); return; }
    setEditingBio(false);
  }

  function handlePillarToggle(id: string) {
    setSelectedPillars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setInterestsDirty(true);
    setInterestsSaved(false);
  }

  function handleTopicToggle(id: string) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setInterestsDirty(true);
    setInterestsSaved(false);
  }

  function handleModeChange(next: InterestMode) {
    setInterestMode(next);
    if (next === 'topics') setSelectedPillars(new Set());
    else setSelectedTopics(new Set());
    setInterestsDirty(true);
    setInterestsSaved(false);
  }

  async function saveInterests() {
    setInterestsSaving(true);
    setError(null);
    try {
      const subcategoryParentMap = new Map(allSubcategories.map((s) => [s.id, s.category_id]));
      await saveUserInterests(supabase, userId, interestMode, selectedPillars, selectedTopics, subcategoryParentMap);
      setInterestsDirty(false);
      setInterestsSaved(true);
      setTimeout(() => setInterestsSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setInterestsSaving(false);
    }
  }

  async function togglePrivacy() {
    setPrivacyLoading(true);
    setError(null);
    const { error: err } = await supabase.from('profiles').update({ is_public: !isPublic }).eq('id', userId);
    setPrivacyLoading(false);
    if (err) { setError(err.message); return; }
    setIsPublic(prev => !prev);
  }

  function copyProfileLink() {
    const username = profile?.username;
    if (!username) return;
    void navigator.clipboard.writeText(`https://roamtheweb.app/u/${username}`);
    showToast('Profile link copied to clipboard', 'success');
  }

  const initial = email[0]?.toUpperCase() ?? '?';
  const displayName = profile?.username ?? email;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'collections', label: 'Collections', count: initialCollections.length },
    { key: 'saved', label: 'Saved', count: initialSavedUrls.length },
    { key: 'badges', label: 'Badges', count: unlockedCount },
    { key: 'about', label: 'About' },
  ];

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      {/* Username gate for new OAuth users */}
      {!profile?.username && <UsernamePrompt />}

      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-8">
        {/* ── Level Progress Card ──────────────────────── */}
        <LevelProgress
          level={profile?.level ?? 1}
          xpTotal={profile?.xp_total ?? 0}
          streakDays={profile?.streak_days ?? 0}
          maxStreak={profile?.max_streak ?? 0}
          badgeCount={profile?.badge_count ?? 0}
        />

        {/* ── Profile Header Card ──────────────────────── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col sm:flex-row items-start gap-5">
          {/* Avatar */}
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-white text-2xl font-bold shrink-0">
            {initial}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
              {displayName}
            </h1>
            {profile?.username && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">@{profile.username}</p>
            )}
            {bio && !editingBio && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 line-clamp-2">{bio}</p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-4">
              <div className="text-center">
                <div className="text-lg font-bold text-zinc-900 dark:text-white tabular-nums">{initialCollections.length}</div>
                <div className="text-xs text-zinc-400">Collections</div>
              </div>
              <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800" />
              <div className="text-center">
                <div className="text-lg font-bold text-zinc-900 dark:text-white tabular-nums">{initialSavedUrls.length}</div>
                <div className="text-xs text-zinc-400">Saved URLs</div>
              </div>
              <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800" />
              <div className="text-center">
                <div className="text-lg font-bold text-zinc-900 dark:text-white">
                  {isPublic ? '🌐' : '🔒'}
                </div>
                <div className="text-xs text-zinc-400">{isPublic ? 'Public' : 'Private'}</div>
              </div>
            </div>

            {/* Action links */}
            {profile?.username && (
              <div className="flex items-center gap-3 mt-4">
                <Link
                  href={`/u/${profile.username}`}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
                >
                  View public profile ↗
                </Link>
                <button
                  onClick={copyProfileLink}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
                >
                  Copy link 🔗
                </button>
              </div>
            )}
          </div>

          {/* Edit actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/settings"
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Settings
            </Link>
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[2px] flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-amber-500 text-zinc-900 dark:text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-xs text-zinc-400 tabular-nums">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ──────────────────────────────── */}
        {activeTab === 'collections' && (
          <CollectionsManager userId={userId} initialCollections={initialCollections} />
        )}

        {activeTab === 'saved' && (
          <SavedUrlsManager userId={userId} initialSavedUrls={initialSavedUrls} />
        )}

        {activeTab === 'badges' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                Badges ({unlockedCount} unlocked)
              </h2>
              <Link
                href="/badges"
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
              >
                View all badges →
              </Link>
            </div>
            <BadgeDisplay badges={badges} showLocked={true} />
          </div>
        )}

        {activeTab === 'about' && (
          <div className="flex flex-col gap-8">
            {/* Privacy */}
            <section>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Profile visibility</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isPublic ? 'Your profile is visible to everyone.' : 'Only you can see your profile.'}
                  </p>
                </div>
                <button
                  onClick={togglePrivacy}
                  disabled={privacyLoading}
                  className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isPublic ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-600'
                  } disabled:opacity-50`}
                  aria-label={isPublic ? 'Make profile private' : 'Make profile public'}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white dark:bg-zinc-900 transition-transform ${
                      isPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </section>

            {/* Bio */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Bio</h2>
                {!editingBio && (
                  <button
                    onClick={() => setEditingBio(true)}
                    className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    aria-label="Edit bio"
                  >
                    Edit ✎
                  </button>
                )}
              </div>

              {editingBio ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    rows={3}
                    maxLength={160}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white resize-none"
                    placeholder="Tell the world a bit about yourself…"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setBio(profile?.bio ?? ''); setEditingBio(false); }}
                      className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors px-3 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveBio}
                      disabled={bioLoading}
                      className="text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-1.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {bioLoading ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {bio || <span className="italic text-zinc-400">No bio yet.</span>}
                </p>
              )}
            </section>

            {/* Interests */}
            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-3">Your interests</h2>
              <div className="mb-4">
                <InterestPicker
                  categories={allCategories}
                  subcategories={allSubcategories}
                  mode={interestMode}
                  selectedPillars={selectedPillars}
                  selectedTopics={selectedTopics}
                  onPillarToggle={handlePillarToggle}
                  onTopicToggle={handleTopicToggle}
                  onModeChange={handleModeChange}
                />
              </div>

              {interestsDirty && (
                <button
                  onClick={saveInterests}
                  disabled={interestsSaving}
                  className="text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {interestsSaving ? 'Saving…' : 'Save interests'}
                </button>
              )}
              {interestsSaved && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">✓ Interests saved</p>
              )}
            </section>

            {/* Get the app */}
            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 card-hover">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-1">Start exploring</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
                Install Roam on your browser or phone to start discovering the web.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Browser extension</p>
                  <div className="flex gap-3">
                    <a
                      href="https://chromewebstore.google.com/detail/ojgphkdgkefokhjnojkddhalnlbajfpc?utm_source=roam-web"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      Chrome →
                    </a>
                    <a
                      href="https://addons.mozilla.org/firefox/addon/roam-the-web/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      Firefox →
                    </a>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Android app</p>
                  <Link href="/android-beta" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    Join the beta →
                  </Link>
                </div>
              </div>
            </section>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <Toast message={toast.message} variant={toast.variant} onDismiss={dismiss} />
      )}
    </div>
  );
}