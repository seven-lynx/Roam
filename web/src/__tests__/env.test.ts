/**
 * Tests for environment variable validation (lib/env.ts).
 * Verifies: missing var detection, invalid URL detection, Vercel-Sentry behavior.
 */

describe('Environment Validation (web/lib/env)', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = process.env
    jest.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function setValidEnv() {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-123'
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://123.ingest.sentry.io/456'
    delete process.env.VERCEL
    delete process.env.SENTRY_AUTH_TOKEN
  }

  it('should export env object when all required vars are set', () => {
    setValidEnv()
    const { env } = require('@/lib/env')
    expect(env).toBeDefined()
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://project.supabase.co')
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('test-anon-key-123')
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBe('https://123.ingest.sentry.io/456')
  })

  it('should export getEnv() that returns the env object', () => {
    setValidEnv()
    const { getEnv, env } = require('@/lib/env')
    expect(getEnv()).toBe(env)
  })

  it('should throw when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key'
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://sentry.io/1'
    delete process.env.VERCEL

    expect(() => {
      require('@/lib/env')
    }).toThrow(/missing required environment variables/i)
  })

  it('should throw when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://sentry.io/1'
    delete process.env.VERCEL

    expect(() => {
      require('@/lib/env')
    }).toThrow(/missing required environment variables/i)
  })

  it('should throw when NEXT_PUBLIC_SENTRY_DSN is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key'
    process.env.NEXT_PUBLIC_SENTRY_DSN = ''
    delete process.env.VERCEL

    expect(() => {
      require('@/lib/env')
    }).toThrow(/missing required environment variables/i)
  })

  it('should throw when SUPABASE_URL is not HTTPS', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://insecure.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key'
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://sentry.io/1'
    delete process.env.VERCEL

    expect(() => {
      require('@/lib/env')
    }).toThrow(/must be an HTTPS URL/i)
  })

  it('should throw when SENTRY_DSN is not HTTPS', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key'
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'http://insecure.sentry.io/1'
    delete process.env.VERCEL

    expect(() => {
      require('@/lib/env')
    }).toThrow(/must be an HTTPS URL/i)
  })

  it('should list all missing vars in the error message', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''
    process.env.NEXT_PUBLIC_SENTRY_DSN = ''
    delete process.env.VERCEL

    expect(() => {
      require('@/lib/env')
    }).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('should warn when SENTRY_AUTH_TOKEN is missing on Vercel', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key'
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://sentry.io/1'
    process.env.VERCEL = '1'
    delete process.env.SENTRY_AUTH_TOKEN

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const { env } = require('@/lib/env')
    expect(env).toBeDefined()

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('SENTRY_AUTH_TOKEN missing')
    )

    warnSpy.mockRestore()
  })

  it('should not throw when SENTRY_AUTH_TOKEN is missing outside Vercel', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key'
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://sentry.io/1'
    delete process.env.VERCEL
    delete process.env.SENTRY_AUTH_TOKEN

    // Should not throw
    const { env } = require('@/lib/env')
    expect(env).toBeDefined()
  })
})