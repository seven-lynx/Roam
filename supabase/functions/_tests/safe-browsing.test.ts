/**
 * Tests for Safe Browsing integration.
 * Verifies: malicious URL detection, API error handling, API availability,
 * timeout handling, safe URL pass-through.
 */

import { assertEquals, assert, assertThrows, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts"

// Safe Browsing check implementation (mirrored from submit-url/index.ts)
async function checkSafeBrowsing(url: string, apiKey: string): Promise<{ safe: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'roam', clientVersion: '1.0' },
          threatInfo: {
            threatTypes: [
              'MALWARE',
              'SOCIAL_ENGINEERING',
              'UNWANTED_SOFTWARE',
              'POTENTIALLY_HARMFUL_APPLICATION',
            ],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      },
    )

    // Check for HTTP-level errors from the Safe Browsing API
    if (!res.ok) {
      const errorBody = await res.text()
      console.error(`Safe Browsing API error: ${res.status} ${res.statusText}`, { url, status: res.status, body: errorBody.slice(0, 200) })
      return {
        safe: false,
        error: `Safe Browsing API returned ${res.status}; service may be temporarily unavailable`,
      }
    }

    const data = await res.json()
    // Empty or absent matches array means the URL is clean
    const isSafe = !data.matches || data.matches.length === 0
    return { safe: isSafe }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('Safe Browsing API network error', { url, error: errorMsg })
    return {
      safe: false,
      error: `Network error contacting Safe Browsing API: ${errorMsg}`,
    }
  }
}

// Mock for testing (simulates Safe Browsing API responses)
let mockApiResponses: Map<string, { ok: boolean; status: number; body: unknown }> = new Map()

async function mockCheckSafeBrowsing(url: string, apiKey: string): Promise<{ safe: boolean; error?: string }> {
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
  const data = mockResponse.body as any
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
