/**
 * seed-cognitivesciencesociety.mjs — Cognitive Science Society seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.cognitivesciencesociety.org",
  cacheFileName: "cognitivesciencesociety.json",
  displayName: "📚 Cognitive Science Society",
  feedUrl: "https://www.cognitivesciencesociety.org/feed/",
  articlePathRegex: /(cognitive-science|news|conference)/,
  siteSuffixRegex: \s*[-–—]\s*cognitivesciencesociety.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "cognitivesciencesociety",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
