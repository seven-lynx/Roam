import { Suspense } from "react";
import Image from "next/image";
import type { Metadata } from "next";
import SignupPageContent from "./signup-content";

export const metadata: Metadata = {
  title: "Sign up",
};

function SignupPageLoading() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 bg-screen">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <Image src="/icon-512.png" alt="Roam" width={64} height={64} className="mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-ink">Loading…</h1>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageLoading />}>
      <SignupPageContent />
    </Suspense>
  );
}