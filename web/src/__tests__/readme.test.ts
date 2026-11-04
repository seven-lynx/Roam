import { README_STEPS, README_ACCOUNT_NOTE } from '@/components/Readme';

/**
 * README onboarding content. The window component uses hooks (`useWorkstation`),
 * so it's not DOM-rendered here — as with `program-splash.test.tsx`, DOM tests
 * of hook components are blocked by `@testing-library/react@15` (React 18) running
 * alongside React 19. These assert the stable, data-only surface instead.
 */
describe('README onboarding content', () => {
  it('covers the four core actions in order', () => {
    expect(README_STEPS.map((s) => s.name)).toEqual(['ROAM', 'RATE', 'UPLOAD URL', 'REPORT DEAD LINK']);
  });

  it('assigns a non-empty glyph to every step', () => {
    for (const s of README_STEPS) {
      expect(s.glyph.length).toBeGreaterThan(0);
    }
  });

  it('gives every step a location and description', () => {
    for (const s of README_STEPS) {
      expect(s.where.length).toBeGreaterThan(0);
      expect(s.desc.length).toBeGreaterThan(0);
    }
  });

  it('flags exactly Rate and Upload URL as account-gated', () => {
    expect(README_STEPS.filter((s) => s.account).map((s) => s.name)).toEqual(['RATE', 'UPLOAD URL']);
  });

  it('states the account requirement plainly', () => {
    expect(README_ACCOUNT_NOTE).toMatch(/need an account/);
    expect(README_ACCOUNT_NOTE).toMatch(/Roaming and reporting don't/);
  });
});
