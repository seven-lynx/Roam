/**
 * seed-spotify-eng.mjs — Spotify Engineering seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "engineering.atspotify.com",
  cacheFileName: "spotify-eng.json",
  displayName: "🎵 Spotify Engineering",
  feedUrl: "https://engineering.atspotify.com/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*engineering.atspotify.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "spotify-eng",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
