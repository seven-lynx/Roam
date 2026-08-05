/**
 * seed-brainpickings.mjs — The Marginalian (Brain Pickings) seeder
 * Maria Popova's curated essays on literature, philosophy, art, and the human condition.
 * Category: MIND_BODY → PSYCHOLOGY_BEHAVIOUR
 * Multi-method: RSS → Sitemap → Wayback CDX
 * Feed: https://www.themarginalian.org/feed/
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "themarginalian.org",
  cacheFileName: "brainpickings.json",
  displayName: "🧠 The Marginalian",
  feedUrl: "https://www.themarginalian.org/feed/",
  articlePathRegex: /\/20\d{2}\/\d{2}\/\d{2}\/[a-z0-9-]+\.html?$/i,
  siteSuffixRegex: /[–\-]\s*The Marginalian\s*$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR,
  source: "brainpickings",
  seeder_score: 0.9,
});