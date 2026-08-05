/**
 * seed-google-cloud-blog.mjs — Google Cloud seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "cloud.google.com",
  cacheFileName: "google-cloud-blog.json",
  displayName: "☁ Google Cloud",
  feedUrl: "https://cloud.google.com/blog/feeds/developers-practitioners.xml",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*cloud.google.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "google-cloud",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
