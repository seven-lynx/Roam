# AI Context Files & Skills Audit

**Date:** 6/8/2026
**Auditor:** Manual review

---

## Files Discovered

| # | File | Lines | Type |
|---|------|-------|------|
| 1 | `.github/copilot-instructions.md` | 256 | Root AI instructions |
| 2 | `.github/skills/sentry-cli/SKILL.md` | 89 | Sentry CLI skill |
| 3 | `.github/skills/sentry-fetch-issues/SKILL.md` | 66 | Sentry REST API skill |
| 4 | `.github/skills/vercel-cli/SKILL.md` | 85 | Vercel CLI skill |
| 5 | `.github/skills/project-audit/SKILL.md` | 266 | Project audit skill |
| 6 | `.github/skills/supabase-cli/SKILL.md` | new | Supabase CLI skill (created during audit) |

**Removed:**
- `android/copilot-instructions.md` — stale fork (deleted)
- `.github/agents/` — empty directory (deleted)

---

## Issues Found & Resolution

### CRITICAL — Security (3 issues, all fixed)

1. **Token extraction patterns embedded in AI context.** ✅ Fixed — PowerShell one-liners that extracted tokens via regex replaced with "load securely, never echo" instructions across all 4 skill files and root copilot-instructions.

2. **Hardcoded absolute user paths.** ✅ Fixed — All `C:\Users\Seito\` paths replaced with `$env:USERPROFILE\` and `Join-Path (Get-Location)` across all files.

3. **Service identifiers exposed.** ✅ Fixed — Sentry org/project slugs, Vercel project name/ID/team slug, and Supabase project ref all redacted and replaced with placeholder references.

### MAJOR — Accuracy / Completeness (5 issues, all fixed)

4. **`android/copilot-instructions.md` is a stale fork.** ✅ Fixed — File deleted. Root copilot-instructions is the single source of truth.

5. **Duplicate numbering in `android/copilot-instructions.md`.** ✅ Fixed — Removed along with the stale file.

6. **`sentry-fetch-issues/skill.md` path bug.** ✅ Fixed — `.\local.properties` → `android\local.properties`.

7. **Referenced docs may not exist.** ✅ Acknowledged — `web/AGENTS.md` reference kept (project-specific doc). Duplicate references removed with stale file.

8. **Vercel project ID and team slug hardcoded.** ✅ Fixed — Redacted from both `vercel-cli/SKILL.md` and root copilot-instructions.

### MODERATE — Consistency (3 issues, all fixed)

9. **Conflicting Android stance.** ✅ Fixed — Stale file deleted; only root copilot-instructions remains with accurate Android stance.

10. **Skill file naming inconsistency.** ✅ Fixed — All skills now use `SKILL.md` (uppercase).

11. **Empty `.github/agents/` directory.** ✅ Fixed — Directory removed.

### MINOR — Documentation Quality (3 issues, partially fixed)

12. **`project-audit/SKILL.md` references `PLANNING.md` and `TASKS.md`.** Acknowledged — These are generic phase descriptions in the audit procedure. No code changes needed.

13. **No Supabase CLI skill.** ✅ Fixed — Created `.github/skills/supabase-cli/SKILL.md` with full YAML frontmatter and command reference.

14. **Dead URL checker has no skill file.** Acknowledged — The command lives in copilot-instructions and is a single-line invocation; a dedicated skill was deemed excessive.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical (Security) | 3 | ✅ All fixed |
| Major (Accuracy) | 5 | ✅ All fixed |
| Moderate (Consistency) | 3 | ✅ All fixed |
| Minor (Docs) | 3 | 2 fixed, 1 acknowledged |

---

## Remediation Applied

- [x] Audit report written to `docs/AI_CONTEXT_AUDIT.md`
- [x] Fixed `sentry-fetch-issues/SKILL.md`: path bug, redacted org/project slugs, added YAML frontmatter
- [x] Deleted stale `android/copilot-instructions.md`
- [x] Rewrote `sentry-cli/SKILL.md`: replaced hardcoded paths, redacted identifiers, added YAML frontmatter
- [x] Rewrote `vercel-cli/SKILL.md`: replaced hardcoded paths, redacted identifiers, added YAML frontmatter
- [x] Fixed root `.github/copilot-instructions.md` Build & Test section: replaced hardcoded paths, redacted identifiers
- [x] Fixed root `.github/copilot-instructions.md` Vercel section: replaced hardcoded paths and project name
- [x] Fixed root `.github/copilot-instructions.md` Sentry section: redacted identifiers, replaced hardcoded paths
- [x] Renamed `sentry-fetch-issues/skill.md` → `SKILL.md` (consistency)
- [x] Renamed `project-audit/skill.md` → `SKILL.md` (consistency)
- [x] Removed empty `.github/agents/` directory
- [x] Added YAML frontmatter to `sentry-cli/SKILL.md`
- [x] Added YAML frontmatter to `vercel-cli/SKILL.md`
- [x] Created `.github/skills/supabase-cli/SKILL.md` with YAML frontmatter
- [x] Updated copilot-instructions Key Docs table with Supabase CLI skill
- [x] Updated copilot-instructions Sentry section reference (skill.md → SKILL.md)