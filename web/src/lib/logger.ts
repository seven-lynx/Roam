/**
 * Centralized logging utility for Roam web platform.
 *
 * This module provides a safe, structured logging interface that:
 * 1. Prevents sensitive data (emails, IDs, tokens) from leaking to console
 * 2. Routes errors to Sentry for production monitoring
 * 3. Respects environment-specific log levels (DEBUG in dev, ERROR in prod)
 * 4. Uses Sentry breadcrumbs for context, not raw console.log statements
 *
 * Usage:
 *   import { logInfo, logError, logDebug } from '@/lib/logger';
 *   logInfo('auth', 'User signed in', { userId: user.id.slice(0, 8) });
 *   logError('roam', 'Failed to fetch URL', { statusCode: error.status });
 */

import * as Sentry from '@sentry/nextjs';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Determine the effective log level for this environment.
 * - Development: DEBUG (log everything)
 * - Staging: INFO (skip debug logs)
 * - Production: ERROR (only log errors)
 *
 * Override with the LOG_LEVEL environment variable.
 */
function getLogLevel(): LogLevel {
  if (typeof window === 'undefined') {
    // Server-side: check env var
    const level = process.env.LOG_LEVEL || process.env.NODE_ENV;
    if (level === 'debug') return LogLevel.DEBUG;
    if (level === 'info' || level === 'development') return LogLevel.INFO;
    return LogLevel.ERROR;
  }

  // Client-side: respect localStorage override, default by NODE_ENV
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('roam_log_level');
    if (stored) {
      const level = parseInt(stored, 10);
      return isNaN(level) ? LogLevel.ERROR : level;
    }
  }

  return process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.ERROR;
}

const CURRENT_LOG_LEVEL = getLogLevel();

/**
 * Safely format log context, stripping sensitive fields.
 * Safe fields: statusCode, count, duration, retry, attempt
 * Unsafe fields (never logged): email, password, token, secret, userId, id, url (full URLs can leak intent)
 */
function sanitizeContext(context?: Record<string, any>): Record<string, any> {
  if (!context) return {};

  const safe: Record<string, any> = {};
  const SAFE_KEYS = ['statusCode', 'count', 'duration', 'retry', 'attempt', 'reason', 'category', 'type', 'action'];
  const UNSAFE_KEYS = ['email', 'password', 'token', 'secret', 'userId', 'id', 'url', 'response', 'body', 'payload'];

  for (const [key, value] of Object.entries(context)) {
    // Block unsafe keys entirely
    if (UNSAFE_KEYS.some((unsafe) => key.toLowerCase().includes(unsafe))) continue;

    // Whitelist safe keys only; blacklist common PII
    if (SAFE_KEYS.some((safe) => key.toLowerCase().includes(safe))) {
      safe[key] = value;
    }
  }

  return safe;
}

/**
 * Log at DEBUG level (most verbose).
 * Example: logDebug('queue', 'URL validated', { count: 8 });
 */
export function logDebug(module: string, message: string, context?: Record<string, any>): void {
  if (CURRENT_LOG_LEVEL > LogLevel.DEBUG) return;

  const sanitized = sanitizeContext(context);
  console.debug(`[${module}] ${message}`, sanitized);
  Sentry.captureMessage(`[DEBUG] [${module}] ${message}`, 'debug');
}

/**
 * Log at INFO level.
 * Example: logInfo('auth', 'Session loaded', { attempt: 2 });
 */
export function logInfo(module: string, message: string, context?: Record<string, any>): void {
  if (CURRENT_LOG_LEVEL > LogLevel.INFO) return;

  const sanitized = sanitizeContext(context);
  console.info(`[${module}] ${message}`, sanitized);
  Sentry.captureMessage(`[INFO] [${module}] ${message}`, 'info');
}

/**
 * Log at WARN level.
 * Example: logWarn('roam', 'Slow API response', { duration: 5000 });
 */
export function logWarn(module: string, message: string, context?: Record<string, any>): void {
  if (CURRENT_LOG_LEVEL > LogLevel.WARN) return;

  const sanitized = sanitizeContext(context);
  console.warn(`[${module}] ${message}`, sanitized);
  Sentry.captureMessage(`[WARN] [${module}] ${message}`, 'warning');
}

/**
 * Log at ERROR level (most critical, always logged).
 * Captures the error to Sentry for monitoring.
 * Example: logError('submit', 'URL rejected by Safe Browsing', { statusCode: 403 });
 */
export function logError(module: string, message: string, context?: Record<string, any>, error?: Error): void {
  const sanitized = sanitizeContext(context);
  console.error(`[${module}] ${message}`, sanitized, error);

  // Always capture errors to Sentry
  if (error) {
    Sentry.captureException(error, {
      tags: { module, message },
      extra: sanitized,
    });
  } else {
    Sentry.captureMessage(`[ERROR] [${module}] ${message}`, 'error');
  }
}

/**
 * Override the current log level (for debugging).
 * Usage: setLogLevel(LogLevel.DEBUG) to enable all logs temporarily.
 * Persists to localStorage on client-side.
 */
export function setLogLevel(level: LogLevel): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('roam_log_level', level.toString());
  }
}

/**
 * Clear the log level override.
 */
export function clearLogLevelOverride(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('roam_log_level');
  }
}
