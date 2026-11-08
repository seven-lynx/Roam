import { describe, it, expect } from 'vitest';
import { EDGE_UNREACHABLE_MESSAGE, isRetryableEdgeFailure } from '../lib/edge-error';

/** The shape supabase-js gives its three invoke() failures. */
function sdkError(name: string, message: string, context?: unknown): Error {
  return Object.assign(new Error(message), { name, context });
}

describe('isRetryableEdgeFailure', () => {
  it('matches a request that never reached the function', () => {
    const err = sdkError('FunctionsFetchError', 'Failed to send a request to the Edge Function', new TypeError('Failed to fetch'));
    expect(isRetryableEdgeFailure(err)).toBe(true);
  });

  it('matches a relay failure', () => {
    expect(isRetryableEdgeFailure(sdkError('FunctionsRelayError', 'Relay Error invoking the Edge Function'))).toBe(true);
  });

  it('does not retry a function that answered with an error', () => {
    expect(isRetryableEdgeFailure(sdkError('FunctionsHttpError', 'Edge Function returned a non-2xx status code'))).toBe(false);
  });

  it('does not classify an ordinary error that borrowed the message', () => {
    expect(isRetryableEdgeFailure(new Error('Failed to send a request to the Edge Function'))).toBe(false);
    expect(isRetryableEdgeFailure({ message: 'FunctionsFetchError' })).toBe(false);
  });

  it('survives non-error values', () => {
    expect(isRetryableEdgeFailure(null)).toBe(false);
    expect(isRetryableEdgeFailure(undefined)).toBe(false);
    expect(isRetryableEdgeFailure('FunctionsFetchError')).toBe(false);
  });
});

describe('EDGE_UNREACHABLE_MESSAGE', () => {
  it('is actionable and never repeats the SDK wording', () => {
    expect(EDGE_UNREACHABLE_MESSAGE).toContain("Couldn't reach Roam's servers");
    expect(EDGE_UNREACHABLE_MESSAGE).toContain('try again');
    expect(EDGE_UNREACHABLE_MESSAGE).not.toContain('Edge Function');
  });
});
