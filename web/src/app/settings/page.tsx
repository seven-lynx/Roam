'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { LoadingPage, Button, Card, Input } from '@/components/UI';
import { createClient } from '@/lib/supabase/client';
import { useRequireAuth } from '@/lib/hooks';

export default function SettingsPage() {
  const { isReady, session } = useRequireAuth();
  const router = useRouter();
  const supabase = createClient();

  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  useEffect(() => {
    // Load dark mode preference from localStorage
    const isDark = localStorage.getItem('theme') === 'dark';
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }

    // Load notification settings from user_settings
    loadNotificationSettings();
  }, []);

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
    }
  }

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

  if (!isReady) return <LoadingPage />;

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

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
    if (!confirm('Are you absolutely sure? This cannot be undone.')) return;

    setLoading(true);
    try {
      // This should be implemented via an edge function
      // For now, just sign out and inform user
      await supabase.auth.signOut();
      alert('Please contact legal@roamtheweb.app to complete account deletion');
      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete account');
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
            <Input
              label="New password"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required={true}
            />
            <Input
              label="Confirm password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required={true}
            />
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {success && <div className="text-green-600 text-sm">{success}</div>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        </Card>

        {/* Danger zone */}
        <Card className="border-red-200 dark:border-red-900">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-6">Danger zone</h2>
          <div className="flex flex-col gap-4">
            <button
              onClick={handleSignOut}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-zinc-900 dark:text-white font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              Sign out
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={loading}
              className="w-full rounded-lg bg-red-600 text-white font-semibold px-4 py-2 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Delete account
            </button>
          </div>
        </Card>
      </main>
    </div>
  );
}
