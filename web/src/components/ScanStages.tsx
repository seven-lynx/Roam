import { COMPILE_LOG, STAGE_MS, type ScanStage } from '@/lib/scan';

export const STAGE_LABEL: Record<ScanStage, string> = {
  scan: 'SCAN',
  triangulate: 'TRIANGULATE',
  compile: 'COMPILE',
  mount: 'MOUNT',
};
export const STAGE_ORDER: ScanStage[] = ['scan', 'triangulate', 'compile', 'mount'];

/** Step indicator across the top of the sequence. */
export function StageTracker({ stage }: { stage: ScanStage }) {
  const idx = STAGE_ORDER.indexOf(stage);
  return (
    <ol className="flex flex-wrap items-center justify-center gap-2 text-[11px] tracking-[0.18em]" aria-label="Progress">
      {STAGE_ORDER.map((s, i) => (
        <li
          key={s}
          aria-current={i === idx ? 'step' : undefined}
          className={`border px-2 py-1 ${
            i < idx ? 'border-line-strong text-phosphor' : i === idx ? 'border-neon text-neon' : 'border-line text-muted'
          }`}
        >
          {i < idx ? '✓ ' : ''}{STAGE_LABEL[s]}
        </li>
      ))}
    </ol>
  );
}

/** Spectrum analyzer with a sweeping band. Decorative: the data is simulated. */
export function ScanView() {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3" aria-hidden="true">
      <div className="relative h-28 w-full overflow-hidden border border-line bg-panel-2">
        <div
          className="absolute inset-y-0 w-1/5 bg-gradient-to-r from-transparent via-phosphor/40 to-transparent"
          style={{ animation: 'scan-sweep 0.9s linear infinite' }}
        />
        <div className="absolute inset-x-0 bottom-0 flex h-full items-end gap-[3px] px-2">
          {Array.from({ length: 40 }).map((_, i) => (
            <span
              key={i}
              className="scan-bar-origin flex-1 bg-phosphor/60"
              style={{
                height: `${12 + ((i * 37) % 70)}%`,
                animation: `scan-bar 0.6s ${(i % 7) * 60}ms ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-muted">
        sweeping frequencies… <span className="text-[10px] opacity-70">(simulated)</span>
      </p>
    </div>
  );
}

/** Scrolling packet hex. Decorative: the bytes are random. */
export function TriangulateView({ lines }: { lines: string[] }) {
  return (
    <div className="w-full max-w-md" aria-hidden="true">
      <pre className="h-28 overflow-hidden border border-line bg-panel-2 p-2 text-[11px] leading-snug text-phosphor/80">
        {lines.join('\n')}
      </pre>
      <p className="mt-2 text-xs text-muted">
        narrowing coordinates… <span className="text-[10px] opacity-70">(simulated)</span>
      </p>
    </div>
  );
}

/** Build-style progress bar and log. Decorative. */
export function CompileView() {
  return (
    <div className="w-full max-w-md" aria-hidden="true">
      <div className="h-3 w-full border border-line bg-panel-2 p-[2px]">
        <div
          className="h-full bg-neon"
          style={{ animation: `compile-fill ${STAGE_MS.compile}ms steps(12, end) forwards` }}
        />
      </div>
      <ul className="mt-3 space-y-1 text-xs text-muted">
        {COMPILE_LOG.map((l, i) => (
          <li key={l} className="boot-line" style={{ animationDelay: `${i * 140}ms` }}>
            <span className="text-phosphor">&gt;</span> {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
