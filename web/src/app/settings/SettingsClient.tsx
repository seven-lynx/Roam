'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import * as Sentry from '@sentry/nextjs';
import { validatePassword, validatePasswordsMatch, getPasswordStrengthColor, getPasswordStrengthLabel } from '@/lib/validation';

interface SettingsClientProps {
  userId: string;
  email: string;
  provider: string;
  initialNotifications: boolean;
  initialLanguages: string[];
  initialSkipPaywalled: boolean;
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

// Convert a base64url VAPID key to Uint8Array for pushManager.subscribe
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ── Main component ─────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'ru', label: 'Русский' },
  { code: 'ko', label: '한국어' },
] as const;

export function SettingsClient({
  userId,
  email,
  provider,
  initialNotifications,
  initialLanguages,
  initialSkipPaywalled,
}: SettingsClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const isEmailUser = provider === 'email';

  // Notification toggle
  const [notifications, setNotifications] = useState(initialNotifications);

  // Language preferences
  const [languages, setLanguages] = useState<string[]>(initialLanguages);

  // Paywall skip
  const [skipPaywalled, setSkipPaywalled] = useState(initialSkipPaywalled);

  // Password change (email users only)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'fair' | 'good' | 'strong'>('weak');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);

  // Export / delete
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Push notification state
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // Save settings
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState<string | null>(null);

  // Check push permission on mount
  useEffect(() => {
    checkPushPermission();
  }, []);

  async function checkPushPermission() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub);
      }
    } catch { /* ignore */ }
  }

  async function handlePushToggle() {
    setPushLoading(true);
    setPushError(null);

    if (pushEnabled) {
      // Disable push
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await sub.unsubscribe();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase
                .from('push_tokens')
                .delete()
                .eq('user_id', user.id)
                .eq('platform', 'web');
            }
          }
        }
        setPushEnabled(false);
      } catch {
        setPushError('Failed to disable push notifications');
      }
    } else {
      // Enable push
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setPushError('Notification permission was denied. Please allow notifications in your browser settings.');
          setPushLoading(false);
          return;
        }

        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          setPushError('Service worker not registered. Try refreshing the page.');
          setPushLoading(false);
          return;
        }

        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key) {
          setPushError('Push notifications are not configured yet.');
          setPushLoading(false);
          return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('push_tokens').upsert({
            user_id: user.id,
            platform: 'web',
            token: JSON.stringify(sub.toJSON()),
          });
        }
        setPushEnabled(true);
      } catch {
        setPushError('Failed to enable push notifications');
      }
    }
    setPushLoading(false);
  }

  // Track whether local state has changed from initial values
  const isDirty =
    notifications !== initialNotifications ||
    skipPaywalled !== initialSkipPaywalled ||
    JSON.stringify([...languages].sort()) !== JSON.stringify([...initialLanguages].sort());

  // ── Handlers ───────────────────────────────────────────────────────────
  function handleLanguageToggle(code: string) {
    setSettingsSaveError(null);
    setSettingsSaveSuccess(null);
    const next = languages.includes(code)
      ? languages.filter(c => c !== code)
      : [...languages, code];
    const safe = next.includes('en') ? next : [...next, 'en'];
    setLanguages(safe);
  }

  function handleSkipPaywalledToggle() {
    setSettingsSaveError(null);
    setSettingsSaveSuccess(null);
    setSkipPaywalled(v => !v);
  }

  function handleNotificationsToggle() {
    setSettingsSaveError(null);
    setSettingsSaveSuccess(null);
    setNotifications(v => !v);
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    setSettingsSaveError(null);
    setSettingsSaveSuccess(null);
    try {
      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: userId,
          email_notifications: notifications,
          preferred_languages: languages,
          skip_paywalled: skipPaywalled,
        },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
      setSettingsSaveSuccess('Settings saved successfully.');
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'save-settings' } });
      setSettingsSaveError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
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

        {/* Save settings */}
        {isDirty && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {savingSettings ? 'Saving…' : 'Save settings'}
            </button>
            {settingsSaveError && (
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-4 py-2">{settingsSaveError}</p>
            )}
            {settingsSaveSuccess && (
              <p className="text-sm text-green-600 bg-green-50 dark:bg-green-950/40 rounded-lg px-4 py-2">{settingsSaveSuccess}</p>
            )}
          </div>
        )}

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

        {/* Notifications */}
        <Section title="Notifications">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Email notifications</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Receive updates about your submissions and activity.</p>
            </div>
            <Toggle checked={notifications} onChange={handleNotificationsToggle} disabled={false} />
          </div>
          <div className="flex items-center justify-between mt-4">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Push notifications</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Receive notifications on your device even when the browser is closed.</p>
            </div>
            <Toggle checked={pushEnabled} onChange={handlePushToggle} disabled={pushLoading} />
          </div>
          {pushError && (
            <p className="text-xs text-red-600 mt-2">{pushError}</p>
          )}
        </Section>

        {/* Language preferences */}
        <Section title="Language">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Choose which languages you want to see content in. English is always included.
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(lang => {
              const selected = languages.includes(lang.code);
              const isEnglish = lang.code === 'en';
              return (
                <button
                  key={lang.code}
                  type="button"
                  disabled={isEnglish}
                  onClick={() => handleLanguageToggle(lang.code)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  } ${isEnglish ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Discovery */}
        <Section title="Discovery">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Skip paywalled sites</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Hide pages from NYT, WSJ, The Atlantic, and similar paywalled publications.</p>
            </div>
            <Toggle checked={skipPaywalled} onChange={handleSkipPaywalledToggle} disabled={false} />
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