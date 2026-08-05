/**
 * seed-deadspin.mjs — Deadspin seeder
 * Sports meets culture, weird sports stories, irreverent takes.
 * Category: GAMES_HOBBIES → SPORTS_ATHLETICS
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "deadspin.com",
  cacheFileName: "deadspin.json",
  displayName: "⚾ Deadspin",
  articlePathRegex: /\/(\d+\/[a-z0-9-]+|feature|news|analysis)\/?$/i,
  siteSuffixRegex: /\s*\|\s*Deadspin\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS,
  source: "deadspin",
  seeder_score: 0.65,
  maxPages: 20,
});