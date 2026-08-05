/**
 * seed-psychology-today.mjs — Psychology Today seeder
 * Category: MIND_BODY → PSYCHOLOGY_BEHAVIOUR
 * Access: Wayback CDX (low maxPages to avoid CDX rate-limit)
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "psychologytoday.com",
  cacheFileName: "psychology-today.json",
  displayName: "🧠 Psychology Today",
  articlePathRegex: /\/(us|intl|za|ca|au|gb)\/blog\/[a-z0-9-]+\/\d+\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Psychology Today\s*$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR,
  source: "psychology-today",
  seeder_score: 0.8,
  maxPages: 5,
});