'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any pending timeout on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      setToast({ message, variant });
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, duration);
    },
    [duration]
  );

  const dismiss = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
  }, []);

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
  // Memoize the Supabase client to prevent re-creation on every render
  const supabase = useMemo(() => createClient(), []);
  const { session, loading: sessionLoading } = useSession();
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionLoading || !session?.user.id) return;

    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_categories')
          .select('category_id')
          .eq('user_id', session.user.id);

        if (!cancelled) {
          setCategories(data?.map(d => d.category_id) || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [supabase, session?.user.id, sessionLoading]);

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
  // Memoize the Supabase client to prevent re-creation on every render
  const supabase = useMemo(() => createClient(), []);
  // Stable reference to the callback to avoid re-subscribing on every render
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') callbackRef.current('SIGNED_IN', null);
      else if (event === 'SIGNED_OUT') callbackRef.current('SIGNED_OUT', null);
    });

    return () => subscription.unsubscribe();
  }, [supabase, callback]);
}
