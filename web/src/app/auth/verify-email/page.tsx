import { Suspense } from 'react';
import type { Metadata } from 'next';
import VerifyEmailContent from './verify-email-content';

export const metadata: Metadata = {
  title: 'Verify your email',
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-full flex-col items-center justify-center px-6 bg-screen">
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-xl bg-panel-3 animate-pulse" />
          <div className="h-7 w-48 bg-panel-3 rounded animate-pulse" />
          <div className="h-4 w-64 bg-panel-3 rounded animate-pulse" />
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}