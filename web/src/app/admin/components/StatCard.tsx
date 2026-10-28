interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  color?: string;
}

export function StatCard({ label, value, description, color = 'text-ink' }: StatCardProps) {
  return (
    <div className="rounded-lg bg-panel-2 bg-panel p-3 sm:p-4 text-center card-hover">
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</div>
      <div className="text-[10px] sm:text-xs text-muted mt-1">{label}</div>
      {description && <div className="text-[10px] text-muted mt-0.5">{description}</div>}
    </div>
  );
}