/**
 * seed-nia-nih.mjs — NIA NIH seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nia.nih.gov",
  cacheFileName: "nia-nih.json",
  displayName: "🧬 NIA NIH",
  feedUrl: "https://www.nia.nih.gov/rss.xml",
  articlePathRegex: /(news|health|research)/,
  siteSuffixRegex: \s*[-–—]\s*nia.nih.gov\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "nia-nih",
  seeder_score: 0.9,
  maxArticles: 500,
  maxPages: 20,
});
