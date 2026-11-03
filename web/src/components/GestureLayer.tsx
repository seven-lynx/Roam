'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkstation, type WindowId } from '@/components/WorkstationContext';
import { click } from '@/lib/sfx';

const SWIPE_DIST = 56; // min px before a drag counts as a swipe
const EDGE = 26; // px from the left/right edge that triggers an edge swipe
const BOTTOM_ZONE = 56; // px from the bottom that trigger swipe-up (the control deck)
const TOP_ZONE = 44; // px from the top that trigger swipe-down (the status bar)

/**
 * Handheld-only touch gestures, wired directly to the `.screen` element:
 *   - swipe up from the bottom  → open the all-apps drawer
 *   - swipe down from the top   → toggle the quick-settings sheet
 *   - swipe in from either edge → back (close the top window, or navigate back)
 * Mouse input is ignored; mouse users (e.g. a desktop browser forced into
 * handheld mode) still have the dock/launcher buttons.
 */
export function GestureLayer() {
  const {
    handheld,
    screenRef,
    appDrawerOpen,
    quickSettingsOpen,
    toggleAppDrawer,
    setAppDrawerOpen,
    toggleQuickSettings,
    closeWindow,
    windows,
  } = useWorkstation();
  const router = useRouter();

  // Always-latest state, read from inside the once-per-mode effect below.
  const live = useRef({ appDrawerOpen, quickSettingsOpen, windows });
  useEffect(() => {
    live.current = { appDrawerOpen, quickSettingsOpen, windows };
  });

  useEffect(() => {
    if (!handheld) return;
    const el = screenRef.current;
    if (!el) return;

    const start = { x: 0, y: 0 };
    let mode: 'none' | 'up' | 'down' | 'back' = 'none';

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      start.x = e.clientX;
      start.y = e.clientY;
      mode = 'none';
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || mode !== 'none') return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < 10 && absY < 10) return;

      const fromBottom = start.y >= el.clientHeight - BOTTOM_ZONE;
      const fromTop = start.y <= TOP_ZONE;
      const fromLeft = start.x <= EDGE;
      const fromRight = start.x >= el.clientWidth - EDGE;

      if (absY > absX) {
        if (fromBottom && dy < -SWIPE_DIST) mode = 'up';
        else if (fromTop && dy > SWIPE_DIST) mode = 'down';
      } else if ((fromLeft && dx > SWIPE_DIST) || (fromRight && dx < -SWIPE_DIST)) {
        mode = 'back';
      }
    };

    const onEnd = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const m = mode;
      mode = 'none';
      if (m === 'none') return;

      if (m === 'up') {
        click();
        if (!live.current.appDrawerOpen) toggleAppDrawer();
      } else if (m === 'down') {
        click();
        if (live.current.appDrawerOpen) setAppDrawerOpen(false);
        toggleQuickSettings();
      } else if (m === 'back') {
        click();
        const ids = (Object.keys(live.current.windows) as WindowId[]).filter((k) => live.current.windows[k]);
        if (ids.length) {
          const top = ids.reduce((a, b) => (live.current.windows[b]!.z > live.current.windows[a]!.z ? b : a), ids[0]);
          closeWindow(top);
        } else {
          router.back();
        }
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', onEnd);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('pointercancel', onEnd);
    };
  }, [handheld, screenRef, toggleAppDrawer, setAppDrawerOpen, toggleQuickSettings, closeWindow, router]);

  return null;
}