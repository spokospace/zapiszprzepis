# Execution plan: recipe-structured-data-triage

**Goal:** Record the per-field schema.org/Recipe JSON-LD decisions in code — a complete doc comment plus matching tests — emitting **no** new field, so the Google Search Console suggestions stop being re-triaged and no future edit silently starts emitting invented data.

**Scope:** `src/lib/recipe-json-ld.ts` (the doc comment above `buildRecipeJsonLd`) and `src/lib/recipe-json-ld.test.ts` (assertions). Output bytes are unchanged.

**Non-goals:** emitting `recipeCuisine`, `nutrition`, `video`, `aggregateRating`/`review`, or per-step `image`/`video`; creating a cuisine source (LLM extraction / DB column / backfill); any DB, extraction-pipeline, UI, or page change.

**Source doc:** .ai/specs/2026-10-24-recipe-structured-data-triage.md (ships via spec PR #512; Refs #512, Closes #493)

**Risks:** none to emitted output (no field added or removed from what ships today). The only risk is wording drift between the doc comment and the tests — mitigated by landing both in one PR.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Record per-field decisions

- [x] 1.1 Document every non-emitted suggested field in the `buildRecipeJsonLd` doc comment — e4e45f8
- [x] 1.2 Add tests asserting `recipeCuisine`, `video`, and per-step `image`/`video` are never emitted (keep the existing never-invents rating/nutrition test) — e4e45f8
