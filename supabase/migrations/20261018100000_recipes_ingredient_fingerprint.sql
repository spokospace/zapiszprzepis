-- Near-simultaneous duplicate fix — ingredient-set fingerprint.
--
-- Two shares of one dish added seconds apart carry different links and
-- different caption text (so recipes_source_url_uniq and
-- recipes_source_fingerprint_uniq both miss them), and the LLM names them
-- differently from the two captions ("Kanapki z jajkiem i szynką" vs
-- "Zapiekanka z szynką i serem" — the real #835/#836 pair), so the
-- title-anchored findSameRecipe misses them too. Their one shared signal is an
-- identical ingredient set. This column holds the SHA-256 of that set (distinct
-- normalized ingredient names, sorted — see ingredientFingerprint), so intake
-- can find a twin with one indexed equality lookup regardless of title.
--
-- NOT unique: two genuinely different recipes can legitimately share an
-- ingredient set, so this is a best-effort lookup key for the intake pre-check
-- and the offline content collapse, never a hard constraint. (A unique index
-- would hard-fail legitimate inserts; the intake has no retry keyed on it.)
--
-- The column is written by run-extract-recipe.ts on insert / refresh / gap-fill
-- and backfilled for existing rows by scripts/backfill-ingredient-fingerprints.ts.
-- Additive and idempotent; nothing reads the column until the app deploy that
-- writes it, so applying this ahead of the deploy changes nothing live.
--
-- Rollback:
--   drop index if exists public.recipes_ingredient_fingerprint_idx;
--   alter table public.recipes drop column if exists ingredient_fingerprint;

alter table public.recipes
  add column if not exists ingredient_fingerprint text;

create index if not exists recipes_ingredient_fingerprint_idx
  on public.recipes (ingredient_fingerprint)
  where ingredient_fingerprint is not null;
