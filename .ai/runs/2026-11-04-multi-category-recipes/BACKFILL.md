# Issue #689 (slice 2) — extra categories: LLM at extraction + backfill

Needs slice 1 (PR #692) merged AND its migration applied (see `APPLY.md`): the `extra_categories` column must exist.

## New extractions
`src/inngest/run-extract-recipe.ts` asks for `extra_categories` (0–2, "none" is the default) and cleans the answer with
`toExtraCategories` (closed list, never the primary, never `inne`, deduped, capped at 2). A refresh of a recipe with
`taxonomy_locked_at` set keeps category, tags and extras.

## Backfill (owner's go required; writes production data)
Run from the worktree with `.env.local` linked (`pnpm env:link`). Primary category is never touched; locked recipes and
recipes that already have extras are skipped, so it is re-runnable and resumable.

```bash
pnpm backfill:extra-categories --precision-check      # read-only, ~30 recipes spread over the categories; prints a review table
pnpm backfill:extra-categories                        # dry run over everything, prints, writes nothing
pnpm backfill:extra-categories --apply                # writes extras (only after the owner approved the table)
pnpm backfill:extra-categories --apply --after 1234   # resume after recipe id 1234
```

Options: `--limit N`, `--sample N` (precision-check size). `--precision-check` cannot be combined with `--apply`.

Order: precision check → owner reviews the table (are the extras right? too many?) → if too eager, tighten
`EXTRA_CATEGORIES_RULE` in `src/lib/extra-categories.ts` and repeat → `--apply`.
