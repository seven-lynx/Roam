/**
 * seed-mysteriousuniverse.mjs — Mysterious Universe seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "mysteriousuniverse.org",
  cacheFileName: "mysteriousuniverse.json",
  displayName: "👽 Mysterious Universe",
  feedUrl: "https://mysteriousuniverse.org/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*mysteriousuniverse.org\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "mysteriousuniverse",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
