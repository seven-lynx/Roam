interface BarItem {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarItem[];
  color?: string;
  maxWidth?: string;
  showValue?: boolean;
}

export function BarChart({ data, color = 'bg-blue-500', maxWidth = '100%', showValue = true }: BarChartProps) {
  if (data.length === 0) {
    return <p className="text-zinc-500 dark:text-zinc-400 text-sm py-4">No data available.</p>;
  }

  const max = Math.max(...data.map((x) => x.value), 1);

  return (
    <div className="flex flex-col gap-1" style={{ maxWidth }}>
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs">
          <span className="w-20 sm:w-36 truncate text-right text-zinc-500 dark:text-zinc-400 shrink-0" title={item.label}>
            {item.label}
          </span>
          <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded h-4 overflow-hidden min-w-0">
            <div
              className={`${color} rounded h-4 transition-all duration-300 min-w-[2px]`}
              style={{ width: `${Math.max((item.value / max) * 100, 0.5)}%` }}
            />
          </div>
          {showValue && (
            <span className="w-10 sm:w-12 text-right text-zinc-700 dark:text-zinc-300 tabular-nums shrink-0">
              {item.value.toLocaleString()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

interface DataTableProps {
  headers: { key: string; label: string; align?: 'left' | 'center' | 'right' }[];
  rows: Record<string, React.ReactNode>[];
}

export function DataTable({ headers, rows }: DataTableProps) {
  if (rows.length === 0) {
    return <p className="text-zinc-500 dark:text-zinc-400 text-sm py-4">No data available.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
            {headers.map((h) => (
              <th
                key={h.key}
                className={`py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300 ${
                  h.align === 'center' ? 'text-center' : h.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
            >
              {headers.map((h) => (
                <td
                  key={h.key}
                  className={`py-3 px-4 ${
                    h.align === 'center' ? 'text-center' : h.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {row[h.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface SectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}

export function SectionCard({ title, description, children, danger }: SectionCardProps) {
  return (
    <div className={`rounded-xl border p-4 sm:p-6 ${danger ? 'border-red-200 dark:border-red-900' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <h2 className={`text-base sm:text-lg font-semibold mb-1 ${danger ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
        {title}
      </h2>
      {description && <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">{description}</p>}
      {children}
    </div>
  );
}