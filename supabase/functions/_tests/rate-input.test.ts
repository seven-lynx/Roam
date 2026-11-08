/**
 * Tests for the `rate` request-body validator.
 * Verifies: canonical UUIDs pass; the empty id the Android placeholder states
 * send (`RoamUrl(id = "")`) is rejected; non-strings are rejected.
 */

import { assertEquals } from "@std/assert"
import { isUuid } from '../_shared/rate-input.ts'

const VALID = '6f1a2b3c-4d5e-4f70-8a9b-0c1d2e3f4a5b'

Deno.test('isUuid - accepts canonical uuids', () => {
  assertEquals(isUuid(VALID), true)
  // Any case — the ratings.url_id column is a uuid, so casing is irrelevant.
  assertEquals(isUuid(VALID.toUpperCase()), true)
})

Deno.test('isUuid - rejects the empty id sent by placeholder states', () => {
  // The exact bug: {"url_id":"","value":1} passed `typeof url_id === 'string'`
  // and became a 500 from PostgREST 22P02 (ROAM-ANDROID-5 / -16).
  assertEquals(isUuid(''), false)
  assertEquals(isUuid(' '), false)
})

Deno.test('isUuid - rejects non-uuid strings', () => {
  assertEquals(isUuid('url-123'), false)             // the fixture the Android tests use
  assertEquals(isUuid('6f1a2b3c4d5e4f708a9b0c1d2e3f4a5b'), false) // no dashes
  assertEquals(isUuid(VALID + '0'), false)           // too long
  assertEquals(isUuid(VALID.slice(0, -3) + 'zzz'), false) // bad hex
  assertEquals(isUuid('6f1a2b3c-4d5e-4f70-8a9b-0c1d2e3f4a5'), false) // too short
})

Deno.test('isUuid - rejects non-strings', () => {
  assertEquals(isUuid(undefined), false)
  assertEquals(isUuid(null), false)
  assertEquals(isUuid(1), false)
  assertEquals(isUuid({ id: VALID }), false)
})
