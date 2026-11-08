// auth-flow.ts — the marker that records the open sign-in tab.
//
// Split out of background.ts so callback.html (which clears the marker once the code
// has been exchanged) and the service worker (which writes and honours it) share one
// key and one TTL. Neither copy can drift out of step with the other.

/** `{ tabId, windowId, startedAt }` of the sign-in tab the SW opened, if one is open. */
export const AUTH_FLOW_KEY = 'auth_flow';

/** A marker older than this is ignored, so a stale one never blocks a fresh sign-in. */
export const AUTH_FLOW_TTL = 5 * 60 * 1000;

export interface AuthFlowState {
  tabId: number;
  windowId: number;
  startedAt: number;
}

/**
 * The stored marker as a usable flow, or null when it is absent, malformed, or past
 * its TTL. Storage can hold whatever an earlier version of the extension wrote, so
 * the shape is checked rather than asserted.
 */
export function liveAuthFlow(stored: unknown, now: number = Date.now()): AuthFlowState | null {
  if (!stored || typeof stored !== 'object') return null;
  const flow = stored as Partial<AuthFlowState>;
  if (typeof flow.tabId !== 'number' || typeof flow.windowId !== 'number') return null;
  if (typeof flow.startedAt !== 'number') return null;
  if (now - flow.startedAt >= AUTH_FLOW_TTL) return null;
  return { tabId: flow.tabId, windowId: flow.windowId, startedAt: flow.startedAt };
}
