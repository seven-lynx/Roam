'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useShellMode } from '@/components/ShellModeContext';

/**
 * The homepage has two faces: in ROAM-OS the `/` route is the cyberdeck desktop
 * (its own page content, e.g. the marketing landing, must be hidden), while in
 * Roam Classic `/` is the original full landing page. This client gate renders
 * its children only when the classic shell is active.
 */
export function HomeGate({ children }: { children: ReactNode }) {
  const { mode } = useShellMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Server render + first paint default to ROAM-OS (the desktop); once the
  // persisted mode is known, classic re-renders with the landing content.
  if (!mounted) return null;
  return mode === 'classic' ? <>{children}</> : null;
}
