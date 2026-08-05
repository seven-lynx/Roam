/**
 * seed-kubernetes.mjs — Kubernetes seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "kubernetes.io",
  cacheFileName: "kubernetes.json",
  displayName: "☸ Kubernetes",
  feedUrl: "https://kubernetes.io/feed.xml",
  articlePathRegex: /(blog|docs|case-studies)/,
  siteSuffixRegex: \s*[-–—]\s*kubernetes.io\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "kubernetes",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
