/**
 * URL Queue Manager
 * 
 * Maintains a prefetch queue with 3 "hot" URLs (pre-validated, ready to display)
 * and 5 "warming" URLs (requests in flight, validating).
 * 
 * Queue state persists to chrome.storage.local so it survives page restarts.
 */

import { getSupabase } from './supabase';
import { Sentry } from './sentry';

export interface QueuedUrl {
  id: string; // UUID for tracking
  url: string;
  title?: string;
  description?: string;
  category_id?: string;
  og_image_url?: string;
  status: "hot" | "warming" | "failed";
  retry_count: number;
  last_retry_time?: number;
  added_at: number;
}

export interface FailedUrl {
  url: string;
  failure_reason: "timeout" | "not_html" | "non_200" | "network_error" | "unknown";
  timestamp: number;
  retry_count: number;
}

const QUEUE_STORAGE_KEY = "url_queue";
const FAILED_URLS_KEY = "failed_urls";
const FAILED_URL_BATCH_RETRY_KEY = "failed_url_batch_retry";
const MAX_HOT = 3;
const MAX_WARMING = 5;
const MAX_RETRIES = 3;
const VALIDATION_TIMEOUT = 8000; // 8 seconds
const MIN_RETRY_DELAY = 500; // ms
const FAILED_BATCH_MIN_RETRY_DELAY = 1000; // 1 second for batch send retries
const FAILED_BATCH_MAX_RETRIES = 3;

/**
 * Calculate exponential backoff delay: 500ms * (2 ^ retry_count)
 * retry_count=0 -> 500ms, 1 -> 1000ms, 2 -> 2000ms
 */
export function getRetryDelay(retryCount: number): number {
  return MIN_RETRY_DELAY * Math.pow(2, retryCount);
}

/**
 * Validate a URL by fetching it with a timeout and checking response metadata
 * Returns true if valid (200 OK, text/html), false if invalid
 */
export async function validateUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      mode: "no-cors", // Allow cross-origin in extension context
    });

    clearTimeout(timeoutId);

    // Check response status
    if (!response.ok && response.status !== 0) {
      // status 0 = no-cors mode (still counts as valid)
      return false;
    }

    // Check Content-Type
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && response.status !== 0) {
      return false;
    }

    return true;
  } catch (error) {
    // Timeout, network error, etc.
    return false;
  }
}

/**
 * Load the current queue state from storage
 */
export async function loadQueue(): Promise<{
  hot: QueuedUrl[];
  warming: QueuedUrl[];
}> {
  return new Promise((resolve) => {
    chrome.storage.local.get([QUEUE_STORAGE_KEY], (result) => {
      const queue = result[QUEUE_STORAGE_KEY] || { hot: [], warming: [] };
      resolve(queue);
    });
  });
}

/**
 * Save queue state to storage
 */
export async function saveQueue(queue: {
  hot: QueuedUrl[];
  warming: QueuedUrl[];
}): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: queue }, resolve);
  });
}

/**
 * Add URLs to the queue (typically called after fetching from roam() RPC)
 * New URLs go to warming for validation
 */
export async function addUrlsToQueue(urls: QueuedUrl[]): Promise<void> {
  const queue = await loadQueue();

  // Add new URLs to warming queue
  queue.warming.push(...urls);

  await saveQueue(queue);
}

/**
 * Move a URL from warming to hot after successful validation
 */
export async function promoteToHot(urlId: string): Promise<void> {
  const queue = await loadQueue();

  const warmingIndex = queue.warming.findIndex((u) => u.id === urlId);
  if (warmingIndex === -1) return;

  const [url] = queue.warming.splice(warmingIndex, 1);
  url.status = "hot";

  queue.hot.push(url);

  await saveQueue(queue);
}

/**
 * Move a URL to the back of the warming queue for retry
 * Only retries if under MAX_RETRIES
 */
export async function scheduleRetry(urlId: string): Promise<void> {
  const queue = await loadQueue();

  const warmingIndex = queue.warming.findIndex((u) => u.id === urlId);
  if (warmingIndex === -1) return;

  const url = queue.warming[warmingIndex];

  if (url.retry_count >= MAX_RETRIES) {
    // Evict after too many retries
    queue.warming.splice(warmingIndex, 1);
    await logFailedUrl(url.url, "unknown", url.retry_count);
  } else {
    // Move to back of queue with retry count incremented
    queue.warming.splice(warmingIndex, 1);
    url.retry_count += 1;
    url.last_retry_time = Date.now();
    queue.warming.push(url);
  }

  await saveQueue(queue);
}

/**
 * Pop the next hot URL from the queue
 * Call this when user clicks Roam
 */
export async function popHotUrl(): Promise<QueuedUrl | null> {
  const queue = await loadQueue();

  if (queue.hot.length === 0) {
    return null;
  }

  const url = queue.hot.shift()!;
  url.status = "hot"; // Still hot even after popping

  await saveQueue(queue);

  return url;
}

/**
 * Pop the best available URL: hot first, then first warming URL.
 * Used as a fallback so Roam doesn't make a redundant live API call when
 * the queue has just been filled but validation hasn't run yet.
 */
export async function popAnyUrl(): Promise<QueuedUrl | null> {
  const queue = await loadQueue();

  if (queue.hot.length > 0) {
    const url = queue.hot.shift()!;
    await saveQueue(queue);
    return url;
  }

  if (queue.warming.length > 0) {
    // Use the first warming URL directly — it comes from the DB (approved),
    // so skipping the HEAD check here is acceptable as a one-time fast-path.
    const url = queue.warming.shift()!;
    await saveQueue(queue);
    return url;
  }

  return null;
}

/**
 * Get the next URL from warming that is ready to validate (respecting backoff)
 */
export async function getNextWarmingUrl(): Promise<QueuedUrl | null> {
  const queue = await loadQueue();

  for (const url of queue.warming) {
    if (url.retry_count === 0) {
      // First attempt, always ready
      return url;
    }

    const lastRetry = url.last_retry_time || 0;
    const delay = getRetryDelay(url.retry_count - 1); // Previous retry count
    const nextRetryTime = lastRetry + delay;

    if (Date.now() >= nextRetryTime) {
      // Backoff period elapsed
      return url;
    }
  }

  return null;
}

/**
 * Get current queue state for debugging/monitoring
 */
export async function getQueueState(): Promise<{
  hot_count: number;
  warming_count: number;
  failed_count: number;
}> {
  const queue = await loadQueue();
  const failedUrls = await loadFailedUrls();

  return {
    hot_count: queue.hot.length,
    warming_count: queue.warming.length,
    failed_count: failedUrls.length,
  };
}

/**
 * Load failed URL log from storage
 */
export async function loadFailedUrls(): Promise<FailedUrl[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([FAILED_URLS_KEY], (result) => {
      resolve(result[FAILED_URLS_KEY] || []);
    });
  });
}

/**
 * Log a failed URL for later moderation analysis
 */
export async function logFailedUrl(
  url: string,
  reason: FailedUrl["failure_reason"],
  retryCount: number
): Promise<void> {
  const failed = await loadFailedUrls();

  failed.push({
    url,
    failure_reason: reason,
    timestamp: Date.now(),
    retry_count: retryCount,
  });

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [FAILED_URLS_KEY]: failed }, resolve);
  });

  // If we've accumulated 100+ failed URLs, prepare a batch send
  if (failed.length % 100 === 0) {
    await maybeSendFailedUrlBatch();
  }
}

/**
 * Send accumulated failed URLs to the server for moderation queue insertion
 * Implements exponential backoff retry with up to 3 attempts
 * Failed sends are tracked in Sentry for monitoring
 */
let sendFailedUrlBatchRetryCount = 0;

/**
 * Calculate exponential backoff delay for failed batch sends
 * 1000ms * (2 ^ retry_count) = 1s, 2s, 4s
 */
function getFailedBatchRetryDelay(retryCount: number): number {
  return FAILED_BATCH_MIN_RETRY_DELAY * Math.pow(2, retryCount);
}

/**
 * Schedule a retry of sendFailedUrlBatch with exponential backoff
 */
function scheduleFailedBatchRetry(): void {
  if (sendFailedUrlBatchRetryCount >= FAILED_BATCH_MAX_RETRIES) {
    console.warn('[roam-bg] Max retry attempts (3) reached for failed URL batch, giving up');
    return;
  }

  const delay = getFailedBatchRetryDelay(sendFailedUrlBatchRetryCount);
  console.log(`[roam-bg] Scheduling failed URL batch retry in ${delay}ms (attempt ${sendFailedUrlBatchRetryCount + 1}/${FAILED_BATCH_MAX_RETRIES})`);

  // Schedule the retry
  setTimeout(() => {
    sendFailedUrlBatch().catch((error) => {
      console.error('[roam-bg] Failed batch retry error:', error);
    });
  }, delay);
}

export async function sendFailedUrlBatch(): Promise<void> {
  const failed = await loadFailedUrls();
  if (failed.length === 0) return;

  try {
    console.log(`[roam-bg] Attempting to send ${failed.length} failed URLs (attempt ${sendFailedUrlBatchRetryCount + 1}/${FAILED_BATCH_MAX_RETRIES})`);

    // Send to Edge Function via the Supabase client
    const { error } = await getSupabase().functions.invoke('log-failed-urls', {
      body: { failed_urls: failed },
    });

    if (!error) {
      // Clear failed URLs after successful send
      console.log(`[roam-bg] Successfully sent ${failed.length} failed URLs to server`);
      sendFailedUrlBatchRetryCount = 0;
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [FAILED_URLS_KEY]: [] }, resolve);
      });
    } else {
      throw error;
    }
  } catch (error) {
    sendFailedUrlBatchRetryCount++;
    
    // Determine the error type for better context
    let errorType = 'unknown';
    let errorMessage = 'Unknown error sending failed URL batch';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes('timeout')) errorType = 'timeout';
      else if (error.message.includes('network')) errorType = 'network_error';
      else if (error.message.includes('auth')) errorType = 'authentication_error';
      else if (error.message.includes('401') || error.message.includes('403')) errorType = 'auth_failed';
      else errorType = 'function_error';
    }

    console.error(`[roam-bg] Failed URL batch send failed (attempt ${sendFailedUrlBatchRetryCount}): ${errorMessage}`);

    // Capture to Sentry with detailed context
    Sentry.captureException(error, {
      level: 'warning',
      tags: {
        context: 'failed-url-batch-send',
        error_type: errorType,
        attempt: sendFailedUrlBatchRetryCount,
        max_attempts: FAILED_BATCH_MAX_RETRIES,
      },
      extra: {
        failed_url_count: failed.length,
        error_message: errorMessage,
      },
    });

    // Schedule retry if under max attempts
    if (sendFailedUrlBatchRetryCount < FAILED_BATCH_MAX_RETRIES) {
      scheduleFailedBatchRetry();
    } else {
      // Final failure - log critical error and clear batch
      console.error(`[roam-bg] CRITICAL: Failed to send ${failed.length} failed URLs after ${FAILED_BATCH_MAX_RETRIES} attempts. Clearing batch.`);
      Sentry.captureException(new Error('Failed URL batch send: max retries exceeded'), {
        level: 'error',
        tags: {
          context: 'failed-url-batch-final-failure',
          failed_urls: failed.length,
        },
      });
      
      sendFailedUrlBatchRetryCount = 0;
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [FAILED_URLS_KEY]: [] }, resolve);
      });
    }
  }
}

/**
 * Check if should send batch (internal throttling)
 * Batches are sent every 100 failures or on sign-out
 */
async function maybeSendFailedUrlBatch(): Promise<void> {
  // Trigger batch send immediately (Edge Functions have built-in rate limiting)
  try {
    await sendFailedUrlBatch();
  } catch (error) {
    console.error('[roam-bg] Error in maybeSendFailedUrlBatch:', error);
    // Error is already handled in sendFailedUrlBatch with retries and Sentry capture
  }
}

/**
 * Clear all queue data (called on sign-out)
 */
export async function clearQueue(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([QUEUE_STORAGE_KEY], resolve);
  });
}
