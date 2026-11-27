import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { CONSENT_IDS } from '../popup/telemetry-consent'
import type { ConsentScope } from '../popup/telemetry-consent'

/**
 * The popup's own markup, read from disk: the ids the module looks up and the ids the
 * HTML ships are two files, and nothing else checks that they agree.
 */
const MARKUP = readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8')

/** The bits of an input the module touches. A fake keeps the suite free of jsdom. */
interface FakeElement {
  hidden: boolean
  checked: boolean
  addEventListener(type: string, listener: () => void): void
  fire(type: string): void
}

function fake(options: { checked?: boolean; hidden?: boolean } = {}): FakeElement {
  const listeners: { type: string; run: () => void }[] = []
  return {
    hidden: options.hidden ?? true,
    checked: options.checked ?? false,
    addEventListener(type, listener) {
      listeners.push({ type, run: listener })
    },
    fire(type) {
      for (const entry of listeners) if (entry.type === type) entry.run()
    },
  }
}

interface Fixture {
  card: FakeElement
  cardToggle: FakeElement
  cardSave: FakeElement
  cardPrivacy: FakeElement
  settingsSection: FakeElement
  settingsToggle: FakeElement
}

function fixture(): Fixture {
  return {
    card: fake({ hidden: true }),
    cardToggle: fake({ checked: true }),
    cardSave: fake(),
    cardPrivacy: fake(),
    settingsSection: fake({ hidden: true }),
    settingsToggle: fake({ checked: false }),
  }
}

function scopeOf(elements: Fixture): ConsentScope {
  const byId: Record<string, FakeElement> = {
    [CONSENT_IDS.card]: elements.card,
    [CONSENT_IDS.cardToggle]: elements.cardToggle,
    [CONSENT_IDS.cardSave]: elements.cardSave,
    [CONSENT_IDS.cardPrivacy]: elements.cardPrivacy,
    [CONSENT_IDS.settingsSection]: elements.settingsSection,
    [CONSENT_IDS.settingsToggle]: elements.settingsToggle,
  }
  return {
    // The module only reads `hidden`/`checked` and adds listeners; the fake is enough.
    getElementById: (id: string) => (byId[id] as unknown as HTMLElement | undefined) ?? null,
  }
}


/**
 * A fresh module per case, with the two collaborators and the build target mocked —
 * the same seam consent.test.ts uses, for the same reason: the platform and the
 * consent answer resolve at import time in the shipped build.
 */
async function load(
  platform: 'chrome' | 'firefox',
  options: { granted?: boolean; stored?: boolean; request?: boolean } = {},
) {
  vi.resetModules()
  const consent = {
    hasStoredPreference: vi.fn(async () => options.stored ?? false),
    isErrorReportingGranted: vi.fn(async () => options.granted ?? false),
    requestErrorReporting: vi.fn(async () => options.request ?? true),
    disableErrorReporting: vi.fn(async () => {}),
  }
  const sentry = {
    initSentry: vi.fn(() => true),
    disableErrorReporting: vi.fn(),
  }
  vi.doMock('../lib/sentry-config', () => ({ PLATFORM: platform }))
  vi.doMock('../lib/consent', () => consent)
  vi.doMock('../lib/sentry', () => ({ ...sentry, Sentry: {} }))
  const module = await import('../popup/telemetry-consent')
  return { module, consent, sentry }
}

/** Let a handler's promise chain settle (the handlers are `void`-called by design). */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

interface ChromeStub {
  tabs: { create: (properties: { url?: string }) => Promise<unknown> }
}

const chromeStub = globalThis.chrome as unknown as ChromeStub

/** The URLs `chrome.tabs.create` was asked for while `run` executed. */
async function openedUrls(run: () => Promise<void>): Promise<string[]> {
  const urls: string[] = []
  const original = chromeStub.tabs.create
  chromeStub.tabs.create = async (properties) => {
    if (properties.url) urls.push(properties.url)
    return { id: 1 }
  }
  try {
    await run()
  } finally {
    chromeStub.tabs.create = original
  }
  return urls
}

describe('popup markup', () => {
  it('carries every element the consent module looks up', () => {
    for (const id of Object.values(CONSENT_IDS)) expect(MARKUP).toContain(`id="${id}"`)
  })

  it('ships both surfaces hidden, so a build that never reveals them shows nothing', () => {
    expect(MARKUP).toMatch(/id="consent-card"[^>]*hidden/)
    expect(MARKUP).toMatch(/id="settings-privacy"[^>]*hidden/)
  })

  it('opens the card with reporting on (D5)', () => {
    expect(MARKUP).toMatch(/id="toggle-consent-card"[^>]*checked/)
  })
})

describe('initTelemetryConsent on Chrome', () => {
  it('leaves both surfaces hidden and asks nothing (Q4)', async () => {
    const { module, consent } = await load('chrome')
    const elements = fixture()

    await module.initTelemetryConsent(scopeOf(elements))

    expect(elements.card.hidden).toBe(true)
    expect(elements.settingsSection.hidden).toBe(true)
    expect(consent.isErrorReportingGranted).not.toHaveBeenCalled()
  })
})

describe('initTelemetryConsent on Firefox', () => {
  it('asks once on the first open, with reporting on (D5)', async () => {
    const { module } = await load('firefox', { stored: false, granted: false })
    const elements = fixture()

    await module.initTelemetryConsent(scopeOf(elements))

    expect(elements.card.hidden).toBe(false)
    expect(elements.cardToggle.checked).toBe(true)
    expect(elements.settingsSection.hidden).toBe(false)
    expect(elements.settingsToggle.checked).toBe(false)
  })

  it('never re-prompts once an answer is stored (D9)', async () => {
    const { module } = await load('firefox', { stored: true, granted: true })
    const elements = fixture()

    await module.initTelemetryConsent(scopeOf(elements))

    expect(elements.card.hidden).toBe(true)
    expect(elements.settingsToggle.checked).toBe(true)
  })

  it('stays hidden when the grant already exists without a stored answer', async () => {
    const { module } = await load('firefox', { stored: false, granted: true })
    const elements = fixture()

    await module.initTelemetryConsent(scopeOf(elements))

    expect(elements.card.hidden).toBe(true)
    expect(elements.settingsToggle.checked).toBe(true)
  })
})


describe('initTelemetryConsent: the card answer', () => {
  it('saving "on" asks for the grant and starts the façade', async () => {
    const { module, consent, sentry } = await load('firefox', { request: true })
    const elements = fixture()
    await module.initTelemetryConsent(scopeOf(elements))
    consent.isErrorReportingGranted.mockResolvedValue(true)

    elements.cardSave.fire('click')
    await settle()

    expect(consent.requestErrorReporting).toHaveBeenCalledTimes(1)
    expect(sentry.initSentry).toHaveBeenCalledWith(true)
    expect(elements.card.hidden).toBe(true)
    expect(elements.settingsToggle.checked).toBe(true)
  })

  it('saving "off" revokes the grant before the façade stops', async () => {
    const { module, consent, sentry } = await load('firefox', { stored: false, granted: false })
    const elements = fixture()
    await module.initTelemetryConsent(scopeOf(elements))
    elements.cardToggle.checked = false

    elements.cardSave.fire('click')
    await settle()

    expect(consent.requestErrorReporting).not.toHaveBeenCalled()
    expect(consent.disableErrorReporting).toHaveBeenCalledTimes(1)
    expect(sentry.disableErrorReporting).toHaveBeenCalledTimes(1)
    expect(consent.disableErrorReporting.mock.invocationCallOrder[0]).toBeLessThan(
      sentry.disableErrorReporting.mock.invocationCallOrder[0],
    )
    expect(sentry.initSentry).not.toHaveBeenCalled()
    expect(elements.card.hidden).toBe(true)
  })
})

describe('initTelemetryConsent: the settings toggle', () => {
  it('turning it on asks for the grant, and a refusal reverts the checkbox', async () => {
    const { module, consent, sentry } = await load('firefox', { stored: true, request: false })
    const elements = fixture()
    await module.initTelemetryConsent(scopeOf(elements))

    elements.settingsToggle.checked = true
    elements.settingsToggle.fire('change')
    await settle()

    expect(consent.requestErrorReporting).toHaveBeenCalledTimes(1)
    expect(sentry.initSentry).toHaveBeenCalledWith(false)
    expect(elements.settingsToggle.checked).toBe(false)
  })

  it('turning it off stops reporting without touching the card', async () => {
    const { module, consent, sentry } = await load('firefox', { stored: true, granted: true })
    const elements = fixture()
    await module.initTelemetryConsent(scopeOf(elements))
    expect(elements.settingsToggle.checked).toBe(true)

    // Revoking gives the grant back, so the truth the toggle repaints from is now off.
    consent.isErrorReportingGranted.mockResolvedValue(false)
    elements.settingsToggle.checked = false
    elements.settingsToggle.fire('change')
    await settle()

    expect(sentry.disableErrorReporting).toHaveBeenCalledTimes(1)
    expect(elements.settingsToggle.checked).toBe(false)
    expect(elements.card.hidden).toBe(true)
  })
})

describe('initTelemetryConsent: privacy link', () => {
  it('opens the privacy page in a tab', async () => {
    const { module } = await load('firefox', { stored: false, granted: false })
    const elements = fixture()
    await module.initTelemetryConsent(scopeOf(elements))

    const urls = await openedUrls(async () => {
      elements.cardPrivacy.fire('click')
      await settle()
    })

    expect(urls).toEqual(['https://roamtheweb.app/privacy'])
  })
})

describe('initTelemetryConsent without the markup', () => {
  it('is a no-op, not a throw', async () => {
    const { module } = await load('firefox', { stored: false, granted: false })

    await expect(
      module.initTelemetryConsent({ getElementById: () => null }),
    ).resolves.toBeUndefined()
  })
})

