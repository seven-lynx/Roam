import { describe, it, expect } from 'vitest';

import {
  UNKNOWN_MESSAGE_TYPE,
  UNKNOWN_MESSAGE_ERROR,
  dispatchReport,
  unknownMessageTypeResponse,
} from '../lib/dispatch-report';

describe('unknownMessageTypeResponse', () => {
  it('returns a distinct failure code instead of a backend-style error', () => {
    const res = unknownMessageTypeResponse();

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe(UNKNOWN_MESSAGE_TYPE);
      expect(res.error).toBe(UNKNOWN_MESSAGE_ERROR);
      expect(res.error).not.toContain('Please try again.');
    }
  });
});

describe('dispatchReport', () => {
  it('reports an unrecognised message type at warning level', () => {
    const decision = dispatchReport('GET_SOMETHING_NEW', {
      ok: false,
      code: UNKNOWN_MESSAGE_TYPE,
      error: UNKNOWN_MESSAGE_ERROR,
    });

    expect(decision).toEqual({ report: true, level: 'warning' });
  });

  it('keeps a genuine handler failure at error level', () => {
    const decision = dispatchReport('ROAM', { ok: false, error: "Couldn't reach Roam's servers." });

    expect(decision).toEqual({ report: true, level: 'error' });
  });

  it('does not report a successful dispatch', () => {
    expect(dispatchReport('ROAM', { ok: true, data: {} })).toEqual({ report: false });
  });

  it.each(['SIGN_IN_EMAIL', 'SIGN_UP_EMAIL', 'GET_PROFILE', 'GET_PROFILE_PUBLIC'])(
    'does not report the expected failure of %s',
    (type) => {
      expect(dispatchReport(type, { ok: false, error: 'rejected' })).toEqual({ report: false });
    }
  );

  it('lets the expected-failure list win over the skew code', () => {
    const decision = dispatchReport('SIGN_IN_EMAIL', {
      ok: false,
      code: UNKNOWN_MESSAGE_TYPE,
      error: UNKNOWN_MESSAGE_ERROR,
    });

    expect(decision).toEqual({ report: false });
  });
});
