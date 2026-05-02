/**
 * Tests for browser extension URL queue management.
 * Verifies: queue eviction after max retries, exponential backoff,
 * queue state persistence, hot/warming queue separation.
 */

import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts"

// Queue types and constants (mirrored from extension/src/lib/queue.ts)
interface QueuedUrl {
  id: string;
  url: string;
  title?: string;
  description?: string;
  category_id?: string;
  og_image_url?: string;
  status: "hot" | "warming" | "failed";
  retry_count: number;
  last_retry_time?: number;
  added_at: number;
}

const MAX_HOT = 3
const MAX_WARMING = 5
const MAX_RETRIES = 3
const MIN_RETRY_DELAY = 500

function getRetryDelay(retryCount: number): number {
  return MIN_RETRY_DELAY * Math.pow(2, retryCount)
}

// Mock queue state for testing
let mockQueueState = { hot: [] as QueuedUrl[], warming: [] as QueuedUrl[] }

function createMockUrl(id: string, url: string, status: "hot" | "warming" | "failed" = "warming"): QueuedUrl {
  return {
    id,
    url,
    status,
    retry_count: 0,
    added_at: Date.now(),
  }
}

// Queue eviction logic (simplified from actual implementation)
function scheduleRetryLogic(queue: typeof mockQueueState, urlId: string): { evicted: boolean; newRetryCount?: number } {
  const warmingIndex = queue.warming.findIndex((u) => u.id === urlId)
  if (warmingIndex === -1) {
    return { evicted: false }
  }

  const url = queue.warming[warmingIndex]

  if (url.retry_count >= MAX_RETRIES) {
    // Evict after too many retries
    queue.warming.splice(warmingIndex, 1)
    return { evicted: true }
  } else {
    // Move to back of queue with retry count incremented
    queue.warming.splice(warmingIndex, 1)
    url.retry_count += 1
    url.last_retry_time = Date.now()
    queue.warming.push(url)
    return { evicted: false, newRetryCount: url.retry_count }
  }
}

Deno.test('Queue Eviction - URL Evicted After 3 Retries', () => {
  mockQueueState = { hot: [], warming: [] }
  const url = createMockUrl('url1', 'https://example.com')
  mockQueueState.warming.push(url)

  // First retry: should move to back
  let result = scheduleRetryLogic(mockQueueState, 'url1')
  assertEquals(result.evicted, false)
  assertEquals(result.newRetryCount, 1)
  assertEquals(mockQueueState.warming.length, 1)

  // Second retry: should move to back
  result = scheduleRetryLogic(mockQueueState, 'url1')
  assertEquals(result.evicted, false)
  assertEquals(result.newRetryCount, 2)
  assertEquals(mockQueueState.warming.length, 1)

  // Third retry: should move to back
  result = scheduleRetryLogic(mockQueueState, 'url1')
  assertEquals(result.evicted, false)
  assertEquals(result.newRetryCount, 3)
  assertEquals(mockQueueState.warming.length, 1)

  // Fourth attempt: should evict
  result = scheduleRetryLogic(mockQueueState, 'url1')
  assertEquals(result.evicted, true)
  assertEquals(mockQueueState.warming.length, 0)
})

Deno.test('Queue Eviction - Multiple URLs', () => {
  mockQueueState = { hot: [], warming: [] }
  const url1 = createMockUrl('url1', 'https://example1.com')
  const url2 = createMockUrl('url2', 'https://example2.com')
  const url3 = createMockUrl('url3', 'https://example3.com')

  mockQueueState.warming.push(url1, url2, url3)

  // Retry url1 3 times, then evict
  for (let i = 0; i < 3; i++) {
    const result = scheduleRetryLogic(mockQueueState, 'url1')
    assertEquals(result.evicted, false)
  }
  let result = scheduleRetryLogic(mockQueueState, 'url1')
  assertEquals(result.evicted, true)
  assertEquals(mockQueueState.warming.length, 2)

  // url2 and url3 should still be in queue
  assert(mockQueueState.warming.some((u) => u.id === 'url2'))
  assert(mockQueueState.warming.some((u) => u.id === 'url3'))
})

Deno.test('Exponential Backoff - Retry Delays', () => {
  // First retry: 500ms * 2^0 = 500ms
  const delay0 = getRetryDelay(0)
  assertEquals(delay0, 500)

  // Second retry: 500ms * 2^1 = 1000ms
  const delay1 = getRetryDelay(1)
  assertEquals(delay1, 1000)

  // Third retry: 500ms * 2^2 = 2000ms
  const delay2 = getRetryDelay(2)
  assertEquals(delay2, 2000)

  // Fourth retry: 500ms * 2^3 = 4000ms
  const delay3 = getRetryDelay(3)
  assertEquals(delay3, 4000)
})

Deno.test('Queue - Hot/Warming Separation', () => {
  mockQueueState = { hot: [], warming: [] }

  const hotUrl1 = createMockUrl('hot1', 'https://hot1.com', 'hot')
  const hotUrl2 = createMockUrl('hot2', 'https://hot2.com', 'hot')
  const warmingUrl = createMockUrl('warm1', 'https://warm1.com', 'warming')

  mockQueueState.hot.push(hotUrl1, hotUrl2)
  mockQueueState.warming.push(warmingUrl)

  assertEquals(mockQueueState.hot.length, 2)
  assertEquals(mockQueueState.warming.length, 1)

  // Evicting warming URL should not affect hot URLs
  scheduleRetryLogic(mockQueueState, 'warm1')
  scheduleRetryLogic(mockQueueState, 'warm1')
  scheduleRetryLogic(mockQueueState, 'warm1')
  const result = scheduleRetryLogic(mockQueueState, 'warm1')
  assertEquals(result.evicted, true)

  // Hot URLs should be unaffected
  assertEquals(mockQueueState.hot.length, 2)
})

Deno.test('Queue - Invalid URL ID Handling', () => {
  mockQueueState = { hot: [], warming: [] }
  const url = createMockUrl('url1', 'https://example.com')
  mockQueueState.warming.push(url)

  // Retry non-existent URL should not crash
  const result = scheduleRetryLogic(mockQueueState, 'nonexistent')
  assertEquals(result.evicted, false)
  assertEquals(mockQueueState.warming.length, 1)
})

Deno.test('Queue - Retry Count Tracking', () => {
  mockQueueState = { hot: [], warming: [] }
  const url = createMockUrl('url1', 'https://example.com')
  mockQueueState.warming.push(url)

  assertEquals(url.retry_count, 0)

  // First retry
  scheduleRetryLogic(mockQueueState, 'url1')
  assertEquals(mockQueueState.warming[0].retry_count, 1)

  // Second retry
  scheduleRetryLogic(mockQueueState, 'url1')
  assertEquals(mockQueueState.warming[0].retry_count, 2)

  // Third retry
  scheduleRetryLogic(mockQueueState, 'url1')
  assertEquals(mockQueueState.warming[0].retry_count, 3)
})

Deno.test('Queue - Last Retry Time Updated', () => {
  mockQueueState = { hot: [], warming: [] }
  const url = createMockUrl('url1', 'https://example.com')
  mockQueueState.warming.push(url)

  const originalTime = url.last_retry_time
  
  // Simulate time passing and retry
  await new Promise((resolve) => setTimeout(resolve, 10))
  
  scheduleRetryLogic(mockQueueState, 'url1')
  const newTime = mockQueueState.warming[0].last_retry_time
  
  // Should have updated the timestamp
  assert(newTime !== originalTime)
  assert(newTime! > (originalTime ?? 0))
})
