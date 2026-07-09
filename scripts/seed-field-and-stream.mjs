/**
 * seed-field-and-stream.mjs — Field & Stream seeder
 * Hunting, fishing, conservation, and outdoor survival from America's oldest outdoor magazine.
 * Category: GAMES_HOBBIES → FISHING (primary) — also covers hunting/outdoor
 * Multi-method: RSS → Sitemap → Wayback → RSS Auto
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.fieldandstream.com",
  cacheFileName: "field-and-stream.json",
  displayName: "🦌 Field & Stream",
  feedUrl: "https://www.fieldandstream.com/feed/",
  articlePathRegex: /\/(fishing|hunting|survival|conservation|gear|guns|outdoor)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*[\|\-]\s*Field\s*&\s*Stream\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.FISHING,
  source: "field-and-stream",
  seeder_score: 0.8,
  maxArticles: 2000,
  maxPages: 25,
});