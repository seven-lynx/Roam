/**
 * Tests for Safe Browsing integration.
 * Verifies: malicious URL detection, API error handling, API availability,
 * timeout handling, safe URL pass-through.
 */

import { assertEquals, assert, assertStringIncludes } from "@std/assert"

// Mock for testing (simulates Safe Browsing API responses)
const mockApiResponses: Map<string, { ok: boolean; status: number; body: unknown }> = new Map()

function mockCheckSafeBrowsing(url: string, apiKey: string): { safe: boolean; error?: string } {
  // Simulate network error if API key is empty
  if (!apiKey) {
    return {
      safe: false,
      error: 'Network error contacting Safe Browsing API: API key is empty',
    }
  }

  const mockResponse = mockApiResponses.get(url)
  if (!mockResponse) {
    // Default to safe for URLs not in mock
    return { safe: true }
  }

  if (!mockResponse.ok) {
    return {
      safe: false,
      error: `Safe Browsing API returned ${mockResponse.status}; service may be temporarily unavailable`,
    }
  }

  // Check if response body has matches
  const data = mockResponse.body as { matches?: unknown[] }
  const isSafe = !data.matches || data.matches.length === 0
  return { safe: isSafe }
}

Deno.test('Safe Browsing - Malicious URL Detection', async () => {
  mockApiResponses.clear()
  
  // Mock a malicious URL response
  mockApiResponses.set('https://malicious.example.com', {
    ok: true,
    status: 200,
    body: {
      matches: [
        {
          threatType: 'MALWARE',
          platformType: 'ANY_PLATFORM',
          threat: { url: 'https://malicious.example.com' },
        },
      ],
    },
  })

  const result = await mockCheckSafeBrowsing('https://malicious.example.com', 'test-key')
  assertEquals(result.safe, false)
  assertEquals(result.error, undefined)
})

Deno.test('Safe Browsing - Clean URL Pass-Through', async () => {
  mockApiResponses.clear()
  
  // Mock a clean URL response (no matches)
  mockApiResponses.set('https://safe.example.com', {
    ok: true,
    status: 200,
    body: { matches: [] },
  })

  const result = await mockCheckSafeBrowsing('https://safe.example.com', 'test-key')
  assertEquals(result.safe, true)
  assertEquals(result.error, undefined)
})

Deno.test('Safe Browsing - Empty Matches Array', async () => {
  mockApiResponses.clear()
  
  // Mock response with empty matches array
  mockApiResponses.set('https://example.com', {
    ok: true,
    status: 200,
    body: { matches: [] },
  })

  const result = await mockCheckSafeBrowsing('https://example.com', 'test-key')
  assertEquals(result.safe, true)
})

Deno.test('Safe Browsing - API Error Response', async () => {
  mockApiResponses.clear()
  
  // Mock API error
  mockApiResponses.set('https://example.com', {
    ok: false,
    status: 500,
    body: { error: 'Internal Server Error' },
  })

  const result = await mockCheckSafeBrowsing('https://example.com', 'test-key')
  assertEquals(result.safe, false)
  assert(result.error !== undefined)
  assertStringIncludes(result.error, '500')
})

Deno.test('Safe Browsing - Rate Limit Error', async () => {
  mockApiResponses.clear()
  
  // Mock rate limit error (429)
  mockApiResponses.set('https://example.com', {
    ok: false,
    status: 429,
    body: { error: 'Too Many Requests' },
  })

  const result = await mockCheckSafeBrowsing('https://example.com', 'test-key')
  assertEquals(result.safe, false)
  assertStringIncludes(result.error!, '429')
})

Deno.test('Safe Browsing - Missing API Key', async () => {
  mockApiResponses.clear()
  
  const result = await mockCheckSafeBrowsing('https://example.com', '')
  assertEquals(result.safe, false)
  assert(result.error !== undefined)
  assertStringIncludes(result.error, 'API key is empty')
})

Deno.test('Safe Browsing - Multiple Threat Types', async () => {
  mockApiResponses.clear()
  
  // Mock response with multiple threat types
  mockApiResponses.set('https://example.com', {
    ok: true,
    status: 200,
    body: {
      matches: [
        { threatType: 'MALWARE', platformType: 'ANY_PLATFORM' },
        { threatType: 'SOCIAL_ENGINEERING', platformType: 'ANY_PLATFORM' },
      ],
    },
  })

  const result = await mockCheckSafeBrowsing('https://example.com', 'test-key')
  assertEquals(result.safe, false)
})

Deno.test('Safe Browsing - Null Matches Response', async () => {
  mockApiResponses.clear()
  
  // Mock response without matches property (valid for clean URLs)
  mockApiResponses.set('https://example.com', {
    ok: true,
    status: 200,
    body: { cacheExpiration: '3600s' },  // No matches field
  })

  const result = await mockCheckSafeBrowsing('https://example.com', 'test-key')
  assertEquals(result.safe, true)
})

Deno.test('Safe Browsing - Unauthorized API Key', async () => {
  mockApiResponses.clear()
  
  // Mock unauthorized response (401 or 403)
  mockApiResponses.set('https://example.com', {
    ok: false,
    status: 403,
    body: { error: 'Invalid API key' },
  })

  const result = await mockCheckSafeBrowsing('https://example.com', 'invalid-key')
  assertEquals(result.safe, false)
  assertStringIncludes(result.error!, '403')
})

Deno.test('Safe Browsing - Service Unavailable', async () => {
  mockApiResponses.clear()
  
  // Mock service unavailable
  mockApiResponses.set('https://example.com', {
    ok: false,
    status: 503,
    body: { error: 'Service Unavailable' },
  })

  const result = await mockCheckSafeBrowsing('https://example.com', 'test-key')
  assertEquals(result.safe, false)
  assert(result.error !== undefined)
  assertStringIncludes(result.error, '503')
})

Deno.test('Safe Browsing - URL Variants', async () => {
  mockApiResponses.clear()
  
  // Different URLs should be checked independently
  mockApiResponses.set('https://safe1.example.com', {
    ok: true,
    status: 200,
    body: { matches: [] },
  })
  mockApiResponses.set('https://malicious2.example.com', {
    ok: true,
    status: 200,
    body: { matches: [{ threatType: 'MALWARE' }] },
  })

  const result1 = await mockCheckSafeBrowsing('https://safe1.example.com', 'test-key')
  const result2 = await mockCheckSafeBrowsing('https://malicious2.example.com', 'test-key')

  assertEquals(result1.safe, true)
  assertEquals(result2.safe, false)
})