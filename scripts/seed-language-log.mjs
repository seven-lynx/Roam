/**
 * seed-language-log.mjs — Language Log seeder
 * Linguistics deep-dives, language evolution, etymology — academic but accessible.
 * Category: PEOPLE_PLACES → LANGUAGES_LINGUISTICS
 * Multi-method: RSS → Sitemap → Wayback CDX
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "languagelog.ldc.upenn.edu",
  cacheFileName: "language-log.json",
  displayName: "🗣️ Language Log",
  feedUrl: "https://languagelog.ldc.upenn.edu/nll/?feed=rss2",
  articlePathRegex: /\/nll\/\?p=\d+$/i,
  siteSuffixRegex: /[–\-|]\s*Language Log\s*$/i,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.LANGUAGES_LINGUISTICS,
  source: "language-log",
  seeder_score: 0.8,
});