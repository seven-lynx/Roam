'use client';

import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { useWorkstation, type WindowId } from '@/components/WorkstationContext';

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
  const { windows, screenRef, focusWindow, minimizeWindow, toggleMaximize, closeWindow, moveWindow } = useWorkstation();
  const win = windows[id];
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  if (!win || win.minimized) return null;

  const style: CSSProperties = {
    zIndex: 30 + win.z,
    ...(win.maximized
      ? { left: 0, top: 0, width: '100%', height: '100%' }
      : { left: win.rect.x, top: win.rect.y, width: win.rect.w, height: win.rect.h }),
  };

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (win.maximized) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: win.rect.x, oy: win.rect.y };
  };

  const onDragMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || win.maximized) return;
    const el = screenRef.current;
    const dx = e.clientX - drag.current.px;
    const dy = e.clientY - drag.current.py;
    const maxX = Math.max(0, (el ? el.clientWidth : window.innerWidth) - win.rect.w);
    const maxY = Math.max(0, (el ? el.clientHeight : window.innerHeight) - win.rect.h);
    const x = Math.min(Math.max(0, drag.current.ox + dx), maxX);
    const y = Math.min(Math.max(0, drag.current.oy + dy), maxY);
    moveWindow(id, { ...win.rect, x, y });
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  };

  return (
    <section
      ref={ref}
      role="dialog"
      aria-label={win.title}
      tabIndex={-1}
      className={`window${win.maximized ? ' window--max' : ''}`}
      style={style}
      onPointerDown={() => focusWindow(id)}
    >
      <header
        className="window-bar"
        onPointerDown={startDrag}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="window-icon" aria-hidden="true">{icon}</span>
        <span className="window-title">{win.title}</span>
        <span className="window-controls">
          <button type="button" className="win-btn" onClick={() => minimizeWindow(id)} aria-label="Minimize">–</button>
          <button type="button" className="win-btn" onClick={() => toggleMaximize(id)} aria-label={win.maximized ? 'Restore' : 'Maximize'}>
            {win.maximized ? '❐' : '□'}
          </button>
          <button type="button" className="win-btn win-btn--close" onClick={() => closeWindow(id)} aria-label="Close">✕</button>
        </span>
      </header>
      <div className="window-body">{children}</div>
    </section>
  );
}