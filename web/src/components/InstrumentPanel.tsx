import { type ReactNode } from 'react';

/**
 * Reusable equipment panel with an optional title strip, status LED and
 * right-aligned status readout. Corner "screws" come from the .panel CSS.
 */
export function InstrumentPanel({
  label,
  status,
  children,
  className = '',
}: {
  label?: string;
  status?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {label && (
        <div className="panel-head">
          <span className="led" />
          <span>{label}</span>
          {status && <span className="ml-auto blink text-[10px]">{status}</span>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
