/**
 * Tests for rate limiting function.
 * Verifies: rate limit enforcement, bucket expiration, retry-after calculation,
 * cleanup of expired buckets.
 */

import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts"
import { rateLimit, _resetBucketsForTesting } from '../_shared/rate-limit.ts'

Deno.test('Rate Limiter - Basic Behavior', () => {
  _resetBucketsForTesting()

  const key = 'test:192.168.1.1'
  const limit = 3
  const windowMs = 60000 // 60 seconds

  // First N requests should be allowed
  const result1 = rateLimit(key, limit, windowMs)
  assertEquals(result1.allowed, true)

  const result2 = rateLimit(key, limit, windowMs)
  assertEquals(result2.allowed, true)

  const result3 = rateLimit(key, limit, windowMs)
  assertEquals(result3.allowed, true)

  // N+1th request should be rejected
  const result4 = rateLimit(key, limit, windowMs)
  assertEquals(result4.allowed, false)
  assert(result4.allowed === false)
  assertEquals(result4.retryAfterSec > 0, true)
})

Deno.test('Rate Limiter - Retry-After Header Value', () => {
  _resetBucketsForTesting()

  const key = 'test:192.168.1.2'
  const limit = 1
  const windowMs = 10000 // 10 seconds

  // Use first request
  rateLimit(key, limit, windowMs)

  // Next request should be rate limited
  const result = rateLimit(key, limit, windowMs)
  assertEquals(result.allowed, false)
  assert(result.allowed === false)
  
  // Retry-After should be approximately 10 seconds (with small tolerance for timing)
  assertEquals(result.retryAfterSec >= 9, true)
  assertEquals(result.retryAfterSec <= 11, true)
})

Deno.test('Rate Limiter - Window Expiration', () => {
  _resetBucketsForTesting()

  const key = 'test:192.168.1.3'
  const limit = 2
  const windowMs = 100 // 100ms window

  // Use up the limit
  rateLimit(key, limit, windowMs)
  rateLimit(key, limit, windowMs)

  // Third request should be rate limited
  let result = rateLimit(key, limit, windowMs)
  assertEquals(result.allowed, false)

  // Wait for window to expire
  await new Promise((resolve) => setTimeout(resolve, 150))

  // After window expiration, new requests should be allowed
  result = rateLimit(key, limit, windowMs)
  assertEquals(result.allowed, true)
})

Deno.test('Rate Limiter - Independent Buckets', () => {
  _resetBucketsForTesting()

  const limit = 1
  const windowMs = 60000

  // Different IPs should have independent buckets
  const key1 = 'feedback:192.168.1.1'
  const key2 = 'feedback:192.168.1.2'

  // IP 1 uses its one allowed request
  const result1 = rateLimit(key1, limit, windowMs)
  assertEquals(result1.allowed, true)

  // IP 1 is now rate limited
  const result2 = rateLimit(key1, limit, windowMs)
  assertEquals(result2.allowed, false)

  // But IP 2 should still have its one request available
  const result3 = rateLimit(key2, limit, windowMs)
  assertEquals(result3.allowed, true)

  // IP 2 is also rate limited now
  const result4 = rateLimit(key2, limit, windowMs)
  assertEquals(result4.allowed, false)
})

Deno.test('Rate Limiter - Different Functions Have Independent Buckets', () => {
  _resetBucketsForTesting()

  const limit = 1
  const windowMs = 60000

  // Different functions should have independent buckets
  const feedbackKey = 'feedback:192.168.1.1'
  const submitKey = 'submit-url:192.168.1.1'

  // Feedback is allowed once
  let result = rateLimit(feedbackKey, limit, windowMs)
  assertEquals(result.allowed, true)

  // Feedback is now limited
  result = rateLimit(feedbackKey, limit, windowMs)
  assertEquals(result.allowed, false)

  // But submit-url is still available for the same IP
  result = rateLimit(submitKey, limit, windowMs)
  assertEquals(result.allowed, true)
})

Deno.test('Rate Limiter - Minimum Retry-After is 1', () => {
  _resetBucketsForTesting()

  const key = 'test:192.168.1.4'
  const limit = 1
  const windowMs = 100 // Very short window

  rateLimit(key, limit, windowMs)

  // Immediately hit rate limit (window almost at end)
  // Should still return at least 1 second
  const result = rateLimit(key, limit, windowMs)
  assertEquals(result.allowed, false)
  assert(result.allowed === false)
  assertEquals(result.retryAfterSec >= 1, true)
})
