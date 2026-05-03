'use client';

import { useEffect, useState } from 'react';
import { createClient } from './supabase/client';
import { useAuth } from '@/components/AuthProvider';

export type { Profile } from '@/components/AuthProvider';

/** Thin wrapper — prefer useAuth() directly. */
export function useSession() {
  const { session, loading } = useAuth();
  return { session, loading };
}

/** Thin wrapper — prefer useAuth() directly. */
export function useProfile() {
  const { profile, loading } = useAuth();
  return { profile, loading, error: null };
}

/**
 * Hook to get user's followed categories
 */
export function useUserCategories() {
  const supabase = createClient();
  const { session, loading: sessionLoading } = useSession();
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionLoading || !session?.user.id) return;

    setLoading(true);
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

  useEffect(() => {
    if (!loading && !session) {
      window.location.href = '/join';
    }
  }, [session, loading]);

  const isReady = !loading && !!session;

  return { isReady, session };
}
