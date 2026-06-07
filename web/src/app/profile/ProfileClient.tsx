'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { UsernamePrompt } from '@/components/UsernamePrompt';
import { CollectionsManager } from './CollectionsManager';
import type { CollectionRow } from './CollectionsManager';
import { SavedUrlsManager } from './SavedUrlsManager';
import type { SavedUrlRow } from './SavedUrlsManager';
import { InterestPicker } from '@/components/InterestPicker';
import type { Subcategory } from '@/components/InterestPicker';
import { saveUserInterests, type InterestMode } from '@/lib/interests';

type Category = { id: string; label: string; emoji: string };
type Profile = {
  id: string;
  username: string | null;
  email: string;
  bio?: string | null;
  avatar_url?: string | null;
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
}

export function ProfileClient({ userId, email, profile, allCategories, allSubcategories, initialCategoryIds, initialTopicIds, initialCollections, initialSavedUrls }: ProfileClientProps) {
  const supabase = createClient();

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

  const initial = email[0]?.toUpperCase() ?? '?';

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      {/* Username gate for new OAuth users */}
      {!profile?.username && <UsernamePrompt />}

      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-10">
        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-800 text-2xl font-bold text-zinc-900 dark:text-white shrink-0">
            {initial}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {profile?.username ?? email}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{email}</p>
            {profile?.username && (
              <Link
                href={`/u/${profile.username}`}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                roam.the.web/u/{profile.username} ↗
              </Link>
            )}
          </div>
          <Link
            href="/submit"
            className="shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            + Submit URL
          </Link>
        </div>

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

        {/* Collections */}
        <CollectionsManager userId={userId} initialCollections={initialCollections} />

        {/* Saved for later */}
        <SavedUrlsManager userId={userId} initialSavedUrls={initialSavedUrls} />

        {/* Get the app */}
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-1">Start exploring</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
            Install Roam on your browser or phone to start discovering the web.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Browser extension</p>
              <div className="flex gap-3">
                <a
                  href="https://chromewebstore.google.com/detail/ojgphkdgkefokhjnojkddhalnlbajfpc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  Chrome →
                </a>
                <a
                  href="https://addons.mozilla.org/firefox/addon/roam-the-web/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  Firefox →
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Android app</p>
              <span className="text-sm text-zinc-400 dark:text-zinc-500">Coming soon to Google Play</span>
            </div>
          </div>
        </section>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
