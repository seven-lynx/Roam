/**
 * seed-dbt-blog.mjs — dbt Labs seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DATABASES_DATA_ENGINEERING
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.getdbt.com",
  cacheFileName: "dbt-blog.json",
  displayName: "🔧 dbt Labs",
  feedUrl: "https://www.getdbt.com/blog/feed",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*getdbt.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  source: "dbt-lab",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
