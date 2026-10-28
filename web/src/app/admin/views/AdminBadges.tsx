'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { grantBadgeAdmin, revokeBadgeAdmin } from '@/app/admin/actions';

type BadgeRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: number;
  required_count: number | null;
  is_hidden: boolean;
  is_gift_only: boolean;
  xp_reward: number;
  created_at: string;
  unlocked_count?: number;
};

export function AdminBadges() {
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBadge, setEditingBadge] = useState<BadgeRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<BadgeRow>>({});
  const [giftView, setGiftView] = useState<"grant" | "revoke" | "all">("all");
  const [giftUsername, setGiftUsername] = useState('');
  const [giftBadgeSlug, setGiftBadgeSlug] = useState('');
  const [giftResult, setGiftResult] = useState<string | null>(null);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [giftLoading, setGiftLoading] = useState(false);

  useEffect(() => {
    loadBadges();
  }, []);

  async function loadBadges() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: badgeData } = await supabase
        .from('badges')
        .select('id, slug, name, description, icon, category, tier, required_count, is_hidden, is_gift_only, xp_reward, created_at')
        .order('category')
        .order('tier');
      
      const { data: countData } = await supabase
        .from('user_badges')
        .select('badge_id')
        .not('unlocked_at', 'is', null);
      
      const counts = new Map<string, number>();
      for (const row of countData ?? []) {
        const id = row.badge_id as string;
        counts.set(id, (counts.get(id) || 0) + 1);
      }
      
      setBadges((badgeData ?? []).map(b => ({
        ...b,
        unlocked_count: counts.get(b.id) || 0,
      })));
    } catch (e) {
      console.error('Failed to load badges', e);
    }
    setLoading(false);
  }

  function startEdit(badge: BadgeRow) {
    setEditingBadge(badge);
    setEditForm({ ...badge });
  }

  async function saveBadge() {
    if (!editingBadge) return;
    try {
      const supabase = createClient();
      await supabase.from('badges').update(editForm).eq('id', editingBadge.id);
      setEditingBadge(null);
      loadBadges();
    } catch (e) {
      console.error('Failed to save badge', e);
    }
  }

  async function toggleHidden(badge: BadgeRow) {
    try {
      const supabase = createClient();
      await supabase.from('badges').update({ is_hidden: !badge.is_hidden }).eq('id', badge.id);
      loadBadges();
    } catch (e) {
      console.error('Failed to toggle hidden', e);
    }
  }

  async function grantBadge() {
    setGiftLoading(true);
    setGiftResult(null);
    setGiftError(null);
    try {
      const { data, error } = await grantBadgeAdmin(giftUsername, giftBadgeSlug);
      if (error) throw new Error(error);
      setGiftResult(data?.message ?? `Badge "${giftBadgeSlug}" granted to @${giftUsername}!`);
      setGiftUsername('');
      setGiftBadgeSlug('');
      loadBadges();
    } catch (e) {
      setGiftError(e instanceof Error ? e.message : 'Failed to grant badge');
    }
    setGiftLoading(false);
  }

  async function revokeBadge() {
    setGiftLoading(true);
    setGiftResult(null);
    setGiftError(null);
    try {
      const { data, error } = await revokeBadgeAdmin(giftUsername, giftBadgeSlug);
      if (error) throw new Error(error);
      setGiftResult(data?.message ?? `Badge "${giftBadgeSlug}" revoked from @${giftUsername}!`);
      setGiftUsername('');
      setGiftBadgeSlug('');
      loadBadges();
    } catch (e) {
      setGiftError(e instanceof Error ? e.message : 'Failed to revoke badge');
    }
    setGiftLoading(false);
  }

  const giftBadges = badges.filter(b => b.is_gift_only);
  const allBadges = badges;

  return (
    <div className="flex flex-col gap-6">
      {/* Tab bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setGiftView("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            giftView === "all"
              ? 'bg-panel bg-panel text-ink text-ink'
              : 'bg-panel-2 text-muted'
          }`}
        >
          All Badges ({badges.length})
        </button>
        <button
          onClick={() => setGiftView("grant")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            giftView === "grant"
              ? 'bg-phosphor text-ink'
              : 'bg-panel-2 text-muted'
          }`}
        >
          🎁 Grant
        </button>
        <button
          onClick={() => setGiftView("revoke")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            giftView === "revoke"
              ? 'bg-danger text-ink'
              : 'bg-panel-2 text-muted'
          }`}
        >
          ❌ Revoke
        </button>
      </div>

      {/* Grant Mode */}
      {giftView === "grant" && (
        <div className="rounded-xl border border-line p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Grant a Badge</h2>
          
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted mb-1">Username</label>
              <input
                type="text"
                value={giftUsername}
                onChange={e => setGiftUsername(e.target.value)}
                placeholder="@username"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel text-ink"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted mb-1">Badge</label>
              <select
                value={giftBadgeSlug}
                onChange={e => setGiftBadgeSlug(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel text-ink"
              >
                <option value="">Select a badge...</option>
                {allBadges.map(b => (
                  <option key={b.slug} value={b.slug}>{b.icon} {b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={grantBadge}
                disabled={giftLoading || !giftUsername || !giftBadgeSlug}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-phosphor text-ink text-sm font-medium hover:bg-info disabled:opacity-50 transition-colors"
              >
                {giftLoading ? 'Granting...' : '🎁 Grant'}
              </button>
            </div>
          </div>
          {giftResult && <p className="text-sm text-ok">{giftResult}</p>}
          {giftError && <p className="text-sm text-danger">{giftError}</p>}

          <div className="mt-6">
            <h3 className="text-sm font-medium text-muted mb-3">Available Gift Badges</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {giftBadges.map(b => (
                <div key={b.id} className="rounded-lg border border-line p-2 text-center">
                  <span className="text-xl">{b.icon}</span>
                  <p className="text-xs font-medium text-muted mt-1">{b.name}</p>
                  <p className="text-[10px] text-muted">{b.unlocked_count} granted</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Revoke Mode */}
      {giftView === "revoke" && (
        <div className="rounded-xl border border-danger border-danger p-6">
          <h2 className="text-lg font-semibold text-ink mb-1">Revoke a Badge</h2>
          <p className="text-xs text-muted mb-4">Removes the badge so the user can earn it legitimately. XP is deducted.</p>
          
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted mb-1">Username</label>
              <input
                type="text"
                value={giftUsername}
                onChange={e => setGiftUsername(e.target.value)}
                placeholder="@username"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel text-ink"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted mb-1">Badge</label>
              <select
                value={giftBadgeSlug}
                onChange={e => setGiftBadgeSlug(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel text-ink"
              >
                <option value="">Select a badge...</option>
                {allBadges.map(b => (
                  <option key={b.slug} value={b.slug}>{b.icon} {b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={revokeBadge}
                disabled={giftLoading || !giftUsername || !giftBadgeSlug}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-danger text-ink text-sm font-medium hover:bg-danger disabled:opacity-50 transition-colors"
              >
                {giftLoading ? 'Revoking...' : '❌ Revoke'}
              </button>
            </div>
          </div>
          {giftResult && <p className="text-sm text-ok">{giftResult}</p>}
          {giftError && <p className="text-sm text-danger">{giftError}</p>}
        </div>
      )}

      {/* All Badges Table */}
      {giftView === "all" && (
        <>
          {loading ? (
            <div className="text-center text-muted py-12">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted">Badge</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted">Category</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted">Tier</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted">XP</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted">Unlocked</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {badges.map(b => (
                    <tr key={b.id} className="border-b border-line border-line hover:bg-panel-2/50">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{b.icon}</span>
                          <div>
                            <p className="font-medium text-ink text-xs">{b.name}</p>
                            <p className="text-[10px] text-muted">{b.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-panel-2 text-muted">
                          {b.category}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-xs text-muted">{b.tier || '—'}</td>
                      <td className="py-2 px-2 text-right text-xs font-mono text-muted">+{b.xp_reward}</td>
                      <td className="py-2 px-2 text-right text-xs font-mono text-muted">{b.unlocked_count ?? 0}</td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(b)}
                            className="text-[10px] px-2 py-1 rounded bg-panel-2 text-muted hover:bg-panel-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleHidden(b)}
                            className={`text-[10px] px-2 py-1 rounded ${
                              b.is_hidden
                                ? 'bg-panel-2 bg-panel-2/20 text-gold text-gold'
                                : 'bg-panel-2 text-muted'
                            } hover:opacity-80`}
                          >
                            {b.is_hidden ? 'Hidden' : 'Visible'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      {editingBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-screen/50" onClick={() => setEditingBadge(null)}>
          <div className="bg-panel rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink mb-4">Edit Badge</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Name</label>
                <input
                  type="text"
                  value={editForm.name ?? ''}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel bg-panel-2 text-ink"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Description</label>
                <textarea
                  value={editForm.description ?? ''}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel bg-panel-2 text-ink"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">XP Reward</label>
                  <input
                    type="number"
                    value={editForm.xp_reward ?? 0}
                    onChange={e => setEditForm({ ...editForm, xp_reward: Number(e.target.value) })}
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel bg-panel-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Required Count</label>
                  <input
                    type="number"
                    value={editForm.required_count ?? ''}
                    onChange={e => setEditForm({ ...editForm, required_count: e.target.value ? Number(e.target.value) : null })}
                    placeholder="null = one-time"
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-panel bg-panel-2 text-ink"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setEditingBadge(null)}
                className="px-4 py-2 text-sm text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={saveBadge}
                className="px-4 py-2 rounded-lg bg-panel bg-panel text-ink text-ink text-sm font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}