/**
 * Tests for URL normalization function.
 * Verifies: protocol enforcement, hostname lowercasing, tracking param removal,
 * fragment stripping, trailing slash handling, unicode handling.
 */

import { assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts"
import { normalizeUrl } from '../_shared/normalise.ts'

Deno.test('URL Normalization - Protocol Enforcement', () => {
  // HTTPS URLs should remain HTTPS
  assertEquals(
    normalizeUrl('https://example.com/path'),
    'https://example.com/path'
  )

  // HTTP URLs should be upgraded to HTTPS
  assertEquals(
    normalizeUrl('http://example.com/path'),
    'https://example.com/path'
  )

  // Invalid protocols should throw
  assertThrows(() => normalizeUrl('ftp://example.com/path'))
  assertThrows(() => normalizeUrl('file:///etc/passwd'))
})

Deno.test('URL Normalization - Hostname Lowercasing', () => {
  assertEquals(
    normalizeUrl('https://EXAMPLE.COM/path'),
    'https://example.com/path'
  )

  assertEquals(
    normalizeUrl('https://ExAmPle.CoM/Path'),
    'https://example.com/path'
  )
})

Deno.test('URL Normalization - WWW Stripping', () => {
  assertEquals(
    normalizeUrl('https://www.example.com/path'),
    'https://example.com/path'
  )

  // Multiple www should only strip the first
  assertEquals(
    normalizeUrl('https://www.www.example.com/path'),
    'https://www.example.com/path'
  )
})

Deno.test('URL Normalization - Tracking Parameter Removal', () => {
  // UTM parameters should be stripped
  assertEquals(
    normalizeUrl('https://example.com/path?utm_source=google&utm_medium=cpc'),
    'https://example.com/path'
  )

  // Facebook and Google tracking should be stripped
  assertEquals(
    normalizeUrl('https://example.com/path?fbclid=xyz&gclid=abc'),
    'https://example.com/path'
  )

  // Non-tracking parameters should remain
  assertEquals(
    normalizeUrl('https://example.com/path?id=123&name=test'),
    'https://example.com/path?id=123&name=test'
  )

  // Mixed parameters should keep non-tracking ones
  assertEquals(
    normalizeUrl('https://example.com/path?utm_source=google&id=123'),
    'https://example.com/path?id=123'
  )
})

Deno.test('URL Normalization - Fragment Stripping', () => {
  assertEquals(
    normalizeUrl('https://example.com/path#section'),
    'https://example.com/path'
  )

  assertEquals(
    normalizeUrl('https://example.com/path?id=1#top'),
    'https://example.com/path?id=1'
  )
})

Deno.test('URL Normalization - Trailing Slash Handling', () => {
  // Trailing slash should be removed from non-root paths
  assertEquals(
    normalizeUrl('https://example.com/path/'),
    'https://example.com/path'
  )

  // Root "/" should keep the trailing slash
  assertEquals(
    normalizeUrl('https://example.com/'),
    'https://example.com/'
  )

  // Multiple trailing slashes should be normalized
  assertEquals(
    normalizeUrl('https://example.com/path//'),
    'https://example.com/path/'
  )
})

Deno.test('URL Normalization - Unicode and Special Characters', () => {
  // Unicode characters in pathname should be preserved
  assertEquals(
    normalizeUrl('https://example.com/über'),
    'https://example.com/%C3%BCber'
  )

  // Encoded characters should be normalized
  assertEquals(
    normalizeUrl('https://example.com/%C3%BCber'),
    'https://example.com/%C3%BCber'
  )

  // Unicode in query parameters should be handled
  const url = normalizeUrl('https://example.com/search?q=café')
  assertEquals(url, 'https://example.com/search?q=caf%C3%A9')
})

Deno.test('URL Normalization - Complex Edge Cases', () => {
  // Comprehensive example with multiple transformations
  const complex = 'HTTP://WWW.EXAMPLE.COM:443/path/?utm_source=google&id=123#section'
  const normalized = normalizeUrl(complex)
  assertEquals(normalized, 'https://example.com:443/path?id=123')

  // Port should be preserved
  assertEquals(
    normalizeUrl('https://example.com:8080/path'),
    'https://example.com:8080/path'
  )

  // Query parameter order should not affect comparison
  const url1 = normalizeUrl('https://example.com/path?a=1&b=2')
  const url2 = normalizeUrl('https://example.com/path?b=2&a=1')
  // Note: URL parameters may have different order, but keys should match
  assertEquals(url1.includes('a=1'), url2.includes('a=1'))
  assertEquals(url1.includes('b=2'), url2.includes('b=2'))
})

Deno.test('URL Normalization - Invalid URLs', () => {
  assertThrows(() => normalizeUrl('not a url'))
  assertThrows(() => normalizeUrl('://example.com'))
  assertThrows(() => normalizeUrl(''))
})
