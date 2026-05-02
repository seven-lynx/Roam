'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { LoadingPage, Button, Card } from '@/components/UI';
import { createClient } from '@/lib/supabase/client';
import { useRequireAuth } from '@/lib/hooks';
import { validatePassword, validatePasswordsMatch, getPasswordStrengthColor, getPasswordStrengthLabel } from '@/lib/validation';

export default function SettingsPage() {
  const { isReady, session } = useRequireAuth();
  const router = useRouter();
  const supabase = createClient();

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('theme') === 'dark';
  });
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'fair' | 'good' | 'strong'>('weak');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadNotificationSettings() {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('email_notifications')
        .eq('user_id', session?.user.id)
        .single();
      if (data) {
        setEmailNotifications(data.email_notifications ?? true);
      }
    } catch (e) {
      // Settings may not exist yet, use default
      void e;
    }
  }

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Load notification settings from user_settings
    loadNotificationSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDarkModeToggle() {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  async function handleNotificationsToggle() {
    setNotificationsLoading(true);
    try {
      const newValue = !emailNotifications;
      await supabase.from('user_settings').upsert(
        {
          user_id: session?.user.id,
          email_notifications: newValue,
        },
        { onConflict: 'user_id' }
      );
      setEmailNotifications(newValue);
    } catch (e) {
      console.error('Failed to update notification settings:', e);
    } finally {
      setNotificationsLoading(false);
    }
  }

  // Validation handlers
  function handleNewPasswordChange(value: string) {
    setNewPassword(value);
    if (!value) {
      setPasswordError(null);
      setPasswordStrength('weak');
      setConfirmPasswordError(null);
      return;
    }
    const validation = validatePassword(value);
    setPasswordError(validation.error || null);
    setPasswordStrength(validation.strength);

    // Check if passwords match
    if (confirmPassword) {
      const matchValidation = validatePasswordsMatch(value, confirmPassword);
      setConfirmPasswordError(matchValidation.error || null);
    }
  }

  function handleConfirmPasswordChange(value: string) {
    setConfirmPassword(value);
    if (!value) {
      setConfirmPasswordError(null);
      return;
    }
    const matchValidation = validatePasswordsMatch(newPassword, value);
    setConfirmPasswordError(matchValidation.error || null);
  }

  // Check if password form is valid for submission
  const isPasswordFormValid =
    newPassword &&
    confirmPassword &&
    !passwordError &&
    !confirmPasswordError &&
    passwordStrength !== 'weak';

  if (!isReady) return <LoadingPage />;

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: err } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (err) {
        setError(err.message);
      } else {
        setSuccess('Password updated successfully');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  async function handleDeleteAccount() {
    if (!confirm('Are you absolutely sure? This action cannot be undone. All your data will be permanently deleted.')) {
      return;
    }
    if (!confirm('This is your final confirmation. Your account and all data will be deleted.')) {
      return;
    }

    setDeleteLoading(true);
    try {
      // Get the user session to access auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Call the delete-user Edge Function
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete account');
      }

      // Account deleted successfully, sign out and redirect
      alert('Your account has been permanently deleted.');
      await supabase.auth.signOut();
      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete account');
      setDeleteLoading(false);
    }
  }

  async function handleExportData() {
    try {
      setLoading(true);
      setError(null);

      // Get the user session to access auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Call the export-user Edge Function
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export-user`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export data');
      }

      // Download the JSON file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roam-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('Your data has been downloaded as JSON');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export data');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-8">Settings</h1>

        {/* Account */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-6">Account</h2>
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex justify-between items-center py-3 border-b border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-600 dark:text-zinc-400">Email address</span>
              <span className="font-medium text-zinc-900 dark:text-white">{session?.user.email}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-zinc-600 dark:text-zinc-400">Account created</span>
              <span className="font-medium text-zinc-900 dark:text-white">
                {new Date(session?.user.created_at || '').toLocaleDateString()}
              </span>
            </div>
          </div>
        </Card>

        {/* Appearance */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-6">Appearance</h2>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Dark mode</span>
            <button
              onClick={handleDarkModeToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                darkMode ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-6">Notifications</h2>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Email notifications</span>
            <button
              onClick={handleNotificationsToggle}
              disabled={notificationsLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailNotifications ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'
              } ${notificationsLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 transition-transform ${
                  emailNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Security */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-6">Security</h2>
          <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">New password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => handleNewPasswordChange(e.target.value)}
                className={`rounded-lg border-2 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 transition-colors ${
                  passwordError
                    ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500'
                    : 'border-zinc-300 dark:border-zinc-700 focus:ring-zinc-900 dark:focus:ring-white'
                }`}
              />
              {newPassword && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${getPasswordStrengthColor(passwordStrength)}`}
                      style={{
                        width:
                          passwordStrength === 'weak'
                            ? '25%'
                            : passwordStrength === 'fair'
                              ? '50%'
                              : passwordStrength === 'good'
                                ? '75%'
                                : '100%',
                      }}
                    />
                  </div>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                    {getPasswordStrengthLabel(passwordStrength)}
                  </span>
                </div>
              )}
              {passwordError && <p className="text-xs text-red-500 mt-1">{passwordError}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Confirm password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                className={`rounded-lg border-2 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 transition-colors ${
                  confirmPasswordError
                    ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500'
                    : 'border-zinc-300 dark:border-zinc-700 focus:ring-zinc-900 dark:focus:ring-white'
                }`}
              />
              {confirmPasswordError && <p className="text-xs text-red-500 mt-1">{confirmPasswordError}</p>}
            </div>

            {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}
            {success && <div className="text-green-600 dark:text-green-400 text-sm">{success}</div>}
            <Button type="submit" disabled={loading || !isPasswordFormValid}>
              {loading ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        </Card>

        {/* Danger zone */}
        <Card className="border-red-200 dark:border-red-900">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-6">Data & Privacy</h2>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Download all your data (profile, ratings, collections) as a JSON file. This is your right under GDPR.
              </p>
              <button
                onClick={handleExportData}
                disabled={loading}
                className="w-full rounded-lg border border-blue-300 dark:border-blue-700 px-4 py-2 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
              >
                {loading ? 'Exporting...' : 'Download my data'}
              </button>
            </div>
            {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}
            {success && <div className="text-green-600 dark:text-green-400 text-sm">{success}</div>}
          </div>
        </Card>

        {/* Danger zone */}
        <Card className="border-red-200 dark:border-red-900 mt-8">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-6">Danger zone</h2>
          <div className="flex flex-col gap-4">
            <button
              onClick={handleSignOut}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-zinc-900 dark:text-white font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              Sign out
            </button>
            <div>
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="w-full rounded-lg bg-red-600 text-white font-semibold px-4 py-2 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? 'Deleting...' : 'Delete account permanently'}
              </button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
