'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation, type WindowId } from '@/components/WorkstationContext';
import type { AppEntry } from './os-apps';

/**
 * Shared launcher for every app surface (home screen tiles, folder overlays,
 * the all-apps drawer). Centralises the diegetic sign-in gate and the mapping
 * of an `AppEntry` to its actual effect — route push, window open, program
 * launch, external tab, or in-OS action.
 */
export function useAppLauncher() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const { openWindow, setInspect, openDeckLauncher, showAlert, showConfirm, openAppView, openUrl } = useWorkstation();
  const signedIn = !!session;

  const gate = (app: AppEntry): boolean => {
    if (app.auth === true && !signedIn) {
      showAlert('ACCESS DENIED', `${app.label} requires a signed-in operator.\n\nRedirecting to sign-in…`);
      router.push('/signup?mode=signin');
      return true;
    }
    return false;
  };

  const launch = (app: AppEntry) => {
    if (gate(app)) return;

    if (app.external) {
      openUrl({ url: app.external, title: app.label });
      return;
    }
    if (app.href) {
      if (app.href.startsWith('/signup') || app.href.startsWith('/forgot') || app.href.startsWith('/auth/')) {
        router.push(app.href);
      } else {
        openAppView(app.href, app.label);
      }
      return;
    }
    if (app.program) {
      openWindow(app.program as WindowId);
      return;
    }
    if (app.window) {
      openWindow(app.window as WindowId);
      return;
    }
    if (app.action) {
      switch (app.action) {
        case 'inspect':
          setInspect(true);
          break;
        case 'roam':
          openWindow('scan');
          break;
        case 'deckview':
          openDeckLauncher();
          break;
        case 'desktop':
          if (pathname !== '/' && pathname !== '/desktop') router.push('/');
          break;
        case 'settings':
          openWindow('settings');
          break;
        case 'report':
          showConfirm('REPORT BROKEN LINK', 'Flag this page as broken? It will be hidden after review.', {
            danger: true,
            confirmLabel: 'Report',
            onConfirm: () => openWindow('feedback'),
          });
          break;
        default:
          break;
      }
    }
  };

  return { launch, signedIn };
}
