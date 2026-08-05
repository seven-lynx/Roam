/**
 * seed-genome-gov.mjs — NHGRI Aging seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.genome.gov",
  cacheFileName: "genome-gov.json",
  displayName: "🧬 NHGRI Aging",
  feedUrl: "https://www.genome.gov/feed/",
  articlePathRegex: /(news|research|about)/,
  siteSuffixRegex: \s*[-–—]\s*genome.gov\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "genome-gov",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
