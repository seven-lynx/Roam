interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  color?: string;
}

export function StatCard({ label, value, description, color = 'text-zinc-900 dark:text-white' }: StatCardProps) {
  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 sm:p-4 text-center card-hover">
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</div>
      <div className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-1">{label}</div>
      {description && <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{description}</div>}
    </div>
  );
}