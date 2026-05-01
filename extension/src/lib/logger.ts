/**
 * Centralized logging utility for Roam extension.
 *
 * Prevents sensitive data leakage to:
 * 1. Browser console (user can inspect)
 * 2. Service Worker logs (persists indefinitely)
 * 3. Extension background page storage (accessible via chrome://extensions/details/)
 *
 * All errors automatically sent to Sentry for production monitoring.
 *
 * Usage in background.ts or popup.ts:
 *   import { logInfo, logError } from '@/lib/logger';
 *   logInfo('auth', 'OAuth initiated');
 *   logError('roam', 'Failed to fetch URL', { statusCode: 404 });
 */

import * as Sentry from '@sentry/browser';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Determine the effective log level.
 * Extension build mode: use BUILD_MODE env var
 * - development: DEBUG
 * - production: ERROR
 */
function getLogLevel(): LogLevel {
  // Check chrome.storage for persisted log level override
  let level = LogLevel.ERROR; // default to production-safe level

  if (typeof chrome !== 'undefined' && chrome.storage) {
    // Sync check (not ideal, but necessary during init)
    try {
      // Note: chrome.storage.local.get is async, so we can't use it here synchronously
      // Instead, init will call setLogLevelIfDev() to override this if needed
    } catch (e) {
      // Ignore errors
    }
  }

  // In development, default to INFO level for better debugging
  if (process.env.NODE_ENV === 'development') {
    level = LogLevel.INFO;
  }

  return level;
}

let CURRENT_LOG_LEVEL = getLogLevel();

/**
 * Safely format context, stripping sensitive fields.
 */
function sanitizeContext(context?: Record<string, any>): Record<string, any> {
  if (!context) return {};

  const safe: Record<string, any> = {};
  const SAFE_KEYS = ['statusCode', 'count', 'duration', 'retry', 'attempt', 'reason', 'category', 'type', 'action', 'platform'];
  const UNSAFE_KEYS = ['email', 'password', 'token', 'secret', 'userId', 'id', 'url', 'response', 'body', 'payload', 'session'];

  for (const [key, value] of Object.entries(context)) {
    if (UNSAFE_KEYS.some((unsafe) => key.toLowerCase().includes(unsafe))) continue;
    if (SAFE_KEYS.some((safe) => key.toLowerCase().includes(safe))) {
      safe[key] = value;
    }
  }

  return safe;
}

/**
 * Debug level log (only in development).
 */
export function logDebug(module: string, message: string, context?: Record<string, any>): void {
  if (CURRENT_LOG_LEVEL > LogLevel.DEBUG) return;

  const sanitized = sanitizeContext(context);
  console.debug(`[${module}] ${message}`, sanitized);
}

/**
 * Info level log.
 */
export function logInfo(module: string, message: string, context?: Record<string, any>): void {
  if (CURRENT_LOG_LEVEL > LogLevel.INFO) return;

  const sanitized = sanitizeContext(context);
  console.info(`[${module}] ${message}`, sanitized);
  Sentry.captureMessage(`[INFO] [${module}] ${message}`, 'info');
}

/**
 * Warning level log.
 */
export function logWarn(module: string, message: string, context?: Record<string, any>): void {
  if (CURRENT_LOG_LEVEL > LogLevel.WARN) return;

  const sanitized = sanitizeContext(context);
  console.warn(`[${module}] ${message}`, sanitized);
  Sentry.captureMessage(`[WARN] [${module}] ${message}`, 'warning');
}

/**
 * Error level log (always captured to Sentry).
 */
export function logError(module: string, message: string, context?: Record<string, any>, error?: Error): void {
  const sanitized = sanitizeContext(context);
  console.error(`[${module}] ${message}`, sanitized, error);

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
 * Override log level at runtime (for debugging).
 * Called from background.ts during init if in development mode.
 */
export function setLogLevel(level: LogLevel): void {
  CURRENT_LOG_LEVEL = level;
}
