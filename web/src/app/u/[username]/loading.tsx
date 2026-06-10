export default function PublicProfileLoading() {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-10 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex-1">
            <div className="h-7 w-36 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="mt-1 h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="flex items-center gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="text-center">
              <div className="h-5 w-10 mx-auto bg-zinc-200 dark:bg-zinc-800 rounded" />
              <div className="mt-1 h-3 w-14 mx-auto bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
          ))}
        </div>

        {/* Bio skeleton */}
        <div className="space-y-2">
          <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-3 w-5/6 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>

        {/* Collections skeleton */}
        <div>
          <div className="h-5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded mb-3" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}