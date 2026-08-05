/**
 * seed-facesandvoices.mjs — Faces & Voices of Recovery seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "facesandvoicesofrecovery.org",
  cacheFileName: "facesandvoices.json",
  displayName: "🫂 Faces & Voices of Recovery",
  feedUrl: "https://facesandvoicesofrecovery.org/feed/",
  articlePathRegex: /(blog|news|resources)/,
  siteSuffixRegex: \s*[-–—]\s*facesandvoicesofrecovery.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "facesandvoices",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
