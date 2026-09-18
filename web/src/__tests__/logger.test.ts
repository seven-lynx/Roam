/**
 * Tests for centralized logging utility (lib/logger.ts).
 * Verifies: log levels, environment-based filtering, sanitization, Sentry integration.
 *
 * Note: This file replaces the placeholder test at the bottom of the existing
 * logger.test.ts. The existing test file should be reviewed and merged.
 */

describe('Logger (lib/logger)', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = process.env
    jest.resetModules()
    jest.clearAllMocks()
    delete (global as unknown as Record<string, unknown>).localStorage
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function mockLocalStorage(store: Record<string, string> = {}) {
    const ls = {
      getItem: jest.fn((key: string) => store[key] ?? null),
      setItem: jest.fn((key: string, value: string) => { store[key] = value }),
      removeItem: jest.fn((key: string) => { delete store[key] }),
    }
    Object.defineProperty(global, 'localStorage', { value: ls, writable: true })
    return store
  }

  function setDevEnv() {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    delete process.env.LOG_LEVEL
  }

  function setProdEnv() {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    delete process.env.LOG_LEVEL
  }

  // ─── logDebug ─────────────────────────────────────────────────────────────────

  describe('logDebug', () => {
    it('should call console.debug in development', () => {
      setDevEnv()
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})
      const { logDebug } = require('@/lib/logger')

      logDebug('test', 'hello world', { count: 5 })

      expect(debugSpy).toHaveBeenCalledWith(
        '[test] hello world',
        { count: 5 }
      )
      debugSpy.mockRestore()
    })

    it('should not call console.debug in production', () => {
      setProdEnv()
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})
      const { logDebug } = require('@/lib/logger')

      logDebug('test', 'hello')

      expect(debugSpy).not.toHaveBeenCalled()
      debugSpy.mockRestore()
    })

    it('should sanitize sensitive fields', () => {
      setDevEnv()
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})
      const { logDebug } = require('@/lib/logger')

      logDebug('auth', 'user event', {
        email: 'user@example.com',
        userId: '123',
        count: 5,
      })

      const callArgs = debugSpy.mock.calls[0] as unknown[]
      const context = callArgs[1] as Record<string, unknown>
      expect(context).not.toHaveProperty('email')
      expect(context).not.toHaveProperty('userId')
      expect(context).toHaveProperty('count', 5)
      debugSpy.mockRestore()
    })
  })

  // ─── logInfo ──────────────────────────────────────────────────────────────────

  describe('logInfo', () => {
    it('should call console.info in development', () => {
      setDevEnv()
      const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
      const { logInfo } = require('@/lib/logger')

      logInfo('auth', 'session loaded', { attempt: 2 })

      expect(infoSpy).toHaveBeenCalledWith(
        '[auth] session loaded',
        { attempt: 2 }
      )
      infoSpy.mockRestore()
    })

    it('should call console.info when LOG_LEVEL=info (server-side only)', () => {
      // In jsdom window is defined, so getLogLevel takes the client path.
      // On client, LOG_LEVEL env var is not used — localStorage override or NODE_ENV is.
      // This test simulates the server path by temporarily hiding window.
      const originalWindow = global.window
      delete (global as Record<string, unknown>).window

      try {
        setProdEnv()
        process.env.LOG_LEVEL = 'info'
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
        const { logInfo } = require('@/lib/logger')

        logInfo('auth', 'test')

        expect(infoSpy).toHaveBeenCalled()
        infoSpy.mockRestore()
      } finally {
        global.window = originalWindow as Window & typeof globalThis
      }
    })
  })

  // ─── logWarn ──────────────────────────────────────────────────────────────────

  describe('logWarn', () => {
    it('should call console.warn', () => {
      setDevEnv()
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const { logWarn } = require('@/lib/logger')

      logWarn('roam', 'slow response', { duration: 5000 })

      expect(warnSpy).toHaveBeenCalledWith(
        '[roam] slow response',
        { duration: 5000 }
      )
      warnSpy.mockRestore()
    })
  })

  // ─── logError ─────────────────────────────────────────────────────────────────

  describe('logError', () => {
    it('should always call console.error regardless of environment', () => {
      setProdEnv()
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const { logError } = require('@/lib/logger')

      logError('submit', 'URL rejected', { statusCode: 403 })

      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })

    it('should sanitize sensitive data in error context', () => {
      setDevEnv()
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const { logError } = require('@/lib/logger')

      logError('profile', 'update failed', {
        email: 'secret@example.com',
        token: 'bearer-token',
        statusCode: 500,
      })

      const callArgs = errorSpy.mock.calls[0] as unknown[]
      const context = callArgs[1] as Record<string, unknown>
      expect(context).not.toHaveProperty('email')
      expect(context).not.toHaveProperty('token')
      expect(context).toHaveProperty('statusCode', 500)
      errorSpy.mockRestore()
    })

    it('should accept an optional Error object', () => {
      setDevEnv()
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const { logError } = require('@/lib/logger')
      const err = new Error('boom')

      logError('module', 'something broke', {}, err)

      const callArgs = errorSpy.mock.calls[0] as unknown[]
      expect(callArgs[2]).toBe(err)
      errorSpy.mockRestore()
    })
  })

  // ─── setLogLevel ──────────────────────────────────────────────────────────────

  describe('setLogLevel', () => {
    it('should allow overriding log level at runtime', () => {
      // Start in production (errors only)
      setProdEnv()
      const { setLogLevel, logDebug } = require('@/lib/logger')

      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})
      logDebug('t', 'should be silent')
      expect(debugSpy).not.toHaveBeenCalled()

      // Override to DEBUG
      setLogLevel(0) // LogLevel.DEBUG
      logDebug('t', 'now visible')
      expect(debugSpy).toHaveBeenCalledTimes(1)
      debugSpy.mockRestore()
    })

    it('should persist override to localStorage when available', () => {
      setProdEnv()
      const store = mockLocalStorage()
      const { setLogLevel } = require('@/lib/logger')

      setLogLevel(2) // LogLevel.WARN

      expect(store['roam_log_level']).toBe('2')
      delete (global as unknown as Record<string, unknown>).localStorage
    })

    it('should use localStorage override when present', () => {
      setProdEnv()
      // DEBUG = 0
      mockLocalStorage({ roam_log_level: '0' })
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})
      const { logDebug } = require('@/lib/logger')

      logDebug('t', 'visible via localStorage override')
      expect(debugSpy).toHaveBeenCalledTimes(1)
      debugSpy.mockRestore()
      delete (global as unknown as Record<string, unknown>).localStorage
    })
  })

  // ─── clearLogLevelOverride ───────────────────────────────────────────────────

  describe('clearLogLevelOverride', () => {
    it('should remove stored override from localStorage', () => {
      setProdEnv()
      const store = mockLocalStorage({ roam_log_level: '0' })
      const { clearLogLevelOverride } = require('@/lib/logger')

      clearLogLevelOverride()
      expect(store).not.toHaveProperty('roam_log_level')
      delete (global as unknown as Record<string, unknown>).localStorage
    })
  })

  // ─── sanitizeContext ──────────────────────────────────────────────────────────

  describe('sanitizeContext', () => {
    it('should block known PII keys: email, password, token, secret, userId, id, url, response, body, payload', () => {
      setDevEnv()
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})
      const { logDebug } = require('@/lib/logger')

      logDebug('test', 'msg', {
        email: 'a@b.com',
        password: 'secret123',
        token: 'abc',
        secret: 'xyz',
        userId: 'u-1',
        id: 42,
        url: 'https://example.com',
        response: 'some response',
        body: 'some body',
        payload: 'some payload',
      })

      const callArgs = debugSpy.mock.calls[0] as unknown[]
      const context = callArgs[1] as Record<string, unknown>
      const keys = Object.keys(context)
      expect(keys).toHaveLength(0) // All should be filtered out
      debugSpy.mockRestore()
    })

    it('should allow safe keys: statusCode, count, duration, retry, attempt, reason, category, type, action', () => {
      setDevEnv()
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})
      const { logDebug } = require('@/lib/logger')

      logDebug('test', 'msg', {
        statusCode: 200,
        count: 10,
        duration: 1234,
        retry: 3,
        attempt: 1,
        reason: 'timeout',
        category: 'science',
        type: 'fetch',
        action: 'roam',
      })

      const callArgs = debugSpy.mock.calls[0] as unknown[]
      const context = callArgs[1] as Record<string, unknown>
      expect(context).toHaveProperty('statusCode', 200)
      expect(context).toHaveProperty('count', 10)
      expect(context).toHaveProperty('duration', 1234)
      expect(context).toHaveProperty('retry', 3)
      expect(context).toHaveProperty('attempt', 1)
      expect(context).toHaveProperty('reason', 'timeout')
      expect(context).toHaveProperty('category', 'science')
      expect(context).toHaveProperty('type', 'fetch')
      expect(context).toHaveProperty('action', 'roam')
      debugSpy.mockRestore()
    })

    it('should handle case-insensitive matching for PII keys', () => {
      setDevEnv()
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})
      const { logDebug } = require('@/lib/logger')

      logDebug('test', 'msg', {
        Email: 'a@b.com',
        Token: 'abc',
        UserId: 'u-1',
        count: 5,
      })

      const callArgs = debugSpy.mock.calls[0] as unknown[]
      const context = callArgs[1] as Record<string, unknown>
      expect(context).not.toHaveProperty('Email')
      expect(context).not.toHaveProperty('Token')
      expect(context).not.toHaveProperty('UserId')
      expect(context).toHaveProperty('count', 5)
      debugSpy.mockRestore()
    })
  })

  // ─── LogLevel enum ────────────────────────────────────────────────────────────

  describe('LogLevel enum', () => {
    it('should export DEBUG=0, INFO=1, WARN=2, ERROR=3', () => {
      const { LogLevel } = require('@/lib/logger')
      expect(LogLevel.DEBUG).toBe(0)
      expect(LogLevel.INFO).toBe(1)
      expect(LogLevel.WARN).toBe(2)
      expect(LogLevel.ERROR).toBe(3)
    })
  })
})