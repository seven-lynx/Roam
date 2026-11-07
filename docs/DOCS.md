# Documentation Conventions

This guide describes how the `docs/` folder is organized, how to keep docs in sync with code, and what to do when adding or changing user-facing features.

## Where docs live

| Location | Purpose |
|---|---|
| `docs/INDEX.md` | Documentation entry point. Every doc in `docs/` should be linked from here. |
| `docs/*.md` | Cross-cutting reference docs (architecture, algorithm, API, badges, glossary, roadmap, store submission, visual recording). |
| `supabase/README.md` | Backend schema and migration working notes. |
| `web/README.md` | Next.js route map and UI spec. |
| `android/README.md` | Android app architecture, tech stack, settings, troubleshooting. |
| `extension/README.md` | Extension build instructions (for AMO reviewers). |
| `extension/DESIGN.md` | Extension technical design (MV3 constraints, file structure, storage, normalisation). |
| Root-level (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `RUNBOOK.md`, `COMMERCIAL_LICENSE.md`) | Governance, operations, and product overview. |

## Keeping docs in sync

1. **Add a "Last Updated" date** to the top of every doc you create or materially edit:
   ```markdown
   **Last Updated:** 2026-11-07
   ```
2. **Link new docs from `docs/INDEX.md`** — add to Quick links, the Reference docs table, or Component docs as appropriate.
3. **User-facing changes require a docs update.** If your PR changes behaviour a user or contributor can see (new edge function, new RPC, new setting, new migration that changes a table doc references), update the relevant doc in the same PR.
4. **Don't hardcode migration counts.** If you reference `supabase/migrations/`, avoid phrases like "(N at time of writing)" — they go stale immediately.
5. **Cross-reference, don't duplicate.** If a concept is defined in `GLOSSARY.md`, link to it rather than redefining it.

## Naming

- Use `SCREAMING_SNAKE_CASE.md` for reference docs (e.g. `BADGE_SYSTEM_ARCHITECTURE.md`, `STORE_SUBMISSION_GUIDE.md`).
- Use Title Case for guides and overviews (e.g. `ARCHITECTURE.md`, `ALGORITHM.md`, `VISUAL-RECORDING.md`).
- Keep filenames short and descriptive; avoid redundant words like `_GUIDE` unless it's a procedural how-to.

## Docs PR checklist

- [ ] New doc is linked from `docs/INDEX.md`
- [ ] "Last Updated" date added
- [ ] Related docs cross-linked where relevant
- [ ] No references to files that don't exist
- [ ] Claims verified against code (e.g. edge functions listed in `API.md` exist under `supabase/functions/`, level ranges match between `README.md` and `BADGE_SYSTEM_ARCHITECTURE.md`)