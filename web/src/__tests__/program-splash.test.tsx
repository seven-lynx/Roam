import { BOOT_LINES, SPLASH_MS } from '@/components/programs/ProgramSplash';

/**
 * ProgramSplash shared boot-screen constants.
 *
 * The DOM behaviour (auto-dismiss, skip on key/click, reduced-motion) is kept in
 * the component; these tests cover the stable, data-only surface the same way
 * `scan.test.ts` covers `STAGE_MS` / `COMPILE_LOG`. DOM-level rendering tests are
 * currently blocked by @testing-library/react@15 pinning React 18 while the app
 * runs React 19 (a second React copy causes "Invalid hook call"); upgrading
 * @testing-library/react to v16 unblocks them.
 */
describe('ProgramSplash constants', () => {
  it('ships a non-empty POST-style boot log', () => {
    expect(BOOT_LINES.length).toBeGreaterThan(0);
    for (const line of BOOT_LINES) {
      expect(typeof line).toBe('string');
      expect(line.trim().length).toBeGreaterThan(0);
    }
  });

  it('auto-dismisses after a finite, animation-friendly delay', () => {
    expect(SPLASH_MS).toBeGreaterThan(0);
    // Long enough to read a line or two, short enough not to stall a game launch.
    expect(SPLASH_MS).toBeLessThan(5000);
  });
});
