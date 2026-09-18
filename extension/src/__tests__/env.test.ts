import { describe, it, expect, vi } from 'vitest'

// vitest.config.ts defines these globals via `define`:
//   __SUPABASE_URL__ = '"https://test.supabase.co"'
//   __SUPABASE_ANON_KEY__ = '"test-anon-key"'
//   __SENTRY_DSN__ = '""'
// We dynamically override them per-test using vi.stubGlobal.

describe('validateEnvironment', () => {
  it('passes when URL and key are valid', async () => {
    vi.stubGlobal('__SUPABASE_URL__', 'https://abc.supabase.co')
    vi.stubGlobal('__SUPABASE_ANON_KEY__', 'valid-key')
    vi.stubGlobal('__SENTRY_DSN__', 'https://sentry.io/123')
    const { validateEnvironment } = await import('../lib/env')
    expect(() => validateEnvironment()).not.toThrow()
    vi.unstubAllGlobals()
  })

  it('throws when SUPABASE_URL is missing', async () => {
    vi.stubGlobal('__SUPABASE_URL__', '')
    vi.stubGlobal('__SUPABASE_ANON_KEY__', 'valid-key')
    vi.stubGlobal('__SENTRY_DSN__', '')
    const { validateEnvironment } = await import('../lib/env')
    expect(() => validateEnvironment()).toThrow(/SUPABASE_URL/)
    vi.unstubAllGlobals()
  })

  it('throws when SUPABASE_URL is not HTTPS', async () => {
    vi.stubGlobal('__SUPABASE_URL__', 'http://insecure.supabase.co')
    vi.stubGlobal('__SUPABASE_ANON_KEY__', 'valid-key')
    vi.stubGlobal('__SENTRY_DSN__', '')
    const { validateEnvironment } = await import('../lib/env')
    expect(() => validateEnvironment()).toThrow(/SUPABASE_URL/)
    vi.unstubAllGlobals()
  })

  it('throws when SUPABASE_ANON_KEY is missing', async () => {
    vi.stubGlobal('__SUPABASE_URL__', 'https://abc.supabase.co')
    vi.stubGlobal('__SUPABASE_ANON_KEY__', '')
    vi.stubGlobal('__SENTRY_DSN__', '')
    const { validateEnvironment } = await import('../lib/env')
    expect(() => validateEnvironment()).toThrow(/SUPABASE_ANON_KEY/)
    vi.unstubAllGlobals()
  })

  it('warns (does not throw) when SENTRY_DSN is empty', async () => {
    vi.stubGlobal('__SUPABASE_URL__', 'https://abc.supabase.co')
    vi.stubGlobal('__SUPABASE_ANON_KEY__', 'valid-key')
    vi.stubGlobal('__SENTRY_DSN__', '')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { validateEnvironment } = await import('../lib/env')
    expect(() => validateEnvironment()).not.toThrow()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SENTRY_DSN'))
    vi.unstubAllGlobals()
    warnSpy.mockRestore()
  })
})
