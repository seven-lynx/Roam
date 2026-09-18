/**
 * Global setup for extension Vitest tests.
 * Provides a minimal chrome extension API stub so source modules
 * that reference chrome.* can be imported without crashing.
 */

const mockStorage: Record<string, unknown> = {}

const chromeMock = {
  storage: {
    local: {
      get: async (key: string | string[]) => {
        if (typeof key === 'string') return { [key]: mockStorage[key] }
        const result: Record<string, unknown> = {}
        for (const k of key) result[k] = mockStorage[k]
        return result
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(mockStorage, items)
      },
      remove: async (keys: string | string[]) => {
        const ks = typeof keys === 'string' ? [keys] : keys
        for (const k of ks) delete mockStorage[k]
      },
      clear: async () => {
        for (const k of Object.keys(mockStorage)) delete mockStorage[k]
      },
    },
  },
  runtime: {
    sendMessage: async (_msg: unknown) => ({}),
    lastError: null as chrome.runtime.LastError | null,
    id: 'test-extension-id',
  },
  tabs: {
    query: async () => [],
    create: async () => ({}),
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
  for (const k of Object.keys(mockStorage)) delete mockStorage[k]
})
