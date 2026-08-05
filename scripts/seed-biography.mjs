/**
 * seed-biography.mjs — Biography.com seeder
 * Notable biographies, historical figures, celebrity profiles.
 * Category: PEOPLE_PLACES → BIOGRAPHIES_PROFILES
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "biography.com",
  cacheFileName: "biography.json",
  displayName: "📖 Biography.com",
  feedUrl: "https://www.biography.com/.rss/full/",
  articlePathRegex: /\/(scientists|political-figures|athletes|musicians|actors|historical-figures|scholars-educators|activists|artists|athletes)\/[a-z0-9-]+$/i,
  skipPaths: [
    /^\/cdn-cgi\//,
    /^\/about(\/|$)/,
    /^\/contact(\/|$)/,
    /^\/search(\/|$)/,
  ],
  siteSuffixRegex: /\s*[-–]\s*Biography\s*$/i,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.BIOGRAPHIES_PROFILES,
  source: "biography",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 10,
});