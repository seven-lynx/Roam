'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkstation } from '@/components/WorkstationContext';
import type { WindowRouteMatch } from '@/lib/os-routes';

/**
 * Rendered in place of page content when the current URL is an internal app
 * route. Opens the route in the shared app-style window and normalizes the
 * address back to the desktop, so the window has real chrome and both "Show
 * Desktop" and the browser's back button behave as expected.
 */
export function AppRouteWindow({ route }: { route: WindowRouteMatch }) {
  const { openAppView } = useWorkstation();
  const router = useRouter();
  const lastHref = useRef<string | null>(null);

  useEffect(() => {
    if (lastHref.current !== route.href) {
      lastHref.current = route.href;
      openAppView(route.href, route.title);
    }
    router.replace('/');
  }, [route.href, route.title, openAppView, router]);

  return null;
}
