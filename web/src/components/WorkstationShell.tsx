'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { WorkstationContext } from '@/components/WorkstationContext';
import { StatusBar } from '@/components/StatusBar';
import { HardwareDeck } from '@/components/HardwareDeck';
import { Launcher } from '@/components/Launcher';
import FeedbackWidget from '@/components/FeedbackWidget';
import { ScanSequence } from '@/components/ScanSequence';

const FX_KEY = 'roam-fx';

/**
 * The device. Everything the site shows renders on `.screen`; the window
 * itself never scrolls. Fixed-position descendants (dialogs, toasts, banners)
 * are scoped to the screen by CSS containment.
 *
 * `overlays` (CRT layers, flashlight, boot) and `rails` (desk clutter) are
 * passed in as slots so this component stays focused on layout and state.
 */
export function WorkstationShell({
  children,
  overlays,
  rails,
}: {
  children: ReactNode;
  overlays?: ReactNode;
  rails?: ReactNode;
}) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fx, setFxState] = useState(true);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(FX_KEY) === 'off') setFxState(false);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);

  const setFx = useCallback((on: boolean) => {
    setFxState(on);
    try {
      localStorage.setItem(FX_KEY, on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }, []);

  // Next only resets window scroll on navigation, so reset the screen's own
  // scroller, honouring #hash anchors, and close any open overlay.
  useEffect(() => {
    setLauncherOpen(false);
    setScanOpen(false);
    const el = scrollRef.current;
    if (!el) return;
    const hash = window.location.hash.slice(1);
    const target = hash ? document.getElementById(decodeURIComponent(hash)) : null;
    if (target && el.contains(target)) target.scrollIntoView({ block: 'start' });
    else el.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  const value = useMemo(
    () => ({
      scrollRef, fx, setFx, launcherOpen, setLauncherOpen,
      feedbackOpen, setFeedbackOpen, scanOpen, setScanOpen,
    }),
    [fx, setFx, launcherOpen, feedbackOpen, scanOpen],
  );

  return (
    <WorkstationContext.Provider value={value}>
      <div className="desk">
        {rails}
        <div className="chassis">
          <div className="bezel">
            <div className="screen" data-fx={fx ? 'on' : 'off'}>
              <StatusBar />
              <div
                ref={scrollRef}
                id="screen-scroll"
                className="screen-scroll"
                role="region"
                aria-label="Screen"
                tabIndex={0}
              >
                {children}
              </div>
              <Launcher />
              <ScanSequence />
              <FeedbackWidget />
              {overlays}
            </div>
          </div>
          <HardwareDeck onRoam={() => setScanOpen(true)} />
        </div>
      </div>
    </WorkstationContext.Provider>
  );
}
