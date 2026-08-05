/**
 * seed-digitalocean.mjs — DigitalOcean seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.digitalocean.com",
  cacheFileName: "digitalocean.json",
  displayName: "🌊 DigitalOcean",
  feedUrl: "https://www.digitalocean.com/blog/feed",
  articlePathRegex: /(blog|community)/,
  siteSuffixRegex: \s*[-–—]\s*digitalocean.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "digitalocean",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
