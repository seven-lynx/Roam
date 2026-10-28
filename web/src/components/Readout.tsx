import { type ReactNode } from 'react';

/**
 * Label/value readout styled like a segmented instrument display.
 */
export function Readout({
  label,
  value,
  className = '',
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="kicker">{label}</div>
      <div className="mt-1 font-mono text-lg phosphor tabular-nums">{value}</div>
    </div>
  );
}
