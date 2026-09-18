'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
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

  useEffect(() => {
    // Load profile whenever session changes
    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, email, bio, avatar_url')
        .eq('id', userId)
        .single();
      setProfile(data ?? null);
    }

    if (session?.user.id) {
      loadProfile(session.user.id);
    } else {
      setProfile(null);
    }
  }, [session, supabase]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, initialSession]);

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
