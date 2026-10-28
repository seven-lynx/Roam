'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[app/error] Unhandled routing error:', error);
  }, [error]);

  return (
    <div className="min-h-full bg-gradient-to-br from-panel-2 to-panel-2 from-panel-2 to-panel-2 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full bg-panel bg-panel-2 rounded-lg shadow-lg p-8 text-center">
        <svg
          className="mx-auto h-12 w-12 text-danger mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4v2m0 0a9 9 0 110-18 9 9 0 010 18z"
          />
        </svg>
        <h1 className="text-2xl font-bold text-ink mb-2">
          Something went wrong
        </h1>
        <p className="text-muted mb-6">
          We encountered an unexpected error. Please try again or contact support if the problem persists.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-4 bg-panel-2 bg-panel-2/20 rounded border border-danger border-danger">
            <p className="text-sm text-danger text-danger font-mono break-words">
              {error.message}
            </p>
          </div>
        )}

        <button
          onClick={reset}
          className="w-full px-4 py-2 bg-accent text-ink font-medium rounded-lg transition-colors mb-3"
        >
          Try again
        </button>

        <Link
          href="/"
          className="block text-phosphor hover:text-phosphor text-phosphor hover:text-phosphor text-sm"
        >
          Return to home
        </Link>
      </div>
    </div>
  );
}