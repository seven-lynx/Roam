export default function ProfileLoading() {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-10 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-4 w-60 bg-zinc-200 dark:bg-zinc-800 rounded" />
          </div>
        </div>

        {/* Privacy skeleton */}
        <div className="space-y-2">
          <div className="h-5 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>

        {/* Bio skeleton */}
        <div className="space-y-2">
          <div className="h-5 w-12 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-16 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        </div>

        {/* Interests skeleton */}
        <div className="space-y-3">
          <div className="h-5 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
            <div className="h-8 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
            <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
          </div>
        </div>

        {/* Collections skeleton */}
        <div className="space-y-3">
          <div className="h-5 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        </div>

        {/* Saved URLs skeleton */}
        <div className="space-y-3">
          <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-20 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        </div>
      </div>
    </div>
  );
}