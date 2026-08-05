/**
 * seed-nginx.mjs — NGINX seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.nginx.com",
  cacheFileName: "nginx.json",
  displayName: "🌐 NGINX",
  feedUrl: "https://www.nginx.com/blog/feed/",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*nginx.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "nginx",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
