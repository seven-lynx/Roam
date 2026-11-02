'use client';

import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { useWorkstation, TOP_BAR_H, DOCK_H, type WindowId, type WindowRect } from '@/components/WorkstationContext';
import { click } from '@/lib/sfx';

interface WindowProps {
  id: WindowId;
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * A desktop window: draggable title bar, working minimize / maximize-restore /
 * close, and z-order focus. Position and view state live in the workstation
 * context; this component only renders chrome and reports pointer gestures.
 */
export function Window({ id, icon, children }: WindowProps) {
  const { windows, screenRef, focusWindow, minimizeWindow, toggleMaximize, closeWindow, moveWindow, handheld } = useWorkstation();
  const win = windows[id];
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const resize = useRef<{ dir: string; px: number; py: number; r: WindowRect } | null>(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  if (!win || win.minimized) return null;

  // The topmost visible window is "focused"; give it a brighter chrome.
  const visibleIds = (Object.keys(windows) as WindowId[]).filter((w) => windows[w] && !windows[w]!.minimized);
  const topZ = visibleIds.reduce((m, w) => Math.max(m, windows[w]!.z), 0);
  const focused = win.z === topZ;

  // Handheld layout forces every window full-screen (between the status bar and
  // the dock) without mutating the saved desktop geometry.
  const maximized = win.maximized || handheld;

  const style: CSSProperties = {
    zIndex: 30 + win.z,
    ...(maximized
      ? { left: 0, top: TOP_BAR_H, width: '100%', height: `calc(100% - ${TOP_BAR_H + DOCK_H}px)` }
      : { left: win.rect.x, top: win.rect.y, width: win.rect.w, height: win.rect.h }),
  };

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (maximized) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: win.rect.x, oy: win.rect.y };
  };

  const onDragMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || maximized) return;
    const el = screenRef.current;
    const dx = e.clientX - drag.current.px;
    const dy = e.clientY - drag.current.py;
    const maxX = Math.max(0, (el ? el.clientWidth : window.innerWidth) - win.rect.w);
    const maxY = Math.max(TOP_BAR_H, (el ? el.clientHeight : window.innerHeight) - DOCK_H - win.rect.h);
    const x = Math.min(Math.max(0, drag.current.ox + dx), maxX);
    const y = Math.min(Math.max(TOP_BAR_H, drag.current.oy + dy), maxY);
    moveWindow(id, { ...win.rect, x, y });
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  };

  const startResize = (e: PointerEvent<HTMLSpanElement>) => {
    if (maximized) return;
    const dir = e.currentTarget.dataset.dir ?? 'se';
    e.currentTarget.setPointerCapture(e.pointerId);
    resize.current = { dir, px: e.clientX, py: e.clientY, r: win.rect };
  };

  const onResizeMove = (e: PointerEvent<HTMLSpanElement>) => {
    const d = resize.current;
    if (!d || maximized) return;
    const el = screenRef.current;
    const maxW = el ? el.clientWidth : window.innerWidth;
    const maxH = el ? el.clientHeight - DOCK_H : window.innerHeight - DOCK_H;
    const MIN_W = 280;
    const MIN_H = 240;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    let { x, y, w, h } = d.r;
    if (d.dir.includes('e')) w = Math.min(d.r.w + dx, maxW - d.r.x);
    if (d.dir.includes('s')) h = Math.min(d.r.h + dy, maxH - d.r.y);
    if (d.dir.includes('w')) {
      const nw = Math.max(MIN_W, d.r.w - dx);
      x = d.r.x + (d.r.w - nw);
      w = nw;
    }
    if (d.dir.includes('n')) {
      const nh = Math.min(d.r.h - dy, d.r.y + d.r.h - TOP_BAR_H);
      const clamped = Math.max(MIN_H, nh);
      y = Math.max(TOP_BAR_H, d.r.y + (d.r.h - clamped));
      h = clamped;
    }
    if (w < MIN_W) w = MIN_W;
    if (h < MIN_H) h = MIN_H;
    if (y < TOP_BAR_H) y = TOP_BAR_H;
    moveWindow(id, { x, y, w, h });
  };

  const endResize = (e: PointerEvent<HTMLSpanElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    resize.current = null;
  };

  return (
    <section
      ref={ref}
      role="dialog"
      aria-label={win.title}
      tabIndex={-1}
      className={`window${maximized ? ' window--max' : ''}${handheld ? ' window--handheld' : ''}${focused ? ' window--focused' : ''}`}
      style={style}
      onPointerDown={() => focusWindow(id)}
    >
      <header
        className="window-bar"
        onPointerDown={startDrag}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => {
          if (handheld) return;
          if ((e.target as HTMLElement).closest('button')) return;
          click();
          toggleMaximize(id);
        }}
      >
        <span className="window-icon" aria-hidden="true">{icon}</span>
        <span className="window-title">{win.title}</span>
        <span className="window-controls">
          <button type="button" className="win-btn" onClick={() => { click(); minimizeWindow(id); }} aria-label="Minimize">–</button>
          {!handheld && (
            <button type="button" className="win-btn" onClick={() => { click(); toggleMaximize(id); }} aria-label={maximized ? 'Restore' : 'Maximize'}>
              {maximized ? '❐' : '□'}
            </button>
          )}
          <button type="button" className="win-btn win-btn--close" onClick={() => { click(880, 0.05, 0.1); closeWindow(id); }} aria-label="Close">✕</button>
        </span>
      </header>
      <div className="window-body">{children}</div>
      {!maximized && (
        <>
          <span className="win-resize win-resize--n" data-dir="n" onPointerDown={startResize} onPointerMove={onResizeMove} onPointerUp={endResize} onPointerCancel={endResize} />
          <span className="win-resize win-resize--s" data-dir="s" onPointerDown={startResize} onPointerMove={onResizeMove} onPointerUp={endResize} onPointerCancel={endResize} />
          <span className="win-resize win-resize--e" data-dir="e" onPointerDown={startResize} onPointerMove={onResizeMove} onPointerUp={endResize} onPointerCancel={endResize} />
          <span className="win-resize win-resize--w" data-dir="w" onPointerDown={startResize} onPointerMove={onResizeMove} onPointerUp={endResize} onPointerCancel={endResize} />
          <span className="win-resize win-resize--nw" data-dir="nw" onPointerDown={startResize} onPointerMove={onResizeMove} onPointerUp={endResize} onPointerCancel={endResize} />
          <span className="win-resize win-resize--ne" data-dir="ne" onPointerDown={startResize} onPointerMove={onResizeMove} onPointerUp={endResize} onPointerCancel={endResize} />
          <span className="win-resize win-resize--sw" data-dir="sw" onPointerDown={startResize} onPointerMove={onResizeMove} onPointerUp={endResize} onPointerCancel={endResize} />
          <span className="win-resize win-resize--se" data-dir="se" onPointerDown={startResize} onPointerMove={onResizeMove} onPointerUp={endResize} onPointerCancel={endResize} />
        </>
      )}
    </section>
  );
}