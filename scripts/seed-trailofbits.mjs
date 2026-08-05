/**
 * seed-trailofbits.mjs — Trail of Bits seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.CRYPTOGRAPHY_SECURITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "blog.trailofbits.com",
  cacheFileName: "trailofbits.json",
  displayName: "🛡 Trail of Bits",
  feedUrl: "https://blog.trailofbits.com/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*blog.trailofbits.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CRYPTOGRAPHY_SECURITY,
  source: "trailofbits",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
