'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import type { Application } from '@splinetool/runtime';

interface Props {
  scene: string;
  onLoad: (app: Application) => void;
  /** Reports fetch progress 0..1 as the scene streams in. */
  onProgress?: (ratio: number) => void;
  style?: CSSProperties;
}

/**
 * Thin client-only wrapper around `@splinetool/runtime`'s `Application`.
 * Replaces `@splinetool/react-spline` so we can construct the app with
 * `htmlContentMode: 'none'` (the cyberdeck scene's embedded HTML control HUD is
 * redundant now) and fetch the scene ourselves for a real progress bar plus a
 * cancellable abort on unmount.
 */
export function SplineScene({ scene, onLoad, onProgress, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onLoadRef = useRef(onLoad);
  const onProgressRef = useRef(onProgress);

  // Keep the latest handlers without re-running the scene effect.
  useEffect(() => {
    onLoadRef.current = onLoad;
    onProgressRef.current = onProgress;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let app: Application | null = null;
    const controller = new AbortController();

    (async () => {
      const { Application: App } = await import('@splinetool/runtime');
      if (disposed || !canvasRef.current) return;
      app = new App(canvas, { renderMode: 'continuous', htmlContentMode: 'none' });

      try {
        const res = await fetch(scene, { signal: controller.signal });
        if (!res.ok || !res.body) throw new Error(`fetch ${scene} -> ${res.status}`);
        const total = Number(res.headers.get('content-length')) || 0;
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.byteLength;
            if (total) onProgressRef.current?.(Math.min(1, received / total));
          }
        }
        const buf = new Uint8Array(received);
        let off = 0;
        for (const c of chunks) {
          buf.set(c, off);
          off += c.byteLength;
        }
        if (disposed) {
          app.dispose();
          return;
        }
        await app.start(buf.buffer);
        onProgressRef.current?.(1);
        if (disposed) {
          app.dispose();
          return;
        }
        onLoadRef.current(app);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          app.dispose();
          return;
        }
        /* scene failed to load — the mount window's fallback timer reveals the deck */
      }
    })().catch(() => {
      /* noop */
    });

    return () => {
      disposed = true;
      controller.abort();
      if (app) app.dispose();
    };
  }, [scene]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', ...style }} />;
}
