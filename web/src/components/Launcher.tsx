'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation } from '@/components/WorkstationContext';
import { LAUNCHER_GROUPS } from '@/lib/os-nav';
import { EXTENSION_URLS } from '@/lib/constants';

/** MENU key overlay: every route that doesn't have its own hardware key. */
export function Launcher() {
  const { launcherOpen, setLauncherOpen } = useWorkstation();
  const { session } = useAuth();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!launcherOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLauncherOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [launcherOpen, setLauncherOpen]);

  if (!launcherOpen) return null;

  const signedIn = !!session;
  const close = () => setLauncherOpen(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Program launcher"
      className="absolute inset-0 z-40 overflow-y-auto bg-screen/95 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="kicker">[ launcher ]</div>
            <h2 className="mt-1 font-pixel text-lg tracking-[0.2em] text-ink">PROGRAMS</h2>
          </div>
          <button ref={closeRef} type="button" onClick={close} className="btn btn-secondary text-xs">Close ✕</button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {LAUNCHER_GROUPS.map((group) => {
            const items = group.items.filter((i) => i.auth === undefined || i.auth === signedIn);
            if (items.length === 0) return null;
            return (
              <section key={group.title} className="panel">
                <div className="panel-head"><span className="led" />{group.title}</div>
                <ul className="p-2">
                  {items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        className="flex items-baseline justify-between gap-3 px-3 py-2 font-mono text-sm text-ink hover:bg-panel-3"
                      >
                        <span>{item.label}</span>
                        <span className="text-[10px] tracking-wider text-muted">{item.file}</span>
                      </Link>
                    </li>
                  ))}
                  {group.title === 'Get the app' && (
                    <>
                      <li>
                        <a href={EXTENSION_URLS.chrome} target="_blank" rel="noopener noreferrer" className="flex items-baseline justify-between gap-3 px-3 py-2 font-mono text-sm text-ink hover:bg-panel-3">
                          <span>Chrome Web Store</span><span className="text-[10px] text-muted">↗</span>
                        </a>
                      </li>
                      <li>
                        <a href={EXTENSION_URLS.firefox} target="_blank" rel="noopener noreferrer" className="flex items-baseline justify-between gap-3 px-3 py-2 font-mono text-sm text-ink hover:bg-panel-3">
                          <span>Firefox Add-ons</span><span className="text-[10px] text-muted">↗</span>
                        </a>
                      </li>
                    </>
                  )}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-6 text-center font-mono text-[11px] text-muted">
          <a href="mailto:support@roamtheweb.app" className="hover:text-ink">support@roamtheweb.app</a>
          {' · '}
          <a href="https://github.com/seven-lynx/Roam" target="_blank" rel="noopener noreferrer" className="hover:text-ink">GitHub</a>
        </p>
      </div>
    </div>
  );
}
