/**
 * seed-cryptosrus.mjs — Cryptos R Us seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.cryptosrus.com",
  cacheFileName: "cryptosrus.json",
  displayName: "🔍 Cryptos R Us",
  feedUrl: "https://www.cryptosrus.com/feed/",
  articlePathRegex: /(crypto|podcast|news)/,
  siteSuffixRegex: \s*[-–—]\s*cryptosrus.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "cryptosrus",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
