// version.ts — the version this bundle was built from.
//
// esbuild injects `__EXTENSION_VERSION__` at build time (see build.mjs). The popup
// document is re-read from disk every time it opens, while an MV3 service worker can
// survive a rebuild and keep answering from the previous bundle, so the two baked
// values are the only reliable way to notice that the worker is one build behind.

declare const __EXTENSION_VERSION__: string;

/** Version baked into the bundle this module was compiled into. */
export const BUILD_VERSION: string =
  typeof __EXTENSION_VERSION__ !== 'undefined' ? __EXTENSION_VERSION__ : 'unknown';

/**
 * True when the worker answered from a different build than this one. An absent
 * version means the worker predates the handshake, which is a stale worker too.
 */
export function isStaleWorker(
  workerVersion: string | undefined,
  popupVersion: string = BUILD_VERSION
): boolean {
  return workerVersion !== popupVersion;
}
