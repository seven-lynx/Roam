/**
 * Global setup for extension Vitest tests.
 * Provides a minimal chrome extension API stub so source modules
 * that reference chrome.* can be imported without crashing.
 */

const localStore: Record<string, unknown> = {}
const sessionStore: Record<string, unknown> = {}

/** One chrome.storage area backed by a plain object. */
function storageArea(store: Record<string, unknown>) {
  return {
    get: async (key: string | string[]) => {
      if (typeof key === 'string') return { [key]: store[key] }
      const result: Record<string, unknown> = {}
      for (const k of key) result[k] = store[k]
      return result
    },
    set: async (items: Record<string, unknown>) => {
      Object.assign(store, items)
    },
    remove: async (keys: string | string[]) => {
      const ks = typeof keys === 'string' ? [keys] : keys
      for (const k of ks) delete store[k]
    },
    clear: async () => {
      for (const k of Object.keys(store)) delete store[k]
    },
  }
}

const chromeMock = {
  storage: {
    local: storageArea(localStore),
    session: storageArea(sessionStore),
  },
  runtime: {
    sendMessage: async (_msg: unknown) => ({}),
    lastError: null as chrome.runtime.LastError | null,
    id: 'test-extension-id',
    getURL: (path: string) => `chrome-extension://test-extension-id/${path}`,
  },
  tabs: {
    query: async () => [],
    create: async () => ({ id: 1, windowId: 1 }),
    update: async (tabId: number) => ({ id: tabId }),
    remove: async () => {},
    getCurrent: async () => ({ id: 1 }),
  },
  windows: {
    update: async (windowId: number) => ({ id: windowId }),
  },
  alarms: {
    create: (...args: unknown[]) => { void args; },
    clear: async (...args: unknown[]) => { void args; return true; },
    onAlarm: { addListener: (...args: unknown[]) => { void args; } },
  },
  notifications: {
    create: (...args: unknown[]) => { void args; return 'notification-id'; },
    clear: (...args: unknown[]) => { void args; },
    onClicked: { addListener: (...args: unknown[]) => { void args; } },
  },
}

// Expose as a global so any source file using `chrome.*` resolves correctly.
Object.defineProperty(globalThis, 'chrome', {
  value: chromeMock,
  writable: true,
  configurable: true,
})

// Reset storage between tests to keep state isolated.
beforeEach(() => {
  for (const store of [localStore, sessionStore]) {
    for (const k of Object.keys(store)) delete store[k]
  }
})
