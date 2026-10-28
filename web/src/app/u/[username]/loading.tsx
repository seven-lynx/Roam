export default function PublicProfileLoading() {
  return (
    <div className="min-h-full bg-screen">
      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-10 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-panel-3" />
          <div className="flex-1">
            <div className="h-7 w-36 bg-panel-3 rounded" />
            <div className="mt-1 h-4 w-24 bg-panel-3 rounded" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="flex items-center gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="text-center">
              <div className="h-5 w-10 mx-auto bg-panel-3 rounded" />
              <div className="mt-1 h-3 w-14 mx-auto bg-panel-3 rounded" />
            </div>
          ))}
        </div>

        {/* Bio skeleton */}
        <div className="space-y-2">
          <div className="h-3 w-full bg-panel-3 rounded" />
          <div className="h-3 w-5/6 bg-panel-3 rounded" />
        </div>

        {/* Collections skeleton */}
        <div>
          <div className="h-5 w-24 bg-panel-3 rounded mb-3" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg border border-line bg-panel-2" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}