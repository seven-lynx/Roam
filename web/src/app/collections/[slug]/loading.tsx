export default function CollectionLoading() {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-10 animate-pulse">
        {/* Header skeleton */}
        <div>
          <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="mt-2 h-4 w-36 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>

        {/* List skeletons */}
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="w-14 h-14 rounded-lg bg-zinc-200 dark:bg-zinc-800 shrink-0" />
              <div className="flex flex-col gap-2 flex-1">
                <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800/50 rounded" />
                <div className="h-3 w-20 bg-zinc-100 dark:bg-zinc-800/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}