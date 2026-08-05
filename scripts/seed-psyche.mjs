/**
 * seed-psyche.mjs — Psyche (Aeon's sister mag) seeder
 * Expert-written guides on psychology, philosophy, mental health.
 * Category: MIND_BODY → MENTAL_HEALTH
 * Multi-method: RSS → Sitemap → Wayback CDX
 * Feed: https://psyche.co/feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "psyche.co",
  cacheFileName: "psyche.json",
  displayName: "🧠 Psyche",
  feedUrl: "https://psyche.co/feed",
  articlePathRegex: /\/ideas\/[a-z0-9-]+|\/guides\/[a-z0-9-]+|\/films\/[a-z0-9-]+/i,
  siteSuffixRegex: /[–\-|]\s*Psyche\s*$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.MENTAL_HEALTH,
  source: "psyche",
  seeder_score: 0.9,
});