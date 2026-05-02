/**
 * Tests for browser extension URL queue management.
 * Verifies: exponential backoff (real implementation), queue eviction state
 * machine, hot/warming queue separation, invalid-ID handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock supabase and sentry before any import of queue.ts so those modules are
// never executed (they require Chrome storage and build-time constants).
vi.mock('../lib/supabase', () => ({
  getSupabase: vi.fn(),
  clearAuthStorage: vi.fn(),
  chromeStorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

vi.mock('../lib/sentry', () => ({
  Sentry: {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn(),
    withScope: vi.fn((fn: (scope: unknown) => void) =>
      fn({ setTag: vi.fn(), setContext: vi.fn(), setLevel: vi.fn() })
    ),
  },
}))

import { getRetryDelay } from '../lib/queue'

// ─── Shared types/helpers for eviction state machine tests ───────────────────

interface QueuedUrl {
  id: string
  url: string
  status: 'hot' | 'warming' | 'failed'
  retry_count: number
  last_retry_time?: number
  added_at: number
}

const MAX_RETRIES = 3

function createMockUrl(
  id: string,
  url: string,
  status: 'hot' | 'warming' | 'failed' = 'warming',
): QueuedUrl {
  return { id, url, status, retry_count: 0, added_at: Date.now() }
}

/**
 * Pure eviction logic that mirrors scheduleRetry() from queue.ts.
 * Tested here because the real function requires chrome.storage;
 * this validates the state-machine contract independently.
 */
function scheduleRetryLogic(
  queue: { hot: QueuedUrl[]; warming: QueuedUrl[] },
  urlId: string,
): { evicted: boolean; newRetryCount?: number } {
  const idx = queue.warming.findIndex((u) => u.id === urlId)
  if (idx === -1) return { evicted: false }

  const url = queue.warming[idx]
  if (url.retry_count >= MAX_RETRIES) {
    queue.warming.splice(idx, 1)
    return { evicted: true }
  }

  queue.warming.splice(idx, 1)
  url.retry_count += 1
  url.last_retry_time = Date.now()
  queue.warming.push(url)
  return { evicted: false, newRetryCount: url.retry_count }
}

// ─── Exponential backoff — real implementation ────────────────────────────────

describe('getRetryDelay (real implementation)', () => {
  it('retryCount=0 -> 500 ms', () => expect(getRetryDelay(0)).toBe(500))
  it('retryCount=1 -> 1000 ms', () => expect(getRetryDelay(1)).toBe(1000))
  it('retryCount=2 -> 2000 ms', () => expect(getRetryDelay(2)).toBe(2000))
  it('retryCount=3 -> 4000 ms', () => expect(getRetryDelay(3)).toBe(4000))
  it('doubles with every additional retry', () => {
    for (let i = 0; i < 5; i++) {
      expect(getRetryDelay(i + 1)).toBe(getRetryDelay(i) * 2)
    }
  })
})

// ─── Queue eviction state machine ─────────────────────────────────────────────

describe('Queue eviction after max retries', () => {
  let queue: { hot: QueuedUrl[]; warming: QueuedUrl[] }

  beforeEach(() => {
    queue = { hot: [], warming: [] }
  })

  it('evicts a URL exactly when retry_count reaches MAX_RETRIES', () => {
    queue.warming.push(createMockUrl('url1', 'https://example.com'))

    for (let i = 1; i <= MAX_RETRIES; i++) {
      const r = scheduleRetryLogic(queue, 'url1')
      expect(r.evicted).toBe(false)
      expect(r.newRetryCount).toBe(i)
      expect(queue.warming).toHaveLength(1)
    }

    const final = scheduleRetryLogic(queue, 'url1')
    expect(final.evicted).toBe(true)
    expect(queue.warming).toHaveLength(0)
  })

  it('moves the URL to the back of the warming queue on each retry', () => {
    const url1 = createMockUrl('url1', 'https://example1.com')
    const url2 = createMockUrl('url2', 'https://example2.com')
    queue.warming.push(url1, url2)

    scheduleRetryLogic(queue, 'url1')

    expect(queue.warming[0].id).toBe('url2')
    expect(queue.warming[1].id).toBe('url1')
  })

  it('only evicts the targeted URL, leaving others intact', () => {
    queue.warming.push(
      createMockUrl('url1', 'https://a.com'),
      createMockUrl('url2', 'https://b.com'),
      createMockUrl('url3', 'https://c.com'),
    )

    for (let i = 0; i <= MAX_RETRIES; i++) scheduleRetryLogic(queue, 'url1')

    expect(queue.warming).toHaveLength(2)
    expect(queue.warming.some((u) => u.id === 'url2')).toBe(true)
    expect(queue.warming.some((u) => u.id === 'url3')).toBe(true)
  })

  it('does not crash for an unknown URL id', () => {
    queue.warming.push(createMockUrl('url1', 'https://example.com'))
    const r = scheduleRetryLogic(queue, 'nonexistent')
    expect(r.evicted).toBe(false)
    expect(queue.warming).toHaveLength(1)
  })
})

// ─── Hot / warming queue separation ──────────────────────────────────────────

describe('Hot/warming queue separation', () => {
  it('evicting from warming does not affect hot URLs', () => {
    const queue = {
      hot: [
        createMockUrl('hot1', 'https://hot1.com', 'hot'),
        createMockUrl('hot2', 'https://hot2.com', 'hot'),
      ],
      warming: [createMockUrl('warm1', 'https://warm1.com', 'warming')],
    }

    for (let i = 0; i <= MAX_RETRIES; i++) scheduleRetryLogic(queue, 'warm1')

    expect(queue.warming).toHaveLength(0)
    expect(queue.hot).toHaveLength(2)
  })
})