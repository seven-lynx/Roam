/**
 * seed-hagerty.mjs — Hagerty seeder
 * Classic car valuations, restoration guides, automotive history.
 * Category: GAMES_HOBBIES → COLLECTING
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "hagerty.com",
  cacheFileName: "hagerty.json",
  displayName: "🏛️ Hagerty",
  articlePathRegex: /\/(media|articles|news|stories|buying-guides|ownership|restoration|auctions|events)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*Hagerty\s*(?:Media)?\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COLLECTING,
  source: "hagerty",
  seeder_score: 0.7,
  maxPages: 20,
});