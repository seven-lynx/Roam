'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from './supabase/client';
import { useAuth } from '@/components/AuthProvider';

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastState {
  message: string;
  variant: ToastVariant;
}

export function useToast(duration = 4000) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      setToast({ message, variant });
      setTimeout(() => setToast(null), duration);
    },
    [duration]
  );

  const dismiss = useCallback(() => setToast(null), []);

  return { toast, showToast, dismiss };
}

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
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.push('/signup?mode=signin');
    }
  }, [session, loading, router]);

  const isReady = !loading && !!session;

  return { isReady, session };
}

/**
 * Hook to subscribe to auth state changes (sign in / sign out).
 * Fires the callback whenever the user's session changes.
 */
export function useAuthStateChange(callback: (event: 'SIGNED_IN' | 'SIGNED_OUT', session: unknown) => void) {
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') callback('SIGNED_IN', null);
      else if (event === 'SIGNED_OUT') callback('SIGNED_OUT', null);
    });

    return () => subscription.unsubscribe();
  }, [supabase, callback]);
}
