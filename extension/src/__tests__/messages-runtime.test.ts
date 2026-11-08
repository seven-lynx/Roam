import { describe, it, expect, vi, afterEach } from 'vitest'

// Keep @sentry/browser out of the node test environment and let us assert what is reported.
vi.mock('../lib/sentry', () => ({
  Sentry: { init: vi.fn(), captureException: vi.fn(), captureMessage: vi.fn() },
}))

import { Sentry } from '../lib/sentry'
import { sendToBackground } from '../lib/messages'

type ChromeSlot = {
  chrome?: { runtime?: { id?: string; sendMessage?: (msg: unknown) => Promise<unknown> } }
}
const slot = globalThis as ChromeSlot
const installed = slot.chrome

afterEach(() => {
  slot.chrome = installed
  vi.clearAllMocks()
})

describe('sendToBackground outside an extension context', () => {
  it('reports a plain error without retrying or capturing when chrome is absent', async () => {
    delete slot.chrome

    const res = await sendToBackground({ type: 'ROAM' })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('Roam is not running as an installed extension.')
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('reports a plain error when the runtime has no id', async () => {
    slot.chrome = { runtime: {} }

    const res = await sendToBackground({ type: 'GET_STATE' })

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('Roam is not running as an installed extension.')
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})

describe('sendToBackground inside an extension context', () => {
  it('delegates to chrome.runtime.sendMessage', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, data: 'state' }))
    slot.chrome = { runtime: { id: 'test-extension-id', sendMessage } }

    const res = await sendToBackground({ type: 'GET_STATE' })

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith({ type: 'GET_STATE' })
    expect(res).toEqual({ ok: true, data: 'state' })
  })

  it('retries once, then reports and returns the recoverable error', async () => {
    const sendMessage = vi.fn(async () => {
      throw new Error('Service worker response timeout')
    })
    slot.chrome = { runtime: { id: 'test-extension-id', sendMessage } }

    const res = await sendToBackground({ type: 'GET_STATE' })

    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(res.ok).toBe(false)
    if (!res.ok)
      expect(res.error).toBe('Something went wrong. Please close and reopen the extension.')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })
})
