'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';
import { LAUNCHER_GROUPS } from '@/lib/os-nav';
import { EXTENSION_URLS } from '@/lib/constants';

/** MENU key window: every route that doesn't have its own hardware key. */
export function Launcher() {
  const { isOpen } = useWorkstation();
  const { session } = useAuth();
  const open = isOpen('launcher');
  const signedIn = !!session;

  if (!open) return null;

  return (
    <Window id="launcher" icon={<span aria-hidden="true">▤</span>}>
      <div className="window-scroll">
        <div className="px-5 py-5">
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
    </Window>
  );
}