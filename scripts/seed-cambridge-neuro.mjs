/**
 * seed-cambridge-neuro.mjs — Cambridge Neuroscience seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.neuroscience.cam.ac.uk",
  cacheFileName: "cambridge-neuro.json",
  displayName: "🎓 Cambridge Neuroscience",
  feedUrl: "https://www.neuroscience.cam.ac.uk/news/feed/",
  articlePathRegex: /(news|research|people)/,
  siteSuffixRegex: \s*[-–—]\s*neuroscience.cam.ac.uk\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "cambridge-neuro",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
