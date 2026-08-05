/**
 * seed-mens-grooming.mjs — Men's Grooming, Style & Self-Improvement
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "artofmanliness.com",
  cacheFileName: "mens-grooming.json",
  displayName: "💈 Art of Manliness",
  articlePathRegex: /\/(style|grooming|health-fitness|people|skills|character|career)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*\|\s*The\s*Art\s*of\s*Manliness$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.PERSONAL_DEVELOPMENT,
  source: "mens-grooming",
  maxPages: 20,
});