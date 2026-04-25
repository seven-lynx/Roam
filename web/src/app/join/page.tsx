import { Suspense } from "react";
import JoinPageContent from "./join-content";

// ── Suspense fallback for OAuth code detection ────────────────────────────
function JoinPageLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <span className="text-4xl">🧭</span>
          <h1 className="mt-3 text-3xl font-bold text-zinc-900 dark:text-white">Create your account</h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">Free, forever.</p>
        </div>
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinPageLoading />}>
      <JoinPageContent />
    </Suspense>
  );
}
