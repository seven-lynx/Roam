import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

/** The category E5 declares under `data_collection_permissions.optional`; asserted below. */
const CATEGORY = 'technicalAndInteraction'

interface PermissionsStub {
  getAll: () => Promise<{ data_collection?: string[] }>
  request: (request: { data_collection?: string[] }) => Promise<boolean>
  remove: (request: { data_collection?: string[] }) => Promise<boolean>
  onAdded: { addListener: (listener: () => void) => void }
  onRemoved: { addListener: (listener: () => void) => void }
}

interface ChromeStub {
  storage: { local: { get: (key: string) => Promise<Record<string, unknown>> } }
  permissions?: PermissionsStub
}

// setup.ts installs the chrome stub; these cases drive it through the same shape a
// shipped build sees (rule E.4: the permission is exercised by a test).
const chromeStub = globalThis.chrome as unknown as ChromeStub

type ConsentModule = typeof import('../lib/consent')

/**
 * A fresh module per case. The browser is a build-time constant, so the only honest
 * way to be Chrome in one case and Firefox in the next is to mock the module that
 * holds it — the same seam sentry.test.ts uses for the same reason.
 */
async function load(platform: 'chrome' | 'firefox'): Promise<ConsentModule> {
  vi.resetModules()
  vi.doMock('../lib/sentry-config', () => ({ PLATFORM: platform }))
  return import('../lib/consent')
}

function permissionsStub(): PermissionsStub {
  if (!chromeStub.permissions) throw new Error('chrome.permissions stub missing')
  return chromeStub.permissions
}

/** Grant the way the consent card will (E4): through the permission request. */
async function grant(): Promise<void> {
  await permissionsStub().request({ data_collection: [CATEGORY] })
}

describe('getPreference', () => {
  it('is on by default and writes nothing on a read', async () => {
    const { getPreference } = await load('chrome')

    expect(await getPreference()).toBe(true)
    const stored = await chromeStub.storage.local.get('error_reporting')
    expect(stored.error_reporting).toBeUndefined()
  })

  it('persists a refusal under the documented key', async () => {
    const { getPreference, setPreference } = await load('chrome')

    await setPreference(false)

    expect(await getPreference()).toBe(false)
    const stored = await chromeStub.storage.local.get('error_reporting')
    expect(stored.error_reporting).toBe(false)
  })
})

describe('hasStoredPreference', () => {
  it('is false until an answer is stored, even though the default is on', async () => {
    const { getPreference, hasStoredPreference } = await load('chrome')

    expect(await getPreference()).toBe(true)
    expect(await hasStoredPreference()).toBe(false)
  })

  it('is true once either answer is stored', async () => {
    const { hasStoredPreference, setPreference } = await load('firefox')

    await setPreference(false)
    expect(await hasStoredPreference()).toBe(true)

    await setPreference(true)
    expect(await hasStoredPreference()).toBe(true)
  })
})

describe('isErrorReportingGranted on Chrome', () => {
  it('follows the preference, because there is no data-collection grant', async () => {
    const { isErrorReportingGranted, setPreference } = await load('chrome')

    expect(await isErrorReportingGranted()).toBe(true)

    await setPreference(false)
    expect(await isErrorReportingGranted()).toBe(false)
  })
})

describe('isErrorReportingGranted on Firefox', () => {
  it('is false without the grant, even though the preference defaults to on', async () => {
    const { getPreference, isErrorReportingGranted } = await load('firefox')

    expect(await getPreference()).toBe(true)
    expect(await isErrorReportingGranted()).toBe(false)
  })

  it('is true once the grant exists', async () => {
    const { isErrorReportingGranted } = await load('firefox')

    await grant()

    expect(await isErrorReportingGranted()).toBe(true)
  })

  it('is false again when the grant is revoked outside the extension', async () => {
    const { isErrorReportingGranted } = await load('firefox')

    await grant()
    await permissionsStub().remove({ data_collection: [CATEGORY] })

    expect(await isErrorReportingGranted()).toBe(false)
  })

  it('fails closed when the permissions API is missing', async () => {
    const { isErrorReportingGranted } = await load('firefox')
    const saved = chromeStub.permissions

    delete chromeStub.permissions
    try {
      expect(await isErrorReportingGranted()).toBe(false)
    } finally {
      chromeStub.permissions = saved
    }
  })
})

describe('requestErrorReporting', () => {
  it('asks Firefox for the one category and remembers the answer', async () => {
    const { getPreference, requestErrorReporting } = await load('firefox')
    const permissions = permissionsStub()
    const calls: { data_collection?: string[] }[] = []
    const original = permissions.request
    permissions.request = async (request) => {
      calls.push(request)
      return original(request)
    }

    try {
      expect(await requestErrorReporting()).toBe(true)
    } finally {
      permissions.request = original
    }

    expect(calls).toEqual([{ data_collection: [CATEGORY] }])
    expect(await getPreference()).toBe(true)
  })

  it('stores a refusal when Firefox denies the request', async () => {
    const { getPreference, requestErrorReporting } = await load('firefox')
    const permissions = permissionsStub()
    const original = permissions.request
    permissions.request = async () => false

    try {
      expect(await requestErrorReporting()).toBe(false)
    } finally {
      permissions.request = original
    }

    expect(await getPreference()).toBe(false)
  })

  it('never touches the permissions API on Chrome', async () => {
    const { requestErrorReporting } = await load('chrome')
    const permissions = permissionsStub()
    const calls: { data_collection?: string[] }[] = []
    const original = permissions.request
    permissions.request = async (request) => {
      calls.push(request)
      return original(request)
    }

    try {
      expect(await requestErrorReporting()).toBe(true)
    } finally {
      permissions.request = original
    }

    expect(calls).toEqual([])
  })
})

describe('disableErrorReporting', () => {
  it('gives the Firefox grant back and stores the refusal', async () => {
    const { disableErrorReporting, getPreference, isErrorReportingGranted } = await load('firefox')

    await grant()
    await disableErrorReporting()

    expect(await isErrorReportingGranted()).toBe(false)
    expect(await getPreference()).toBe(false)
    const all = await permissionsStub().getAll()
    expect(all.data_collection ?? []).not.toContain(CATEGORY)
  })

  it('stores the refusal on Chrome without calling the permissions API', async () => {
    const { disableErrorReporting, getPreference } = await load('chrome')
    const permissions = permissionsStub()
    const removed: unknown[] = []
    const original = permissions.remove
    permissions.remove = async (request) => {
      removed.push(request)
      return original(request)
    }

    try {
      await disableErrorReporting()
    } finally {
      permissions.remove = original
    }

    expect(removed).toEqual([])
    expect(await getPreference()).toBe(false)
  })

  it('does not throw when the permissions API is missing', async () => {
    const { disableErrorReporting, getPreference } = await load('firefox')
    const saved = chromeStub.permissions

    delete chromeStub.permissions
    try {
      await disableErrorReporting()
    } finally {
      chromeStub.permissions = saved
    }

    expect(await getPreference()).toBe(false)
  })
})

/**
 * E5 declared the category in the manifest; this case is what keeps the declaration
 * honest. A category added to `REQUEST` without a matching manifest entry fails the
 * suite here rather than failing AMO review (issue #158).
 */
describe('the Firefox manifest declares every requested category', () => {
  it('lists each data_collection clause under optional', async () => {
    const { requestErrorReporting } = await load('firefox')
    const permissions = permissionsStub()
    const requests: { data_collection?: string[] }[] = []
    const original = permissions.request
    permissions.request = async (request) => {
      requests.push(request)
      return original(request)
    }

    try {
      await requestErrorReporting()
    } finally {
      permissions.request = original
    }

    const manifest = JSON.parse(
      readFileSync(new URL('../../manifest.firefox.json', import.meta.url), 'utf8'),
    ) as {
      browser_specific_settings?: {
        gecko?: { data_collection_permissions?: { optional?: string[] } }
      }
    }
    const optional =
      manifest.browser_specific_settings?.gecko?.data_collection_permissions?.optional ?? []
    const requested = requests.flatMap((request) => request.data_collection ?? [])

    // A request that named nothing would make the loop below vacuous.
    expect(requested.length).toBeGreaterThan(0)
    for (const category of requested) expect(optional).toContain(category)
  })
})

