'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

const LAYOUT_KEY = 'roam-widget-layout';

type WidgetLayout = Record<string, { x: number; y: number; w: number }>;

function readLayout(): WidgetLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as WidgetLayout;
    }
  } catch {
    /* storage unavailable */
  }
  return {};
}

interface Props {
  id: string;
  defaultX: number;
  defaultY: number;
  width: number;
  children: ReactNode;
}

/**
 * Free-positioned desktop widget wrapper. Drag by its `.widget-head` grip to
 * reposition; the position (and width) persist to localStorage on drop. The
 * widget itself fills the wrapper width, so each widget can be a distinct size.
 */
export function DraggableWidget({ id, defaultX, defaultY, width, children }: Props) {
  const [pos, setPos] = useState(() => {
    const saved = readLayout()[id];
    return { x: saved?.x ?? defaultX, y: saved?.y ?? defaultY, w: saved?.w ?? width };
  });
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null);
  const resizeRef = useRef<{ px: number; w0: number } | null>(null);

  const persist = (next: { x: number; y: number; w: number }) => {
    try {
      const all = readLayout();
      all[id] = next;
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('.widget-head')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y, moved: false };
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (!d.moved) return;
    setPos((p) => ({ ...p, x: d.ox + dx, y: d.oy + dy }));
  };

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d.moved) return;
    const x = d.ox + (e.clientX - d.px);
    const y = d.oy + (e.clientY - d.py);
    setPos((p) => {
      const next = { ...p, x, y };
      persist(next);
      return next;
    });
  };

  const onResizeDown = (e: PointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { px: e.clientX, w0: pos.w };
  };

  const onResizeMove = (e: PointerEvent<HTMLSpanElement>) => {
    const r = resizeRef.current;
    if (!r) return;
    setPos((p) => ({ ...p, w: Math.max(200, r.w0 + (e.clientX - r.px)) }));
  };

  const onResizeUp = (e: PointerEvent<HTMLSpanElement>) => {
    const r = resizeRef.current;
    if (!r) return;
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setPos((p) => {
      persist(p);
      return p;
    });
  };

  return (
    <div
      className="dw-wrap"
      style={{ left: pos.x, top: pos.y, width: pos.w }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {children}
      <span
        className="dw-resize"
        aria-hidden="true"
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
      />
    </div>
  );
}
