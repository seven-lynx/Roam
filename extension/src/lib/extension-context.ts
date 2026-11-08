// extension-context.ts — Is this page actually running inside the extension?
//
// chrome.runtime.id is only defined when Chrome loaded the page as part of an
// installed extension. A built page opened from disk (file:///…/dist/popup.html),
// a preview harness, or a tab whose extension context was invalidated has no
// chrome global at all, so every chrome.* call throws ReferenceError. Callers use
// this to fail quietly instead of reporting phantom errors to the production
// project — see issue #75.

type ChromeGlobal = {
  chrome?: { runtime?: { id?: unknown } };
};

/** True when the current page has a live extension runtime to talk to. */
export function isExtensionContext(): boolean {
  const runtime = (globalThis as ChromeGlobal).chrome?.runtime;
  return typeof runtime?.id === 'string' && runtime.id.length > 0;
}
