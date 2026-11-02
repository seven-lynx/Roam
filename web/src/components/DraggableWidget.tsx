'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

const LAYOUT_KEY = 'roam-widget-layout';

type WidgetLayout = Record<string, { w: number }>;

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
  width: number;
  /** Called when the operator drags the grip past the threshold: -1 = up, 1 = down. */
  onReorder?: (dir: -1 | 1) => void;
  children: ReactNode;
}

/**
 * Docked desktop widget wrapper. Lives in the right-edge widget rail, so its
 * horizontal position is fixed; dragging the `.widget-head` grip up/down
 * reorders it within the rail, and the bottom-left handle resizes it (width
 * grows/shrinks from the left, keeping the right edge flush). Width persists.
 */
export function DraggableWidget({ id, width, onReorder, children }: Props) {
  const [w, setW] = useState(() => readLayout()[id]?.w ?? width);
  const dragRef = useRef<{ py: number; moved: boolean } | null>(null);
  const resizeRef = useRef<{ px: number; w0: number } | null>(null);

  const persist = (next: number) => {
    try {
      const all = readLayout();
      all[id] = { w: next };
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('.widget-head')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { py: e.clientY, moved: false };
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (Math.abs(e.clientY - d.py) > 6) d.moved = true;
  };

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d.moved) return;
    const dy = e.clientY - d.py;
    if (dy < -24) onReorder?.(-1);
    else if (dy > 24) onReorder?.(1);
  };

  const onResizeDown = (e: PointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { px: e.clientX, w0: w };
  };

  const onResizeMove = (e: PointerEvent<HTMLSpanElement>) => {
    const r = resizeRef.current;
    if (!r) return;
    // Right edge is anchored, so dragging the left handle outward widens.
    setW(Math.max(180, r.w0 - (e.clientX - r.px)));
  };

  const onResizeUp = (e: PointerEvent<HTMLSpanElement>) => {
    const r = resizeRef.current;
    if (!r) return;
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setW((cur) => {
      persist(cur);
      return cur;
    });
  };

  return (
    <div
      className="dw-wrap"
      style={{ width: w }}
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
