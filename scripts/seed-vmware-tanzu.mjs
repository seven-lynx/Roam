/**
 * seed-vmware-tanzu.mjs — VMware Tanzu seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "tanzu.vmware.com",
  cacheFileName: "vmware-tanzu.json",
  displayName: "🖥 VMware Tanzu",
  feedUrl: "https://tanzu.vmware.com/content/feed",
  articlePathRegex: /(blog|developer|content)/,
  siteSuffixRegex: \s*[-–—]\s*tanzu.vmware.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "vmware-tanzu",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
