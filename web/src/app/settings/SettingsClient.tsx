'use client';

import { useState, useEffect, useRef } from 'react';
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

type SettingsTab = 'account' | 'notifications' | 'language' | 'discovery' | 'security' | 'data' | 'danger';

const TABS: { id: SettingsTab; label: string; icon: string; danger?: boolean }[] = [
  { id: 'account', label: 'Account', icon: '👤' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'language', label: 'Language', icon: '🌐' },
  { id: 'discovery', label: 'Discovery', icon: '🎯' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'data', label: 'Data & Privacy', icon: '📁' },
  { id: 'danger', label: 'Danger Zone', icon: '⚠️', danger: true },
];

// ── Two-step delete modal ─────────────────────────────────────────────────
function DeleteModal({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: () => void; loading: boolean }) {
  const [step, setStep] = useState<1 | 2>(1);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-screen/60 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm bg-panel rounded-2xl shadow-xl p-8 flex flex-col gap-5">
        {step === 1 ? (
          <>
            <h2 className="text-xl font-bold text-ink">Delete your account?</h2>
            <p className="text-sm text-muted">
              This will permanently delete your profile, ratings, and all data. There is no undo.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-lg border border-line py-2 text-sm font-medium text-muted hover:bg-panel-2 hover:bg-panel-2 transition-colors">
                Cancel
              </button>
              <button onClick={() => setStep(2)} className="flex-1 rounded-lg bg-danger text-ink py-2 text-sm font-medium hover:bg-danger transition-colors">
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-danger">Final confirmation</h2>
            <p className="text-sm text-muted">
              Are you absolutely sure? This cannot be undone. Your account will be gone permanently.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-lg border border-line py-2 text-sm font-medium text-muted hover:bg-panel-2 hover:bg-panel-2 transition-colors">
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 rounded-lg bg-danger text-ink py-2 text-sm font-medium hover:bg-danger disabled:opacity-50 transition-colors"
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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-panel bg-panel' : 'bg-panel-3 bg-panel-2'} disabled:opacity-50`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-panel transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

// ── Section card ──────────────────────────────────────────────────────────
function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={`rounded-2xl border p-6 ${danger ? 'border-danger border-danger' : 'border-line'}`}>
      <h2 className={`text-lg font-semibold mb-5 ${danger ? 'text-danger text-danger' : 'text-ink'}`}>{title}</h2>
      {children}
    </section>
  );
}

// Convert a base64url VAPID key to Uint8Array for pushManager.subscribe
function urlBase64ToUint8Array(base64String: string): ArrayBufferView {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as ArrayBufferView;
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
  const [tab, setTab] = useState<SettingsTab>('account');

  // Notification toggle
  const [notifications, setNotifications] = useState(initialNotifications);

  // Language preferences
  const [languages, setLanguages] = useState<string[]>(initialLanguages);

  // Paywall skip
  const [skipPaywalled, setSkipPaywalled] = useState(initialSkipPaywalled);

  // Password change (email users only)
  const [currentPassword, setCurrentPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
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

  // Debounce auto-save
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

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

  // Debounce auto-save
  useEffect(() => {
    if (!isDirty) {
      isDirtyRef.current = false;
      return;
    }
    isDirtyRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (isDirtyRef.current) handleSaveSettings();
    }, 2_000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, skipPaywalled, languages]);

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

  useEffect(() => { checkPushPermission(); }, []);

  async function handlePushToggle() {
    setPushLoading(true);
    setPushError(null);
    if (pushEnabled) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await sub.unsubscribe();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) await supabase.from('push_tokens').delete().eq('user_id', user.id).eq('platform', 'web');
          }
        }
        setPushEnabled(false);
      } catch { setPushError('Failed to disable push notifications'); }
    } else {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { setPushError('Permission denied'); setPushLoading(false); return; }
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) { setPushError('Service worker not registered'); setPushLoading(false); return; }
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key) { setPushError('Push not configured'); setPushLoading(false); return; }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('push_tokens').upsert({ user_id: user.id, platform: 'web', token: JSON.stringify(sub.toJSON()) }, { onConflict: 'user_id,platform,token' });
        setPushEnabled(true);
      } catch { setPushError('Failed to enable push notifications'); }
    }
    setPushLoading(false);
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
      // Re-authenticate with current password first (AAL2 requirement)
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) {
        setCurrentPasswordError('Current password is incorrect.');
        setPasswordLoading(false);
        return;
      }

      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) { setPasswordFormError(err.message); return; }
      setPasswordSuccess('Password updated.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'password-change' } });
      setPasswordFormError(err instanceof Error ? err.message : 'Failed to update password');
    } finally { setPasswordLoading(false); }
  }

  async function handleExportData() {
    setExportLoading(true);
    setGlobalError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export-user`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? 'Export failed'); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `roam-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'export-data' } });
      setGlobalError(err instanceof Error ? err.message : 'Failed to export data');
    } finally { setExportLoading(false); }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? 'Failed to delete account'); }
      await supabase.auth.signOut();
      router.replace('/');
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'delete-account' } });
      setGlobalError(err instanceof Error ? err.message : 'Failed to delete account');
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  }

  const passwordFormValid = currentPassword && newPassword && confirmPassword && !passwordError && !confirmError && passwordStrength !== 'weak';

  return (
    <div className="min-h-full bg-screen">
      {showDeleteModal && (
        <DeleteModal onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteAccount} loading={deleteLoading} />
      )}

      <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-8">
        <h1 className="text-2xl font-bold text-ink">Settings</h1>

        {globalError && (
          <p className="text-sm text-danger bg-panel-2 bg-panel-2/40 rounded-lg px-4 py-2">{globalError}</p>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <nav className="flex md:flex-col gap-1 md:w-48 shrink-0 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  tab === t.id
                    ? 'bg-panel-2 text-ink shadow-sm'
                    : t.danger
                      ? 'text-danger text-danger hover:text-danger hover:text-danger hover:bg-panel-2 hover:bg-panel-2/30'
                      : 'text-muted hover:text-ink hover:bg-panel-2'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Save settings bar — shown on any dirty tab */}
            {isDirty && (
              <div className="flex flex-col gap-2 mb-6">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="rounded-lg bg-accent text-ink py-2.5 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  {savingSettings ? 'Saving…' : 'Save settings'}
                </button>
                {settingsSaveError && <p className="text-sm text-danger bg-panel-2 bg-panel-2/40 rounded-lg px-4 py-2">{settingsSaveError}</p>}
                {settingsSaveSuccess && <p className="text-sm text-ok bg-panel-2 bg-panel-2/40 rounded-lg px-4 py-2">{settingsSaveSuccess}</p>}
              </div>
            )}

            {/* ── Account Tab ─────────────────────────────── */}
            {tab === 'account' && (
              <Section title="Account">
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-line border-line">
                    <span className="text-muted">Email</span>
                    <span className="font-medium text-ink">{email}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted">Sign-in method</span>
                    <span className="font-medium text-ink capitalize">
                      {provider === 'email' ? 'Email & password' : provider}
                    </span>
                  </div>
                </div>
              </Section>
            )}

            {/* ── Notifications Tab ──────────────────────── */}
            {tab === 'notifications' && (
              <Section title="Notifications">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">Email notifications</p>
                    <p className="text-xs text-muted">Receive updates about your submissions and activity.</p>
                  </div>
                  <Toggle checked={notifications} onChange={handleNotificationsToggle} />
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-sm font-medium text-ink">Push notifications</p>
                    <p className="text-xs text-muted">Receive notifications on your device even when the browser is closed.</p>
                  </div>
                  <Toggle checked={pushEnabled} onChange={handlePushToggle} disabled={pushLoading} />
                </div>
                {pushError && <p className="text-xs text-danger mt-2">{pushError}</p>}
              </Section>
            )}

            {/* ── Language Tab ─────────────────────────────── */}
            {tab === 'language' && (
              <Section title="Language">
                <p className="text-xs text-muted mb-3">
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
                            ? 'bg-panel bg-panel text-ink text-ink'
                            : 'bg-panel-2 text-muted hover:bg-panel-3'
                        } ${isEnglish ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* ── Discovery Tab ──────────────────────────── */}
            {tab === 'discovery' && (
              <Section title="Discovery">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">Skip paywalled sites</p>
                    <p className="text-xs text-muted">Hide pages from NYT, WSJ, The Atlantic, and similar paywalled publications.</p>
                  </div>
                  <Toggle checked={skipPaywalled} onChange={handleSkipPaywalledToggle} />
                </div>
              </Section>
            )}

            {/* ── Security Tab ──────────────────────────── */}
            {tab === 'security' && (
              <Section title="Security">
                {isEmailUser ? (
                  <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4" noValidate>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="current-password" className="text-sm font-medium text-muted">Current password</label>
                      <input id="current-password" type="password" autoComplete="current-password" value={currentPassword}
                        onChange={e => {
                          setCurrentPassword(e.target.value);
                          setCurrentPasswordError(null);
                        }}
                        className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-panel text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-line ${currentPasswordError ? 'border-danger' : 'border-line'}`}
                      />
                      {currentPasswordError && <p className="text-xs text-danger">{currentPasswordError}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="new-password" className="text-sm font-medium text-muted">New password</label>
                      <input id="new-password" type="password" autoComplete="new-password" value={newPassword}
                        onChange={e => handlePasswordChange(e.target.value)}
                        className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-panel text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-line ${passwordError ? 'border-danger' : 'border-line'}`}
                      />
                      {newPassword && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-panel-3 bg-panel-2">
                            <div className={`h-1 rounded-full transition-all ${getPasswordStrengthColor(passwordStrength)}`}
                              style={{ width: { weak: '25%', fair: '50%', good: '75%', strong: '100%' }[passwordStrength] }}
                            />
                          </div>
                          <span className="text-xs text-muted">{getPasswordStrengthLabel(passwordStrength)}</span>
                        </div>
                      )}
                      {passwordError && <p className="text-xs text-danger">{passwordError}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="confirm-password" className="text-sm font-medium text-muted">Confirm password</label>
                      <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword}
                        onChange={e => handleConfirmChange(e.target.value)}
                        className={`w-full rounded-lg border px-4 py-2.5 text-sm bg-panel text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:ring-line ${confirmError ? 'border-danger' : 'border-line'}`}
                      />
                      {confirmError && <p className="text-xs text-danger">{confirmError}</p>}
                    </div>
                    {passwordFormError && <p className="text-sm text-danger">{passwordFormError}</p>}
                    {passwordSuccess && <p className="text-sm text-ok">{passwordSuccess}</p>}
                    <button type="submit" disabled={passwordLoading || !passwordFormValid}
                      className="rounded-lg bg-panel bg-panel text-ink text-ink py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >{passwordLoading ? 'Updating…' : 'Update password'}</button>
                  </form>
                ) : (
                  <p className="text-sm text-muted">
                    You signed in with <strong className="text-muted capitalize">{provider}</strong>.
                    Password management is handled by your {provider === 'google' ? 'Google' : 'GitHub'} account.
                  </p>
                )}
              </Section>
            )}

            {/* ── Data Tab ──────────────────────────────── */}
            {tab === 'data' && (
              <Section title="Data & Privacy">
                <p className="text-sm text-muted mb-4">
                  Download all your data (profile, ratings) as a JSON file.
                </p>
                <button type="button" onClick={handleExportData} disabled={exportLoading}
                  className="w-full rounded-lg border border-line py-2.5 text-sm font-medium text-muted hover:bg-panel-2 hover:bg-panel-2 disabled:opacity-50 transition-colors"
                >{exportLoading ? 'Preparing download…' : 'Download my data'}</button>
              </Section>
            )}

            {/* ── Danger Tab ────────────────────────────── */}
            {tab === 'danger' && (
              <Section title="Danger Zone" danger>
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-sm text-muted mb-3">
                      Permanently delete your account and all associated data. This action cannot be undone.
                      For help, contact{' '}
                      <a href="mailto:legal@roamtheweb.app" className="underline">legal@roamtheweb.app</a>.
                    </p>
                    <button type="button" onClick={() => setShowDeleteModal(true)}
                      className="w-full rounded-lg bg-danger text-ink py-2.5 text-sm font-semibold hover:bg-danger transition-colors"
                    >Delete my account</button>
                  </div>
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}