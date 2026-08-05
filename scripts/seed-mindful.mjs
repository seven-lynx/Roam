/**
 * seed-mindful.mjs — Mindful.org seeder
 * Mindfulness, meditation, and contemplative practice articles.
 * Category: MIND_BODY → MINDFULNESS_MEDITATION
 * Access: WordPress RSS feed
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.mindful.org",
  cacheFileName: "mindful.json",
  displayName: "🧘 Mindful.org",
  feedUrl: "https://www.mindful.org/feed/",
  articlePathRegex: /\/[a-z0-9-]+\/$/i,
  siteSuffixRegex: /\s*[-–—]\s*Mindful\s*$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.MINDFULNESS_MEDITATION,
  source: "mindful",
  seeder_score: 0.65,
  maxArticles: 1000,
  maxPages: 10,
});