'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import * as Sentry from '@sentry/nextjs';
import { validatePassword, validatePasswordsMatch, getPasswordStrengthColor, getPasswordStrengthLabel } from '@/lib/validation';

interface SettingsClientProps {
  userId: string;
  email: string;
  provider: string;
  initialNotifications: boolean;
  initialDiscoveryMode: 'discovery' | 'deep_dive';
}

// ── Two-step delete modal ─────────────────────────────────────────────────
function DeleteModal({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: () => void; loading: boolean }) {
  const [step, setStep] = useState<1 | 2>(1);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 flex flex-col gap-5">
        {step === 1 ? (
          <>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Delete your account?</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              This will permanently delete your profile, ratings, and all data. There is no undo.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button onClick={() => setStep(2)} className="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-medium hover:bg-red-700 transition-colors">
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-red-600">Final confirmation</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Are you absolutely sure? This cannot be undone. Your account will be gone permanently.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Toggle helper ─────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'} disabled:opacity-50`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

// ── Section card ──────────────────────────────────────────────────────────
function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={`rounded-2xl border p-6 ${danger ? 'border-red-200 dark:border-red-900' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <h2 className={`text-lg font-semibold mb-5 ${danger ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>{title}</h2>
      {children}
    </section>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function SettingsClient({
  userId,
  email,
  provider,
  initialNotifications,
  initialDiscoveryMode,
}: SettingsClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const isEmailUser = provider === 'email';

  // Notification toggle
  const [notifications, setNotifications] = useState(initialNotifications);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Discovery mode
  const [discoveryMode, setDiscoveryMode] = useState<'discovery' | 'deep_dive'>(initialDiscoveryMode);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  // Password change (email users only)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'fair' | 'good' | 'strong'>('weak');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);

  // Bookmark a site
  const [bookmarkUrl, setBookmarkUrl] = useState('');
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [bookmarkStatus, setBookmarkStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [bookmarkMessage, setBookmarkMessage] = useState<string | null>(null);
  const [bookmarksCollectionSlug, setBookmarksCollectionSlug] = useState<string | null>(null);

  // Export / delete
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Load existing Bookmarks collection slug on mount so the "View Bookmarks" link
  // is visible immediately if the collection already exists.
  useEffect(() => {
    supabase
      .from('collections')
      .select('slug')
      .eq('user_id', userId)
      .eq('title', 'Bookmarks')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.slug) setBookmarksCollectionSlug(data.slug);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Handlers ───────────────────────────────────────────────────────────
  async function handleNotificationsToggle() {
    setNotificationsLoading(true);
    try {
      await supabase.from('user_settings').upsert(
        { user_id: userId, email_notifications: !notifications },
        { onConflict: 'user_id' }
      );
      setNotifications(v => !v);
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'notifications-toggle' } });
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function handleDiscoveryModeChange(mode: 'discovery' | 'deep_dive') {
    setDiscoveryLoading(true);
    try {
      await supabase.from('user_settings').upsert(
        { user_id: userId, discovery_mode: mode },
        { onConflict: 'user_id' }
      );
      setDiscoveryMode(mode);
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'discovery-mode' } });
    } finally {
      setDiscoveryLoading(false);
    }
  }

  function handlePasswordChange(value: string) {
    setNewPassword(value);
    if (!value) { setPasswordError(null); setPasswordStrength('weak'); return; }
    const v = validatePassword(value);
    setPasswordError(v.error ?? null);
    setPasswordStrength(v.strength);
    if (confirmPassword) setConfirmError(validatePasswordsMatch(value, confirmPassword).error ?? null);
  }

  function handleConfirmChange(value: string) {
    setConfirmPassword(value);
    setConfirmError(value ? (validatePasswordsMatch(newPassword, value).error ?? null) : null);
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordFormError(null);
    setPasswordSuccess(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) { setPasswordFormError(err.message); return; }
      setPasswordSuccess('Password updated.');
      setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'password-change' } });
      setPasswordFormError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleExportData() {
    setExportLoading(true);
    setGlobalError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export-user`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Export failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `roam-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'export-data' } });
      setGlobalError(err instanceof Error ? err.message : 'Failed to export data');
    } finally {
      setExportLoading(false);
    }
  }

  async function handleBookmark(e: React.FormEvent) {
    e.preventDefault();
    let raw = bookmarkUrl.trim();
    if (!raw) return;
    if (!raw.startsWith('http')) raw = 'https://' + raw;

    setBookmarkLoading(true);
    setBookmarkStatus('idle');
    setBookmarkMessage(null);

    try {
      // 1. Look up the URL in the catalog
      const { data: urlRow } = await supabase
        .from('urls')
        .select('id')
        .eq('url', raw)
        .maybeSingle();

      if (!urlRow) {
        setBookmarkStatus('error');
        setBookmarkMessage("This URL isn't in Roam's catalog. Submit it first via the Submit page.");
        return;
      }

      // 2. Find or create the user's Bookmarks collection
      const { data: existing } = await supabase
        .from('collections')
        .select('id, slug')
        .eq('user_id', userId)
        .eq('title', 'Bookmarks')
        .maybeSingle();

      let collectionId: string | undefined = existing?.id;
      let slug: string | undefined = existing?.slug;

      if (!collectionId) {
        // Try progressively unique slugs to avoid global slug conflicts
        const candidates = ['bookmarks', 'my-bookmarks', `bookmarks-${userId.slice(0, 8)}`];
        for (const candidate of candidates) {
          const { data: created, error: createErr } = await supabase.functions.invoke('collection', {
            body: { action: 'create', title: 'Bookmarks', slug: candidate, is_public: false },
          });
          if (!createErr && created?.id) {
            collectionId = created.id;
            slug = candidate;
            break;
          }
          // 409 = slug taken globally — try the next candidate
          if (!createErr || !(createErr as { message?: string }).message?.includes('409')) break;
        }
      }

      if (!collectionId) {
        setBookmarkStatus('error');
        setBookmarkMessage('Could not create Bookmarks collection. Please try again.');
        return;
      }

      // 3. Add the URL to the collection
      const { error: addErr } = await supabase.functions.invoke('collection', {
        body: { action: 'add_item', id: collectionId, url_id: urlRow.id },
      });

      if (addErr) throw addErr;

      setBookmarkStatus('success');
      setBookmarkMessage('Bookmarked!');
      setBookmarkUrl('');
      if (slug) setBookmarksCollectionSlug(slug);
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'bookmark' } });
      setBookmarkStatus('error');
      setBookmarkMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBookmarkLoading(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to delete account');
      }
      await supabase.auth.signOut();
      router.replace('/');
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'delete-account' } });
      setGlobalError(err instanceof Error ? err.message : 'Failed to delete account');
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  }

  const passwordFormValid =
    newPassword && confirmPassword && !passwordError && !confirmError && passwordStrength !== 'weak';

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      {showDeleteModal && (
        <DeleteModal
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
          loading={deleteLoading}
        />
      )}

      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Settings</h1>

        {globalError && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-2">{globalError}</p>
        )}

        {/* Navigation */}
        <Section title="Navigation">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Browser navigation shortcuts.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => window.history.forward()}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Forward →
            </button>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
        </Section>

        {/* Account */}
        <Section title="Account">
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500 dark:text-zinc-400">Email</span>
              <span className="font-medium text-zinc-900 dark:text-white">{email}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-zinc-500 dark:text-zinc-400">Sign-in method</span>
              <span className="font-medium text-zinc-900 dark:text-white capitalize">
                {provider === 'email' ? 'Email & password' : provider}
              </span>
            </div>
          </div>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition-colors ${
                  theme === t
                    ? 'border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Section>

        {/* Discovery mode */}
        <Section title="Discovery mode">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Controls how Roam selects URLs for you.</p>
          <div className={`flex flex-col gap-3 ${discoveryLoading ? 'opacity-50 pointer-events-none' : ''}`}>
            {(['discovery', 'deep_dive'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => handleDiscoveryModeChange(mode)}
                className={`flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                  discoveryMode === mode
                    ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-800'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                }`}
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${discoveryMode === mode ? 'border-zinc-900 dark:border-white' : 'border-zinc-400 dark:border-zinc-600'}`}>
                  {discoveryMode === mode && <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />}
                </span>
                <div>
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {mode === 'discovery' ? 'Discovery' : 'Deep Dive'}
                  </span>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {mode === 'discovery'
                      ? 'Mix of top interests with occasional adjacent topics.'
                      : 'Focus on your highest-rated topics only.'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* Bookmark a site */}
        <Section title="Bookmark a site">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Save any URL from Roam&apos;s catalog to your Bookmarks collection.
          </p>
          <form onSubmit={handleBookmark} className="flex flex-col gap-3">
            <input
              type="url"
              value={bookmarkUrl}
              onChange={e => { setBookmarkUrl(e.target.value); setBookmarkStatus('idle'); }}
              placeholder="https://…"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
            />
            {bookmarkStatus === 'success' && (
              <p className="text-sm text-green-600 dark:text-green-400">{bookmarkMessage}</p>
            )}
            {bookmarkStatus === 'error' && (
              <p className="text-sm text-red-600">{bookmarkMessage}</p>
            )}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={bookmarkLoading || !bookmarkUrl.trim()}
                className="rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {bookmarkLoading ? 'Saving…' : 'Bookmark'}
              </button>
              {bookmarksCollectionSlug && (
                <Link
                  href={`/c/${bookmarksCollectionSlug}`}
                  className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  View Bookmarks →
                </Link>
              )}
            </div>
          </form>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Email notifications</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Receive updates about your submissions and activity.</p>
            </div>
            <Toggle checked={notifications} onChange={handleNotificationsToggle} disabled={notificationsLoading} />
          </div>
        </Section>

        {/* Security — email users only */}
        <Section title="Security">
          {isEmailUser ? (
            <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">New password</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={e => handlePasswordChange(e.target.value)}
                  className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white ${passwordError ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}
                />
                {newPassword && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div
                        className={`h-1 rounded-full transition-all ${getPasswordStrengthColor(passwordStrength)}`}
                        style={{ width: { weak: '25%', fair: '50%', good: '75%', strong: '100%' }[passwordStrength] }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500">{getPasswordStrengthLabel(passwordStrength)}</span>
                  </div>
                )}
                {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm-password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Confirm password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => handleConfirmChange(e.target.value)}
                  className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white ${confirmError ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}
                />
                {confirmError && <p className="text-xs text-red-600">{confirmError}</p>}
              </div>
              {passwordFormError && <p className="text-sm text-red-600">{passwordFormError}</p>}
              {passwordSuccess && <p className="text-sm text-green-600 dark:text-green-400">{passwordSuccess}</p>}
              <button
                type="submit"
                disabled={passwordLoading || !passwordFormValid}
                className="rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {passwordLoading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              You signed in with <strong className="text-zinc-700 dark:text-zinc-300 capitalize">{provider}</strong>.
              Password management is handled by your {provider === 'google' ? 'Google' : 'GitHub'} account.
            </p>
          )}
        </Section>

        {/* Data & Privacy */}
        <Section title="Data & Privacy">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Download all your data (profile, ratings) as a JSON file.
          </p>
          <button
            type="button"
            onClick={handleExportData}
            disabled={exportLoading}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            {exportLoading ? 'Preparing download…' : 'Download my data'}
          </button>
        </Section>

        {/* Danger zone */}
        <Section title="Danger zone" danger>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Permanently delete your account and all associated data. This action cannot be undone.
                For help, contact{' '}
                <a href="mailto:legal@roamtheweb.app" className="underline">legal@roamtheweb.app</a>.
              </p>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="w-full rounded-lg bg-red-600 text-white py-2.5 text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Delete my account
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
