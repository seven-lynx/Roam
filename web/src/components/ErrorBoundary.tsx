'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { logError } from '@/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary catches render-time errors in child components
 * and displays a user-friendly fallback UI
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('ErrorBoundary', 'Unhandled render error', {
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      componentStack: errorInfo.componentStack?.slice(0, 500),
    }, error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-red-500 mb-4"
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
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Something went wrong
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                We encountered an unexpected error. Please try again or contact support if the problem persists.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-300 font-mono break-words">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <button
                onClick={this.handleReset}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Try again
              </button>

              <Link
                href="/"
                className="block mt-3 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
              >
                Return to home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
