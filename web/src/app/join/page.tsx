import { Suspense } from "react";
import Image from "next/image";
import type { Metadata } from "next";
import JoinPageContent from "./join-content";

export const metadata: Metadata = {
  title: "Join",
};

function JoinPageLoading() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 bg-white dark:bg-zinc-950">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <Image src="/icon-512.png" alt="Roam" width={64} height={64} className="mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">Loading…</h1>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinPageLoading />}>
      <JoinPageContent />
    </Suspense>
  );
}
