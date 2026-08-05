/**
 * seed-mma.mjs — MMA & Combat Sports seeder
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "mmajunkie.usatoday.com",
  cacheFileName: "mma.json",
  displayName: "🥊 MMA Junkie",
  articlePathRegex: /\/(news|features|analysis|fighters|rankings)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*MMA\s*Junkie$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS,
  source: "mma",
  maxPages: 20,
});