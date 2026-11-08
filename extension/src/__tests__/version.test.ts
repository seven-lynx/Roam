import { describe, it, expect, vi, afterEach } from 'vitest';

// vitest.config.ts declares the build-time constants, but only a runtime global reaches
// the module (see env.test.ts). BUILD_VERSION is evaluated once at import time, so each
// case resets the module registry and imports a fresh copy.
async function loadVersion(buildVersion: string | undefined) {
  vi.resetModules();
  vi.stubGlobal('__EXTENSION_VERSION__', buildVersion);
  return import('../lib/version');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BUILD_VERSION', () => {
  it('is the version injected at build time', async () => {
    const { BUILD_VERSION } = await loadVersion('0.6.0');

    expect(BUILD_VERSION).toBe('0.6.0');
  });

  it('falls back when no version was injected', async () => {
    const { BUILD_VERSION } = await loadVersion(undefined);

    expect(BUILD_VERSION).toBe('unknown');
  });
});

describe('isStaleWorker', () => {
  it('accepts a worker from the same build', async () => {
    const { isStaleWorker } = await loadVersion('0.6.0');

    expect(isStaleWorker('0.6.0')).toBe(false);
  });

  it('flags a worker from an older build', async () => {
    const { isStaleWorker } = await loadVersion('0.6.0');

    expect(isStaleWorker('0.3.0')).toBe(true);
  });

  it('flags a worker that predates the handshake', async () => {
    const { isStaleWorker } = await loadVersion('0.6.0');

    expect(isStaleWorker(undefined)).toBe(true);
  });

  it('compares against an explicit popup version when given one', async () => {
    const { isStaleWorker } = await loadVersion('unknown');

    expect(isStaleWorker('0.6.0', '0.6.0')).toBe(false);
    expect(isStaleWorker('0.3.0', '0.6.0')).toBe(true);
  });
});

