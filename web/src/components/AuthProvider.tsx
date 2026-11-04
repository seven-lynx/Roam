'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

// Stable singleton — avoids re-creating the client on every render
const supabaseClient = createClient();
export interface Profile {
  id: string;
  username: string | null;
  email: string;
  bio?: string;
  avatar_url?: string;
  walkthrough_completed_at?: string | null;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  walkthroughCompleted: boolean;
  /** Re-fetches the profile from the DB (e.g. after the walkthrough finishes). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  walkthroughCompleted: false,
  refresh: async () => undefined,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  initialSession: Session | null;
  children: React.ReactNode;
}

export function AuthProvider({ initialSession, children }: AuthProviderProps) {
  const supabase = supabaseClient;
  const [session, setSession] = useState<Session | null>(initialSession);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, email, bio, avatar_url, walkthrough_completed_at')
        .eq('id', userId)
        .single();
      setProfile(data ?? null);
    },
    [supabase],
  );

  // Load profile whenever session changes.
  useEffect(() => {
    if (session?.user.id) {
      loadProfile(session.user.id);
    } else {
      setProfile(null);
    }
  }, [session, loadProfile]);

  const refresh = useCallback(async () => {
    if (session?.user.id) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, initialSession]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, walkthroughCompleted: profile?.walkthrough_completed_at != null, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}