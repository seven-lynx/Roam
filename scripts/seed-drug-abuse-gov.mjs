/**
 * seed-drug-abuse-gov.mjs — DrugAbuse.gov seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.drugabuse.gov",
  cacheFileName: "drug-abuse-gov.json",
  displayName: "🧑‍⚕ DrugAbuse.gov",
  feedUrl: "https://www.drugabuse.gov/feed/",
  articlePathRegex: /(news-events|research-topics|publications)/,
  siteSuffixRegex: \s*[-–—]\s*drugabuse.gov\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "drugabuse",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
