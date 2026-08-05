/**
 * seed-linuxfoundation.mjs — Linux Foundation seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.linuxfoundation.org",
  cacheFileName: "linuxfoundation.json",
  displayName: "🐧 Linux Foundation",
  feedUrl: "https://www.linuxfoundation.org/feed/",
  articlePathRegex: /(blog|press|resources)/,
  siteSuffixRegex: \s*[-–—]\s*linuxfoundation.org\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "linuxfoundation",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
