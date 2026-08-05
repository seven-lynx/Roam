#!/usr/bin/env node
/**
 * ⚠ DEPRECATED — Use scripts/repair-badges-v2.mjs instead.
 * 
 * This script has known bugs:
 * - Missing break statements causing switch case fall-through
 * - Missing milestone badges (level-5, level-15, etc.)
 * - Broken XP update (sets xp_total: undefined)
 * - Many badges unevaluated (nomad-*, globetrotter-*, etc.)
 *
 * The replacement is: node scripts/repair-badges-v2.mjs
 */
console.error("⚠ This script is deprecated. Use: node scripts/repair-badges-v2.mjs");
process.exit(1);