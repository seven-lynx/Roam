/**
 * seed-acefitness.mjs — ACE Fitness seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.acefitness.org",
  cacheFileName: "acefitness.json",
  displayName: "💪 ACE Fitness",
  feedUrl: "https://www.acefitness.org/education-and-resources/professional/rss/",
  articlePathRegex: /(education-and-resources|blog|about)/,
  siteSuffixRegex: \s*[-–—]\s*acefitness.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "acefitness",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
