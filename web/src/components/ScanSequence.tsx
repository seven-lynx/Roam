'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { CompileView, ScanView, StageTracker, TriangulateView } from '@/components/ScanStages';
import { ScanResult } from '@/components/ScanResult';
import { STAGE_MS, fetchScanTarget, hexLine, type ScanStage, type ScanTarget } from '@/lib/scan';

/**
 * Full-screen scan -> triangulate -> compile -> mount sequence opened by the
 * ROAM key. The target is a real catalogue entry; signal and hex readouts are
 * decorative and labelled as simulated. Any key or click skips ahead, and
 * reduced-motion users go straight to the result.
 */
export function ScanSequence() {
  const { scanOpen, setScanOpen } = useWorkstation();
  const [stage, setStage] = useState<ScanStage>('scan');
  const [target, setTarget] = useState<ScanTarget | null>(null);
  const [resolved, setResolved] = useState(false);
  const [hex, setHex] = useState<string[]>([]);
  const [run, setRun] = useState(0);
  const timers = useRef<number[]>([]);
  const actionRef = useRef<HTMLElement | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  // Start (or restart) whenever the sequence opens or "scan again" is pressed.
  useEffect(() => {
    if (!scanOpen) return;
    let cancelled = false;
    setTarget(null);
    setResolved(false);
    setStage('scan');

    fetchScanTarget().then((t) => {
      if (cancelled) return;
      setTarget(t);
      setResolved(true);
    });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStage('mount');
    } else {
      const t1 = STAGE_MS.scan;
      const t2 = t1 + STAGE_MS.triangulate;
      const t3 = t2 + STAGE_MS.compile;
      timers.current = [
        window.setTimeout(() => setStage('triangulate'), t1),
        window.setTimeout(() => setStage('compile'), t2),
        window.setTimeout(() => setStage('mount'), t3),
      ];
    }
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [scanOpen, run, clearTimers]);

  // Scrolling hex stream while the animated stages play.
  useEffect(() => {
    if (!scanOpen || stage === 'mount') return;
    const id = window.setInterval(() => setHex((h) => [...h.slice(-9), hexLine()]), 70);
    return () => window.clearInterval(id);
  }, [scanOpen, stage]);

  const close = useCallback(() => setScanOpen(false), [setScanOpen]);
  const skip = useCallback(() => {
    clearTimers();
    setStage('mount');
  }, [clearTimers]);

  useEffect(() => {
    if (!scanOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (stage !== 'mount') skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scanOpen, stage, close, skip]);

  // Move focus to the primary action once the result is on screen.
  useEffect(() => {
    if (stage === 'mount' && resolved) actionRef.current?.focus();
  }, [stage, resolved]);

  if (!scanOpen) return null;

  const showResult = stage === 'mount' && resolved;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scanning for a page"
      className="absolute inset-0 z-[50] flex flex-col bg-screen font-mono"
      onClick={() => { if (stage !== 'mount') skip(); }}
    >
      <div className="screen-bar">
        <span className="led" aria-hidden="true" />
        <span className="font-pixel tracking-[0.2em] text-ink">roam</span>
        <span className="flex-1" />
        <button type="button" onClick={close} className="text-muted hover:text-ink" aria-label="Close scan">✕</button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-8">
        <StageTracker stage={stage} />
        {stage === 'scan' && <ScanView />}
        {stage === 'triangulate' && <TriangulateView lines={hex} />}
        {stage === 'compile' && <CompileView />}
        {stage === 'mount' && !resolved && <p className="text-sm text-muted" role="status">resolving target…</p>}
        {showResult && <ScanResult target={target} actionRef={actionRef} onAgain={() => setRun((n) => n + 1)} onClose={close} />}
        {stage !== 'mount' && <p className="text-[10px] tracking-widest text-muted">press any key to skip</p>}
      </div>
    </div>
  );
}
