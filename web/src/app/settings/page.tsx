import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { SettingsClient } from './SettingsClient';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signup?mode=signin');

  const { data: settings } = await supabase
    .from('user_settings')
    .select('email_notifications, preferred_languages, skip_paywalled')
    .eq('user_id', user.id)
    .single();

  const provider = (user.app_metadata?.provider ?? 'email') as string;

  return (
    <SettingsClient
      userId={user.id}
      email={user.email ?? ''}
      provider={provider}
      initialNotifications={settings?.email_notifications ?? true}
      initialLanguages={settings?.preferred_languages ?? ['en']}
      initialSkipPaywalled={settings?.skip_paywalled ?? false}
    />
  );
}