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
        <div className="min-h-screen bg-screen flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full panel p-8">
            <div className="text-center">
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

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-6 p-4 bg-panel-2 border border-line">
                  <p className="text-sm text-danger font-mono break-words">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <button
                onClick={this.handleReset}
                className="w-full btn btn-primary"
              >
                Try again
              </button>

              <Link
                href="/"
                className="block mt-3 text-phosphor hover:text-phosphor-bright text-sm"
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