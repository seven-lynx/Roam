/**
 * seed-drugpolicy.mjs — Drug Policy Alliance seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "drugpolicy.org",
  cacheFileName: "drugpolicy.json",
  displayName: "⚖ Drug Policy Alliance",
  feedUrl: "https://drugpolicy.org/feed/",
  articlePathRegex: /(news|issues|resources)/,
  siteSuffixRegex: \s*[-–—]\s*drugpolicy.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "drugpolicy",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
