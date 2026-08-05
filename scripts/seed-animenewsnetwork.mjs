/**
 * seed-animenewsnetwork.mjs — Anime News Network seeder
 * Category: ARTS_CULTURE → ANIME_MANGA
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "animenewsnetwork.com",
  cacheFileName: "animenewsnetwork.json",
  displayName: "🗾 Anime News Network",
  feedUrl: "https://www.animenewsnetwork.com/news/rss.xml",
  articlePathRegex: /\/(news|feature|interest|encyclopedia|review)\//i,
  siteSuffixRegex: /\s*(?:- Anime News Network)\s*$/i,
  category_id: CATEGORY.ARTS_CULTURE,
  subcategory_id: SUBCATEGORY.ANIME_MANGA,
  source: "animenewsnetwork",
  seeder_score: 0.6,
  maxArticles: 2000,
});