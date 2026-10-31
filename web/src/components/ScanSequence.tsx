'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';
import { CompileView, ScanView, StageTracker, TriangulateView } from '@/components/ScanStages';
import { ScanResult } from '@/components/ScanResult';
import { STAGE_MS, fetchScanTarget, hexLine, type ScanStage, type ScanTarget } from '@/lib/scan';
import { scanBlip } from '@/lib/sfx';

/**
 * ROAM key window (opens maximized): scan -> triangulate -> compile -> mount.
 * The target is a real catalogue entry; signal and hex readouts are decorative
 * and labelled as simulated. Any non-control key skips ahead; reduced-motion
 * users go straight to the result.
 */
export function ScanSequence() {
  const { isOpen, closeWindow } = useWorkstation();
  const open = isOpen('scan');
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

  // Start (or restart) whenever the window opens or "scan again" is pressed.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTarget(null);
    setResolved(false);
    setStage('scan');
    scanBlip();

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
  }, [open, run, clearTimers]);

  // Scrolling hex stream while the animated stages play.
  useEffect(() => {
    if (!open || stage === 'mount') return;
    const id = window.setInterval(() => setHex((h) => [...h.slice(-9), hexLine()]), 70);
    return () => window.clearInterval(id);
  }, [open, stage]);

  const close = useCallback(() => closeWindow('scan'), [closeWindow]);
  const skip = useCallback(() => {
    clearTimers();
    setStage('mount');
  }, [clearTimers]);

  // Any non-control key skips ahead (Escape closes via the shell's handler).
  useEffect(() => {
    if (!open || stage === 'mount') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest && t.closest('button, input, textarea, a')) return;
      skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, stage, skip]);

  // Move focus to the primary action once the result is on screen.
  useEffect(() => {
    if (stage === 'mount' && resolved) actionRef.current?.focus();
  }, [stage, resolved]);

  if (!open) return null;

  const showResult = stage === 'mount' && resolved;

  return (
    <Window id="scan" icon={<span aria-hidden="true">◎</span>}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-8 font-mono">
        <StageTracker stage={stage} />
        {stage === 'scan' && <ScanView />}
        {stage === 'triangulate' && <TriangulateView lines={hex} />}
        {stage === 'compile' && <CompileView />}
        {stage === 'mount' && !resolved && <p className="text-sm text-muted" role="status">resolving target…</p>}
        {showResult && <ScanResult target={target} actionRef={actionRef} onAgain={() => setRun((n) => n + 1)} onClose={close} />}
        {stage !== 'mount' && <p className="text-[10px] tracking-widest text-muted">press any key to skip</p>}
      </div>
    </Window>
  );
}