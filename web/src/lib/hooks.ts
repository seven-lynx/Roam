'use client';

import { useEffect, useState } from 'react';
import { createClient } from './supabase/client';
import type { Session } from '@supabase/supabase-js';

/**
 * Hook to get current user session
 * Handles auth state changes and provides loading state
 */
export function useSession() {
  const supabase = createClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    })();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, [supabase]);

  return { session, loading };
}

/**
 * Hook to get current user profile
 * Requires valid session
 */
export function useProfile() {
  const supabase = createClient();
  const { session, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading || !session?.user.id) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (err) {
          setError(err.message);
          return;
        }

        setProfile(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, session, sessionLoading]);

  return { profile, loading, error };
}

/**
 * Hook to get user's followed categories
 */
export function useUserCategories() {
  const supabase = createClient();
  const { session, loading: sessionLoading } = useSession();
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading || !session?.user.id) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data } = await supabase
          .from('user_categories')
          .select('category_id')
          .eq('user_id', session.user.id);

        setCategories(data?.map(d => d.category_id) || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, session, sessionLoading]);

  return { categories, loading };
}

/**
 * Hook to redirect to login if not authenticated
 */
export function useRequireAuth() {
  const { session, loading } = useSession();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      window.location.href = '/join';
    }
    if (!loading && session) {
      setIsReady(true);
    }
  }, [session, loading]);

  return { isReady, session };
}
