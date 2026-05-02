'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UsernamePrompt } from '@/components/UsernamePrompt';

type Category = { id: string; label: string; emoji: string };
type Profile = {
  user_id: string;
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
  initialCategoryIds: string[];
}

export function ProfileClient({ userId, email, profile, allCategories, initialCategoryIds }: ProfileClientProps) {
  const supabase = createClient();

  // Bio editing
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [editingBio, setEditingBio] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  // Category selection
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(initialCategoryIds));
  const [categoriesDirty, setCategoriesDirty] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categorySaved, setCategorySaved] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function saveBio() {
    setBioLoading(true);
    const { error: err } = await supabase.from('profiles').update({ bio }).eq('user_id', userId);
    setBioLoading(false);
    if (err) { setError(err.message); return; }
    setEditingBio(false);
  }

  function toggleCategory(id: string) {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setCategoriesDirty(true);
    setCategorySaved(false);
  }

  async function saveCategories() {
    setCategorySaving(true);
    setError(null);
    try {
      await supabase.from('user_categories').delete().eq('user_id', userId);
      if (selectedCategories.size > 0) {
        await supabase.from('user_categories').insert(
          Array.from(selectedCategories).map(category_id => ({ user_id: userId, category_id }))
        );
      }
      setCategoriesDirty(false);
      setCategorySaved(true);
      setTimeout(() => setCategorySaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setCategorySaving(false);
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
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {profile?.username ?? email}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{email}</p>
          </div>
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
          <div className="grid grid-cols-2 gap-2 mb-4">
            {allCategories.map(cat => {
              const active = selectedCategories.has(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium text-left transition-colors ${
                    active
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                      : 'border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {categoriesDirty && (
            <button
              onClick={saveCategories}
              disabled={categorySaving || selectedCategories.size === 0}
              className="text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {categorySaving ? 'Saving…' : 'Save interests'}
            </button>
          )}
          {categorySaved && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">✓ Interests saved</p>
          )}
        </section>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
