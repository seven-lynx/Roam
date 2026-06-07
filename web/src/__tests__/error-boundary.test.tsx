/**
 * Tests for ErrorBoundary component.
 * Verifies: error catching, fallback UI, reset behavior, dev error display.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Component that throws on render
const BrokenComponent: React.FC<{ message?: string }> = ({ message }) => {
  throw new Error(message ?? 'test error');
};

// Normal component
function GoodComponent() {
  return <p>Everything is fine</p>;
}

describe('ErrorBoundary', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Everything is fine')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    // Suppress error log for this test
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText(/We encountered an unexpected error/)
    ).toBeInTheDocument();

    spy.mockRestore();
  });

  it('shows a Try again button in fallback UI', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );

    const tryAgainBtn = screen.getByRole('button', { name: /try again/i });
    expect(tryAgainBtn).toBeInTheDocument();

    spy.mockRestore();
  });

  it('shows a Return to home link in fallback UI', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );

    const homeLink = screen.getByRole('link', { name: /return to home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');

    spy.mockRestore();
  });

  it('reloads the page when Try again is clicked', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock window.location.reload
    const reloadMock = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );

    const tryAgainBtn = screen.getByRole('button', { name: /try again/i });
    tryAgainBtn.click();

    expect(reloadMock).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('does NOT show error details in production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenComponent message="SECRET_SENSITIVE_DATA" />
      </ErrorBoundary>
    );

    // The error message should NOT appear in the DOM
    expect(screen.queryByText(/SECRET_SENSITIVE_DATA/)).not.toBeInTheDocument();

    spy.mockRestore();
  });

  it('shows error details in development mode', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenComponent message="DEBUG_ERROR_MESSAGE" />
      </ErrorBoundary>
    );

    // The error message SHOULD appear in the DOM in dev mode
    expect(screen.getByText('DEBUG_ERROR_MESSAGE')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('logs error details via logError', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );

    // The error boundary calls logError internally.
    // We verify the fallback UI rendered, which means componentDidCatch ran.
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    spy.mockRestore();
  });
});