/**
 * Tests for the centralized logger utility.
 * Verifies: log level filtering, context sanitization, error capture.
 */

import * as Sentry from '@sentry/nextjs'
import { logDebug, logInfo, logWarn, logError, LogLevel, setLogLevel } from '@/lib/logger'

jest.mock('@sentry/nextjs')

describe('Logger', () => {
  beforeEach(() => {
    // Clear mock calls before each test
    jest.clearAllMocks()
    // Reset log level to ERROR (production default)
    setLogLevel(LogLevel.ERROR)
  })

  describe('logDebug', () => {
    it('should not log when level is INFO or above', () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation()
      setLogLevel(LogLevel.INFO)

      logDebug('test', 'Debug message')

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should log when level is DEBUG', () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation()
      setLogLevel(LogLevel.DEBUG)

      logDebug('auth', 'Session initialized', { attempt: 1 })

      expect(consoleSpy).toHaveBeenCalledWith(
        '[auth] Session initialized',
        { attempt: 1 }
      )
      consoleSpy.mockRestore()
    })
  })

  describe('logInfo', () => {
    it('should log at INFO level and capture to Sentry', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation()
      setLogLevel(LogLevel.INFO)

      logInfo('roam', 'URL fetched', { statusCode: 200 })

      expect(consoleSpy).toHaveBeenCalledWith(
        '[roam] URL fetched',
        { statusCode: 200 }
      )
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        '[INFO] [roam] URL fetched',
        'info'
      )
      consoleSpy.mockRestore()
    })
  })

  describe('Context sanitization', () => {
    it('should sanitize sensitive fields', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const dangerousContext = {
        email: 'user@example.com', // UNSAFE
        userId: 'abc-123', // UNSAFE
        statusCode: 404, // SAFE
        reason: 'not found', // SAFE
      }

      logError('test', 'Error occurred', dangerousContext)

      // Should not contain email or userId
      const calls = consoleSpy.mock.calls
      expect(JSON.stringify(calls)).not.toContain('user@example.com')
      expect(JSON.stringify(calls)).not.toContain('abc-123')
      // Should contain safe fields
      expect(JSON.stringify(calls)).toContain('404')
      expect(JSON.stringify(calls)).toContain('not found')

      consoleSpy.mockRestore()
    })

    it('should allow safe context fields through', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation()
      setLogLevel(LogLevel.INFO)

      const safeContext = {
        statusCode: 200,
        count: 42,
        duration: 1500,
        attempt: 2,
        category: 'science',
      }

      logInfo('api', 'Request completed', safeContext)

      const lastCall = consoleSpy.mock.calls[0]
      const contextArg = lastCall[1]
      expect(contextArg).toEqual(safeContext)

      consoleSpy.mockRestore()
    })
  })

  describe('logError', () => {
    it('should always capture errors to Sentry', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      setLogLevel(LogLevel.ERROR)

      const error = new Error('Network failure')
      logError('api', 'Request failed', { statusCode: 500 }, error)

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { module: 'api', message: 'Request failed' },
        extra: { statusCode: 500 },
      })

      consoleSpy.mockRestore()
    })

    it('should capture message errors to Sentry', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      logError('auth', 'Sign-in rate limit exceeded')

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        '[ERROR] [auth] Sign-in rate limit exceeded',
        'error'
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Log level filtering', () => {
    it('should respect DEBUG level (log everything)', () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation()
      setLogLevel(LogLevel.DEBUG)

      logDebug('test', 'msg')
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should respect ERROR level (only errors)', () => {
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation()
      const infoSpy = jest.spyOn(console, 'info').mockImplementation()
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      setLogLevel(LogLevel.ERROR)

      logDebug('test', 'debug')
      logInfo('test', 'info')
      logWarn('test', 'warn')
      logError('test', 'error')

      expect(debugSpy).not.toHaveBeenCalled()
      expect(infoSpy).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalled()

      debugSpy.mockRestore()
      infoSpy.mockRestore()
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })
})
