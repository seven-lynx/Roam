import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateEnvironment } from '../lib/env'
import type { EnvironmentValues } from '../lib/env'

// The `define`s in vitest.config.ts are substituted by esbuild before this module
// runs, so `vi.stubGlobal` can never reach them - the value is already an inline
// literal in the emitted file (issue #150). Each case passes its own values through
// the parameter instead, which is also what makes the DSN warning provable.

const VALID: EnvironmentValues = {
  supabaseUrl: 'https://abc.supabase.co',
  supabaseAnonKey: 'valid-key',
  sentryDsn: 'https://public@o0.ingest.sentry.io/1',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('validateEnvironment', () => {
  it('passes when URL and key are valid', () => {
    expect(() => validateEnvironment(VALID)).not.toThrow()
  })

  it('throws when SUPABASE_URL is missing', () => {
    expect(() => validateEnvironment({ ...VALID, supabaseUrl: '' })).toThrow(/SUPABASE_URL/)
  })

  it('throws when SUPABASE_URL is not HTTPS', () => {
    expect(() =>
      validateEnvironment({ ...VALID, supabaseUrl: 'http://insecure.supabase.co' })
    ).toThrow(/SUPABASE_URL/)
  })

  it('throws when SUPABASE_ANON_KEY is missing', () => {
    expect(() => validateEnvironment({ ...VALID, supabaseAnonKey: '' })).toThrow(/SUPABASE_ANON_KEY/)
  })

  it('warns (does not throw) when SENTRY_DSN is empty', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => validateEnvironment({ ...VALID, sentryDsn: '' })).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('SENTRY_DSN'))
  })

  it('does not warn when the DSN is set, so the branch above is load-bearing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    validateEnvironment(VALID)

    expect(warn).not.toHaveBeenCalled()
  })
})
