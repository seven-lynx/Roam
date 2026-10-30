'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_KEYS, isActivePath } from '@/lib/os-nav';
import { KeyIcon } from '@/components/KeyIcon';
import { useWorkstation } from '@/components/WorkstationContext';

const SCROLL_STEP = 220;

/**
 * Physical controls under the screen. Route keys are real links (keyboard
 * accessible and crawlable); the rest are buttons wired to the workstation.
 */
export function HardwareDeck({ onRoam }: { onRoam: () => void }) {
  const pathname = usePathname();
  const { scrollRef, fx, setFx, launcherOpen, setLauncherOpen, setFeedbackOpen } = useWorkstation();

  const scrollBy = (top: number, left = 0) =>
    scrollRef.current?.scrollBy({ top, left, behavior: 'smooth' });

  return (
    <div className="deck" role="group" aria-label="Hardware controls">
      <div className="deck-brand" aria-hidden="true">
        <span className="plate">
          <span className="power-led" /> ROAM-OS
        </span>
        <img src="/7lynx-logo.png" alt="" className="lynx-mark" />
      </div>

      <nav className="deck-keys" aria-label="Main">
        {PRIMARY_KEYS.map((k) => {
          const active = isActivePath(pathname, k.href);
          return (
            <Link
              key={k.href}
              href={k.href}
              className="keycap"
              aria-current={active ? 'page' : undefined}
              title={k.file}
            >
              <KeyIcon name={k.icon} />
              <span className="keycap-label">{k.label}</span>
              <span className="key-led" aria-hidden="true" />
            </Link>
          );
        })}
        <button
          type="button"
          className="keycap"
          aria-expanded={launcherOpen}
          aria-haspopup="dialog"
          onClick={() => setLauncherOpen(!launcherOpen)}
          title="menu"
        >
          <KeyIcon name="menu" />
          <span className="keycap-label">Menu</span>
          <span className="key-led" aria-hidden="true" />
        </button>
        <button type="button" className="keycap keycap--roam" onClick={onRoam} title="roam scan">
          <KeyIcon name="roam" />
          <span className="keycap-label">Roam</span>
          <span className="key-led" aria-hidden="true" />
        </button>
      </nav>

      <div className="deck-side">
        <div className="dpad" role="group" aria-label="Scroll the screen">
          <button type="button" className="up" aria-label="Scroll up" onClick={() => scrollBy(-SCROLL_STEP)}>▲</button>
          <button type="button" className="down" aria-label="Scroll down" onClick={() => scrollBy(SCROLL_STEP)}>▼</button>
          <button type="button" className="left" aria-label="Scroll left" onClick={() => scrollBy(0, -SCROLL_STEP)}>◀</button>
          <button type="button" className="right" aria-label="Scroll right" onClick={() => scrollBy(0, SCROLL_STEP)}>▶</button>
        </div>
        <div className="flex flex-col gap-2 items-center">
          <button type="button" className="keycap !flex-none !px-3" onClick={() => setFeedbackOpen(true)} title="roam comms">
            <KeyIcon name="comms" className="w-3.5 h-3.5" />
            <span className="keycap-label">Comms</span>
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={fx}
            aria-label="CRT effects"
            className="switch"
            onClick={() => setFx(!fx)}
          >
            <span className="switch-track"><span className="switch-thumb" /></span>
            FX
          </button>
        </div>
      </div>
    </div>
  );
}
