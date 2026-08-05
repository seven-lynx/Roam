/**
 * seed-sleep-foundation.mjs — Sleep Foundation seeder
 * Sleep science, sleep disorders, recovery techniques, circadian rhythms.
 * Category: MIND_BODY → SLEEP_RECOVERY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "sleepfoundation.org",
  cacheFileName: "sleep-foundation.json",
  displayName: "😴 Sleep Foundation",
  articlePathRegex: /\/(sleep-news|sleep-disorders|sleep-hygiene|bedroom-environment)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Sleep Foundation\s*$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.SLEEP_RECOVERY,
  source: "sleep-foundation",
  seeder_score: 0.7,
  maxPages: 20,
});