import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserOptions, ErrorEvent } from '@sentry/browser'

// The SDK cannot run in the node test environment. The double also lets us assert
// what `init` receives and whether a capture actually reached the SDK.
const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  close: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('@sentry/browser', () => ({
  init: sdk.init,
  captureException: sdk.captureException,
  captureMessage: sdk.captureMessage,
  close: sdk.close,
  dedupeIntegration: () => ({ name: 'Dedupe' }),
  functionToStringIntegration: () => ({ name: 'FunctionToString' }),
  eventFiltersIntegration: () => ({ name: 'EventFilters' }),
}))

// A build-time constant cannot be stubbed at runtime: `define` has already inlined
// the value (vitest.config.ts sets __SENTRY_DSN__ to ""), so the module that reads
// the constants is mocked instead. Production values come from build.mjs's define map.
vi.mock('../lib/sentry-config', () => ({
  SENTRY_DSN: 'https://public@o0.ingest.sentry.io/1',
  SENTRY_RELEASE: '0.0.0-test',
  SENTRY_ENVIRONMENT: 'test',
  PLATFORM: 'chrome',
}))

type SentryModule = typeof import('../lib/sentry')

/** A fresh module instance per test — `enabled` is module state. */
function load(): Promise<SentryModule> {
  return import('../lib/sentry')
}

const EVENT = {
  event_id: 'abc123',
  user: { id: 'user-1', email: 'person@example.com' },
  request: { url: 'https://example.com/private' },
  extra: { messageType: 'GET_ROAM', pageUrl: 'https://example.com/private', sessionId: 'sid-1' },
  breadcrumbs: [
    {
      category: 'navigation',
      data: { url: 'https://example.com/private', from: '/a', to: '/b', messageType: 'GET_ROAM' },
    },
  ],
} as unknown as ErrorEvent

beforeEach(() => {
  vi.resetModules()
  sdk.init.mockClear()
  sdk.captureException.mockClear()
  sdk.captureMessage.mockClear()
  sdk.close.mockClear()
})

describe('initSentry', () => {
  it('does not initialise when consent is withheld', async () => {
    const { initSentry } = await load()

    expect(initSentry(false)).toBe(false)
    expect(sdk.init).not.toHaveBeenCalled()
  })

  it('initialises with the narrowed payload policy and only the three integrations', async () => {
    const { initSentry } = await load()

    expect(initSentry(true)).toBe(true)
    expect(sdk.init).toHaveBeenCalledTimes(1)

    const options = sdk.init.mock.calls[0][0] as BrowserOptions
    // `integrations` may also be a mutator function; E1 passes an array.
    const integrations = Array.isArray(options.integrations) ? options.integrations : []
    expect(options.dsn).toBe('https://public@o0.ingest.sentry.io/1')
    expect(options.defaultIntegrations).toBe(false)
    expect(options.sendDefaultPii).toBe(false)
    expect(options.tracesSampleRate).toBe(0)
    expect(options.dist).toBe('chrome')
    expect(integrations.map((integration) => integration.name)).toEqual([
      'Dedupe',
      'FunctionToString',
      'EventFilters',
    ])
    expect(options.initialScope).toEqual({ tags: { platform: 'extension-chrome' } })
  })

  it('is idempotent once initialised', async () => {
    const { initSentry } = await load()

    expect(initSentry(true)).toBe(true)
    expect(initSentry(true)).toBe(true)
    expect(sdk.init).toHaveBeenCalledTimes(1)
  })

  it('refuses to initialise outside an extension context', async () => {
    vi.doMock('../lib/extension-context', () => ({ isExtensionContext: () => false }))
    try {
      const { initSentry } = await load()

      expect(initSentry(true)).toBe(false)
      expect(sdk.init).not.toHaveBeenCalled()
    } finally {
      // doMock registrations outlive resetModules, so it has to be withdrawn or
      // every later case in this file sees the stubbed context.
      vi.doUnmock('../lib/extension-context')
    }
  })
})

describe('Sentry façade', () => {
  it('is inert before init — capture calls never reach the SDK', async () => {
    const { Sentry } = await load()

    Sentry.captureException(new Error('boom'), { tags: { context: 'test' } })
    Sentry.captureMessage('hello', { level: 'warning' })

    expect(sdk.captureException).not.toHaveBeenCalled()
    expect(sdk.captureMessage).not.toHaveBeenCalled()
  })

  it('forwards a capture once init has succeeded', async () => {
    const { Sentry, initSentry } = await load()
    const error = new Error('boom')

    initSentry(true)
    Sentry.captureException(error, { tags: { context: 'test' } })

    expect(sdk.captureException).toHaveBeenCalledWith(error, { tags: { context: 'test' } })
  })

  it('stops capturing and closes the client once reporting is disabled', async () => {
    const { Sentry, initSentry, disableErrorReporting } = await load()

    initSentry(true)
    disableErrorReporting()
    Sentry.captureException(new Error('after disable'))

    expect(sdk.captureException).not.toHaveBeenCalled()
    expect(sdk.close).toHaveBeenCalledTimes(1)
  })
})

describe('scrubEvent', () => {
  it('drops user, request, URL-keyed extras and breadcrumb URLs, keeping the rest', async () => {
    const { scrubEvent } = await load()

    const scrubbed = scrubEvent(structuredClone(EVENT))

    expect(scrubbed.user).toBeUndefined()
    expect(scrubbed.request).toBeUndefined()
    expect(scrubbed.extra).toEqual({ messageType: 'GET_ROAM' })
    expect(scrubbed.breadcrumbs?.[0].data).toEqual({ messageType: 'GET_ROAM' })
  })

  it('is wired into beforeSend, so the scrubber runs on every event', async () => {
    const { initSentry } = await load()

    initSentry(true)
    const options = sdk.init.mock.calls[0][0] as BrowserOptions
    const beforeSend = options.beforeSend

    expect(typeof beforeSend).toBe('function')
    const scrubbed = beforeSend?.(structuredClone(EVENT), {}) as ErrorEvent

    expect(scrubbed.user).toBeUndefined()
    expect(scrubbed.extra).toEqual({ messageType: 'GET_ROAM' })
  })

  it('redacts URL-shaped text in the message and in exception values', async () => {
    const { scrubEvent } = await load()

    const event = structuredClone(EVENT)
    event.message = 'popup error [load]: Failed to fetch https://example.com/private?q=1'
    event.exception = {
      values: [{ type: 'Error', value: 'failed at http://example.org/a and www.example.net/b' }],
    }

    const scrubbed = scrubEvent(event)

    expect(scrubbed.message).toBe('popup error [load]: Failed to fetch [url]')
    expect(scrubbed.exception?.values?.[0].value).toBe('failed at [url] and [url]')
  })

  it('leaves text without a URL readable, so E8 can still describe the payload', async () => {
    const { scrubEvent } = await load()

    const event = structuredClone(EVENT)
    event.message = 'GET_ROAM returned no rows'

    expect(scrubEvent(event).message).toBe('GET_ROAM returned no rows')
  })
})
