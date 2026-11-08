import { describe, it, expect } from 'vitest';
import { AUTH_FLOW_TTL, liveAuthFlow } from '../lib/auth-flow';

// A fixed clock keeps the TTL assertions independent of how long the suite takes.
const NOW = 1_760_000_000_000;

function marker(overrides: Partial<{ tabId: number; windowId: number; startedAt: number }> = {}) {
  return { tabId: 7, windowId: 2, startedAt: NOW - 1000, ...overrides };
}

describe('liveAuthFlow', () => {
  it('returns a marker that is still inside its TTL', () => {
    expect(liveAuthFlow(marker(), NOW)).toEqual(marker());
  });

  it('treats an absent marker as no sign-in in flight', () => {
    expect(liveAuthFlow(undefined, NOW)).toBeNull();
  });

  it('expires exactly at the TTL boundary', () => {
    expect(liveAuthFlow(marker({ startedAt: NOW - AUTH_FLOW_TTL }), NOW)).toBeNull();
  });

  it('keeps a marker one millisecond inside the TTL', () => {
    expect(liveAuthFlow(marker({ startedAt: NOW - AUTH_FLOW_TTL + 1 }), NOW)).not.toBeNull();
  });

  it('ignores a malformed marker instead of focusing the wrong tab', () => {
    expect(liveAuthFlow({ tabId: '7', windowId: 2, startedAt: NOW }, NOW)).toBeNull();
    expect(liveAuthFlow({ tabId: 7 }, NOW)).toBeNull();
    expect(liveAuthFlow('auth_flow', NOW)).toBeNull();
    expect(liveAuthFlow({}, NOW)).toBeNull();
  });

  it('ignores the clock skew of a marker stamped in the future', () => {
    expect(liveAuthFlow(marker({ startedAt: NOW + 60_000 }), NOW)).not.toBeNull();
  });
});
