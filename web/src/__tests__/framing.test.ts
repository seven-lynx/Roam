/**
 * Frame-eligibility rules for the in-OS browser.
 *
 * The ROAM browser frames third-party pages; a destination that sends
 * `X-Frame-Options` or a CSP `frame-ancestors` refusal renders as a blank white
 * pane with no explanation. These assert the verdict that lets the UI offer a real
 * tab instead, and that an unrecognised policy never hides a page that would have
 * loaded.
 */

import {
  DEFAULT_ROAM_ORIGIN,
  frameAncestorsDirective,
  parseFramePolicy,
} from '@/lib/framing';

const TARGET = 'https://publisher.example/article';

describe('frameAncestorsDirective', () => {
  it('returns null when the policy is missing or silent about framing', () => {
    expect(frameAncestorsDirective(null)).toBeNull();
    expect(frameAncestorsDirective(undefined)).toBeNull();
    expect(frameAncestorsDirective("default-src 'self'; img-src *")).toBeNull();
  });

  it('extracts the directive from the middle of a policy', () => {
    expect(frameAncestorsDirective("default-src 'self'; frame-ancestors 'none'; report-uri /csp")).toBe("'none'");
    expect(frameAncestorsDirective('frame-ancestors https://a.example https://b.example')).toBe(
      'https://a.example https://b.example',
    );
  });
});

describe('parseFramePolicy — X-Frame-Options', () => {
  it('allows a page with no framing policy', () => {
    expect(parseFramePolicy({}, TARGET)).toBe('allow');
  });

  it('refuses DENY and cross-origin SAMEORIGIN', () => {
    expect(parseFramePolicy({ xFrameOptions: 'DENY' }, TARGET)).toBe('refuse');
    expect(parseFramePolicy({ xFrameOptions: 'sameorigin' }, TARGET)).toBe('refuse');
  });

  it('allows SAMEORIGIN when the framed page is our own origin', () => {
    const own = `${DEFAULT_ROAM_ORIGIN}/readme`;
    expect(parseFramePolicy({ xFrameOptions: 'SAMEORIGIN' }, own)).toBe('allow');
  });

  it('ignores the retired ALLOW-FROM form and unknown tokens', () => {
    expect(parseFramePolicy({ xFrameOptions: 'ALLOW-FROM https://roamtheweb.app' }, TARGET)).toBe('allow');
    expect(parseFramePolicy({ xFrameOptions: 'something-new' }, TARGET)).toBe('allow');
  });
});

describe('parseFramePolicy — CSP frame-ancestors', () => {
  it("refuses 'none' and 'self'", () => {
    expect(parseFramePolicy({ contentSecurityPolicy: "frame-ancestors 'none'" }, TARGET)).toBe('refuse');
    expect(parseFramePolicy({ contentSecurityPolicy: "frame-ancestors 'self'" }, TARGET)).toBe('refuse');
  });

  it('refuses a directive with no sources at all', () => {
    expect(parseFramePolicy({ contentSecurityPolicy: 'frame-ancestors' }, TARGET)).toBe('refuse');
  });

  it('allows a wildcard or our own origin', () => {
    expect(parseFramePolicy({ contentSecurityPolicy: 'frame-ancestors *' }, TARGET)).toBe('allow');
    expect(
      parseFramePolicy({ contentSecurityPolicy: `frame-ancestors ${DEFAULT_ROAM_ORIGIN}` }, TARGET),
    ).toBe('allow');
    expect(
      parseFramePolicy({ contentSecurityPolicy: 'frame-ancestors https://*.roamtheweb.app' }, TARGET),
    ).toBe('allow');
    expect(parseFramePolicy({ contentSecurityPolicy: 'frame-ancestors https:' }, TARGET)).toBe('allow');
  });

  it('refuses a source list that admits only somebody else', () => {
    expect(
      parseFramePolicy({ contentSecurityPolicy: 'frame-ancestors https://partner.example' }, TARGET),
    ).toBe('refuse');
  });

  it('lets frame-ancestors win when both headers are present', () => {
    // Chrome honours the CSP, so a permissive policy beats a DENY header.
    expect(
      parseFramePolicy(
        { xFrameOptions: 'DENY', contentSecurityPolicy: 'frame-ancestors *' },
        TARGET,
      ),
    ).toBe('allow');
    expect(
      parseFramePolicy(
        { xFrameOptions: 'ALLOW-FROM https://roamtheweb.app', contentSecurityPolicy: "frame-ancestors 'none'" },
        TARGET,
      ),
    ).toBe('refuse');
  });
});

describe('parseFramePolicy — transport and parsing edge cases', () => {
  it('refuses an http page inside an https shell (mixed content)', () => {
    expect(parseFramePolicy({}, 'http://publisher.example/article')).toBe('refuse');
  });

  it('does not apply the mixed-content rule to a local http origin', () => {
    expect(parseFramePolicy({}, 'http://publisher.example/article', 'http://localhost:3000')).toBe('allow');
  });

  it('returns unknown for an unparseable URL so the browser keeps its behaviour', () => {
    expect(parseFramePolicy({}, 'not a url')).toBe('unknown');
  });
});
