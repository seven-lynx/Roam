/**
 * seed-crimereads.mjs — CrimeReads seeder
 * True crime & mystery content from a leading literary crime publication.
 * Category: WEIRD_WONDERFUL → TRUE_CRIME
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "crimereads.com",
  cacheFileName: "crimereads.json",
  displayName: "🔍 CrimeReads",
  feedUrl: "https://crimereads.com/feed/",
  articlePathRegex: /\/(\d{4}\/\d{2}|category|tag|feature|article)\//i,
  siteSuffixRegex: /\s*(?:- CrimeReads|…)\s*$/i,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.TRUE_CRIME_MYSTERIES,
  source: "crimereads",
  seeder_score: 0.65,
  maxArticles: 2000,
});