/**
 * Background Queue Manager
 * 
 * Runs in the extension background service worker.
 * Continuously maintains the prefetch queue by:
 * - Validating warming URLs in the background
 * - Refilling queue when hot/warming counts drop
 * - Respecting category preferences
 */

import {
  QueuedUrl,
  validateUrl,
  loadQueue,
  saveQueue,
  addUrlsToQueue,
  promoteToHot,
  scheduleRetry,
  getNextWarmingUrl,
  getQueueState,
  clearQueue,
  sendFailedUrlBatch,
  logFailedUrl,
} from "./queue";
import { getSupabase } from "./supabase";

const MAX_HOT = 3;
const MAX_WARMING = 5;
const REFILL_THRESHOLD = 5; // Refill when queue drops below this
const VALIDATION_CHECK_INTERVAL = 2000; // Check for URLs to validate every 2 seconds
const REFILL_CHECK_INTERVAL = 5000; // Check if refill needed every 5 seconds

let validationLoopRunning = false;
let refillLoopRunning = false;
let categoryFilter: string[] = []; // Current category filter

/**
 * Initialize queue management for this session
 * Call this after user signs in and categories are loaded
 */
export async function initializeQueueManagement(
  userCategoryIds: string[]
): Promise<void> {
  categoryFilter = userCategoryIds;

  // Clear any stale queue from previous session
  await clearQueue();

  // Fetch initial batch of URLs for warming
  await refillQueue();

  // Start background validation and refill loops
  startValidationLoop();
  startRefillLoop();
}

/**
 * Start the validation loop - continuously validate warming URLs
 */
export function startValidationLoop(): void {
  if (validationLoopRunning) return;
  validationLoopRunning = true;

  const loop = async () => {
    while (validationLoopRunning) {
      await validateNextUrl();
      await sleep(VALIDATION_CHECK_INTERVAL);
    }
  };

  loop();
}

/**
 * Stop the validation loop
 */
export function stopValidationLoop(): void {
  validationLoopRunning = false;
}

/**
 * Validate the next warming URL in queue
 */
async function validateNextUrl(): Promise<void> {
  const nextUrl = await getNextWarmingUrl();
  if (!nextUrl) return;

  const isValid = await validateUrl(nextUrl.url);

  if (isValid) {
    // Move to hot queue
    await promoteToHot(nextUrl.id);
  } else {
    // Schedule retry or evict
    await scheduleRetry(nextUrl.id);
    await logFailedUrl(
      nextUrl.url,
      "network_error", // Generic failure reason
      nextUrl.retry_count
    );
  }
}

/**
 * Start the refill loop - continuously check if queue needs replenishing
 */
export function startRefillLoop(): void {
  if (refillLoopRunning) return;
  refillLoopRunning = true;

  const loop = async () => {
    while (refillLoopRunning) {
      const state = await getQueueState();

      // Refill if hot + warming drops below threshold
      if (state.hot_count + state.warming_count < REFILL_THRESHOLD) {
        await refillQueue();
      }

      await sleep(REFILL_CHECK_INTERVAL);
    }
  };

  loop();
}

/**
 * Stop the refill loop
 */
export function stopRefillLoop(): void {
  refillLoopRunning = false;
}

/**
 * Fetch fresh URLs from roam() RPC and add to queue
 */
export async function refillQueue(): Promise<void> {
  try {
    const queue = await loadQueue();

    // Calculate how many we need
    const current = queue.hot.length + queue.warming.length;
    const needed = MAX_HOT + MAX_WARMING - current;

    if (needed <= 0) return;

    // Fetch fresh URLs from roam() RPC
    // This will be called via the background worker's getSupabase() client
    // For now, we queue the request to be handled by the message listener
    const urls = await fetchFreshUrls(needed);

    // Add to warming queue with unique IDs
    const queuedUrls: QueuedUrl[] = urls.map((url) => ({
      id: generateUUID(),
      url: url.url,
      title: url.title,
      description: url.description,
      category_id: url.category_id,
      og_image_url: url.og_image_url,
      status: "warming",
      retry_count: 0,
      added_at: Date.now(),
    }));

    await addUrlsToQueue(queuedUrls);
  } catch (error) {
    console.error("Failed to refill queue:", error);
  }
}

/**
 * Fetch fresh URLs from roam() RPC
 * This is called from the background worker context
 */
export async function fetchFreshUrls(
  count: number
): Promise<
  Array<{
    url: string;
    title?: string;
    description?: string;
    category_id?: string;
    og_image_url?: string;
  }>
> {
  try {
    const results = [];

    // Fetch URLs one at a time up to the count requested
    // This is simple but could be optimized by batching the RPC call
    for (let i = 0; i < count; i++) {
      const { data, error } = await getSupabase().functions.invoke("roam", {
        body: { category_filter: categoryFilter },
      });

      if (error || !data) {
        console.error("Failed to fetch URL:", error?.message || "Unknown error");
        break;
      }

      results.push({
        url: data.url,
        title: data.title,
        description: data.description,
        category_id: data.category_id,
        og_image_url: data.og_image_url,
      });
    }

    return results;
  } catch (error) {
    console.error("Error fetching fresh URLs:", error);
    return [];
  }
}

/**
 * Update category filter and refetch queue
 * Call this when user changes category preferences
 */
export async function updateCategoryFilter(
  newCategoryIds: string[]
): Promise<void> {
  categoryFilter = newCategoryIds;

  // Clear and refetch queue with new categories
  await clearQueue();
  await refillQueue();
}

/**
 * Get current queue statistics for debugging
 */
export async function getQueueStats(): Promise<{
  hot_count: number;
  warming_count: number;
  failed_count: number;
  category_filter: string[];
}> {
  const state = await getQueueState();
  return {
    ...state,
    category_filter: categoryFilter,
  };
}

/**
 * Sign out cleanup - send failed URL batch and clear queue
 */
export async function cleanupOnSignOut(): Promise<void> {
  stopValidationLoop();
  stopRefillLoop();

  // Send any accumulated failed URLs before clearing
  await sendFailedUrlBatch();

  // Clear queue
  await clearQueue();
}

// Utility functions

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
