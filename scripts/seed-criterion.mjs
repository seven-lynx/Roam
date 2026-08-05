/**
 * seed-criterion.mjs — Criterion Collection seeder
 * Film essays, director retrospectives, film history deep-dives.
 * Category: ARTS_CULTURE → FILM_TELEVISION
 * Multi-method: Sitemap → RSS → Wayback CDX
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.criterion.com",
  cacheFileName: "criterion.json",
  displayName: "🎬 Criterion Collection",
  feedUrl: null,
  articlePathRegex: /\/current\/posts\/\d+[-\/]|films\/\d+[-\/][a-z0-9-]+/i,
  siteSuffixRegex: /[–\-|]\s*The Criterion Collection\s*$/i,
  category_id: CATEGORY.ARTS_CULTURE,
  subcategory_id: SUBCATEGORY.FILM_TELEVISION,
  source: "criterion",
  seeder_score: 0.9,
});