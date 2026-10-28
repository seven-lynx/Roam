'use client';

import { useSearchParams } from 'next/navigation';

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Sign in was cancelled or denied.',
  server_error: 'Something went wrong on our end. Please try again.',
  oauth_error: 'Could not sign in with that provider. Please try a different method.',
  invalid_request: 'The sign-in request was invalid. Please try again.',
};

export function AuthErrorBanner() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  if (!error) return null;

  const message = ERROR_MESSAGES[error] || decodeURIComponent(error);

  return (
    <div className="w-full max-w-md mx-auto panel border-l-4 toast-error px-4 py-3 text-sm text-danger">
      <span className="font-medium">Sign in error: </span>
      {message}
    </div>
  );
}