/**
 * seed-docker-blog.mjs — Docker seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.docker.com",
  cacheFileName: "docker-blog.json",
  displayName: "🐳 Docker",
  feedUrl: "https://www.docker.com/blog/feed/",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*docker.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "docker",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
