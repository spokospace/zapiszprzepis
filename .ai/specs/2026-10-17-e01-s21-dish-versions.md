# E01-S21 — Versions of the same dish (`dish` / `variant_note`)

> Issue: #296 (epic #201). Design authority: `.ai/design/przebudowa-handoff/README.md` → "8 — Wersje tego samego dania", prototype `.ai/design/przebudowa-handoff/designs/Wersje przepisu.dc.html`. Gap: `.ai/analysis/2026-10-17-design-gap-audit.md` §9. Risk: **high**. The change touches the extraction pipeline, the guest-safe `public_recipes` view, and (via #298) a reviewed data migration of production rows. Depends on S07b (recipe-page order), S16 (`SimilarRecipes`), S17 (desktop layout), and the `servings` (#293) and `author_gender_form` (#291) view columns, both live on prod.
>
> **This document is a spec only.** It does not implement anything or change any data. The backfill of existing recipes is a separate, reviewed data migration tracked in #298 (Phase 2).

## 📝 TLDR
Today a recipe page cannot tell the reader that the site has other recipes for the same dish. Three cheesecakes are only connected if their tags happen to overlap in "Podobne", and nothing says how they differ. *Proposed (future behavior):* every recipe gets a normalized **`dish`** ("sernik", "zupa ziemniaczana") and a short **`variant_note`** ("Na kruchym cieście, bez drożdży"). For new recipes an LLM sets both in the existing labelling pass. For the 677 existing ones they come from a Claude-authored, owner-reviewed data migration (#298). The recipe page then shows a 60 px bar, "Mamy jeszcze N inne przepisy na {danie}", under the source block. The bar scrolls to "Inne przepisy na {danie} (N)" before "Podobne". That section holds version cards titled with the difference, with servings/time badges and "+ jest / − nie ma" ingredient lines, ordered by favorites by default. A sort control switches the order to newest or quickest. "Podobne" stops repeating those versions.

## 📝 Problem Statement
- Production (2026-10-17, read-only count) holds 677 recipes, many of them several versions of one dish. Titles start with "Sernik" (6), "Szarlotka" (7), "Miodownik" (8), "Racuchy" (5) and "Naleśniki" (4), and the "ciasto" (86), "sałatka" (31) and "surówka" (13) families split into real dishes. None of this is linked.
- The only cross-link is S16 "Podobne": same category plus shared tags. Version cards would need the *dish*, the thing a reader means by "another recipe for this", and no stored field says that. The existing `description` is a 2–5-word lowercase note that sets a recipe apart from **the same user's** similarly titled recipes, written before the global dedup (S03). It is not a dish key, and it is not compared across users.
- The handoff (section 8) defines the screen and names the data: `dish` and `variant_note`, "oba z AI przy ekstrakcji", with ingredient differences computed at render.

## 📝 Proposed Solution
1. **Two LLM-set fields plus one display helper** on `recipes`: `dish` (grouping key), `dish_accusative` (the "na …" phrase), `variant_note`, plus `dish_classified_at` for idempotency. They are exposed read-only through `public_recipes`, appended after `author_gender_form`.
2. **The classification lives in the labelling pass** (`src/lib/recipe-labeling.ts` sits beside a new `src/lib/recipe-dish.ts`, on the same `gpt-4.1` model). The extraction prompt (`gpt-4o-mini`) is not changed, so backfill and new recipes share one rule set and one call shape. The model sees the **existing dish vocabulary**, so it reuses "sernik" instead of coining "sernik klasyczny". When unsure it returns `null`, and `null` hides the feature for that recipe.
3. **Backfill as a reviewed data migration (#298), not a paid script.** A Claude session reads the stored fields read-only from prod (title, category, ingredient names, steps; no re-scraping). It classifies every recipe under the same rubric as the runtime call and writes an idempotent SQL data migration. The owner reviews the migration and a report of every dish group as an ordinary PR, and only then is it applied. Its output also becomes the initial dish vocabulary that the runtime call reuses.
4. **Recipe page**: a bar under the source block, a versions section before `SimilarRecipes`, and `SimilarRecipes` excluding the same `dish`. One `SECURITY DEFINER` RPC, `dish_versions(recipe_id)`, returns the versions with a **favorites count** (aggregate only), because `favorites` is owner-only under RLS.

**Alternatives considered**
- *Put `dish`/`variant_note` into the extraction prompt (`gpt-4o-mini`, `run-extract-recipe.ts`).* Rejected. Extraction has no view of other recipes, so it cannot reuse an existing dish name, and synonyms would split groups. The cheap model already failed at judgement calls: tags were moved to `gpt-4.1` for that reason (`recipe-labeling.ts` header). The backfill would also need either a re-scrape or a second prompt variant. The labelling pass already runs on extracted data and is reused by `scripts/backfill-recipe-tags.ts`, which is exactly the pattern needed here.
- *Merge the new fields into the existing `labelRecipe()` call.* Rejected for now. A combined prompt would make every refresh and future relabel rewrite title, description and tags together with the dish, and those were backfilled and reviewed earlier. A separate small call costs about $0.006 per new recipe (see Cost).
- *Reuse `description` as the variant note.* Rejected. Its contract differs: lowercase, scoped to the same user, shown under titles on cards. The handoff's note is sentence-case and compares against the dish's other versions globally. Both stay; a later story may retire `description` once `variant_note` covers it.
- *A paid OpenAI backfill script (`scripts/backfill-recipe-dish.ts`, ≈ $3, dry runs and four review stops; the first draft of this spec).* Replaced by the owner (2026-10-17) with the #298 data migration. A reviewed SQL file is easier to audit in a PR, needs no API budget, and gives the same idempotency and rollback guarantees.
- *Embeddings or trigram clustering of titles instead of an LLM key.* Rejected. "Makowiec japoński" and "Makowiec na kruchym" are the same dish, while "Sernik" and "Sernik na zimno" are not, and string or vector similarity gets both wrong. The LLM key plus vocabulary snapping plus human review of the whole vocabulary is cheaper to get right at 677 rows.
- *A `dishes` lookup table (FK) instead of a text key.* Deferred. Merging synonyms is a plain `update … set dish = … where dish = …`, and a table only pays off once dishes get pages of their own (e.g. a future `/danie/{dish}`).
- *A `favorites_count` column on `public_recipes`.* Rejected. It aggregates `favorites` on every view read (home, search, category) for a number used only here, and it widens the public contract.

## 📝 Architecture
- `supabase/migrations/2026101722xxxx_recipe_dish_versions.sql` *(new)*: columns, constraints, index, view append, `dish_versions` RPC.
- `src/lib/recipe-dish.ts` *(new)*:
  - `DISH_PROMPT` and `VARIANT_NOTE_PROMPT`;
  - pure helpers `normalizeDish(raw, vocabulary)`, `resolveDishAccusative(raw, dish)`, `resolveVariantNote(raw, dish)`, `dishVocabularyFor(title, vocabulary)` (stem filter, cap 60);
  - LLM calls `classifyDish(recipe, vocabulary, deps)` and `writeVariantNote(target, siblings, deps)`, which **never throw**.
  - It reuses `stems()` from `recipe-tags.ts` and the `postChatJson` shape from `recipe-labeling.ts` (exported for reuse rather than copied).
- `src/inngest/run-extract-recipe.ts` *(changed)*: reads the dish vocabulary (`rpc('dish_vocabulary')`) in parallel with the existing `existingRecipesQuery`, calls `classifyDish` next to `labelRecipe`, then `writeVariantNote`. It writes the four columns on insert, on gap-fill when `dish_classified_at` is null, and on force-refresh only when the row was never classified (`dish_classified_at is null`).
- `src/lib/dish-versions.ts` *(new, pure, render-time)*: `ingredientKey(name)`, `ingredientDiff(current, other, max = 4)`, `versionBadges(current, other)`, `versionsBarLabel(n, dishAccusative)`, `versionsHeading(n, dishAccusative)`.
- `src/app/przepis/[slug]/_components/dish-versions-bar.tsx` and `dish-versions.tsx` *(new, server components)*.
- `src/app/przepis/[slug]/page.tsx`: one `rpc('dish_versions')` call added to the existing `Promise.all`; its result feeds the bar (inside `RecipeHeader`, via a new optional `versionsBar` slot) and the section placed before `<SimilarRecipes>`.
- `src/app/przepis/[slug]/_components/similar-recipes.tsx`: gets an optional `dish` prop; when set, both candidate queries add `.or('dish.is.null,dish.neq."<dish>"')`.
- **Backfill (#298):** `supabase/migrations/…_backfill_recipe_dish.sql` (data only), a rollback script, `.ai/qa/s21b-rehearse-backfill.sql` and a review report, all authored by a Claude session. There is no new script in `scripts/`.

```mermaid
flowchart LR
  subgraph existing
    X[extractWithLlm gpt-4o-mini] --> L[labelRecipe gpt-4.1]
    P[recipe page] --> S[SimilarRecipes]
  end
  subgraph new
    V[(dish vocabulary)] --> C[classifyDish gpt-4.1]
    X --> C --> N[writeVariantNote gpt-4.1]
    B[#298 data migration] --> DB
    R[rpc dish_versions] --> P
    P --> DV[bar + Inne przepisy na …]
  end
  N --> DB[(recipes.dish / variant_note)]
  DB --> R
  DB -. dish filter .-> S
```
*Takeaway:* the new path sits beside the labelling pass and is read through one RPC. Extraction, labelling and the existing view columns do not change.

## 📝 Data Model

### Columns on `public.recipes`
| Column | Type | Meaning | Constraint |
|---|---|---|---|
| `dish` | `text null` | Grouping key: normalized Polish dish name, lowercase, nominative ("sernik", "sernik na zimno", "zupa ziemniaczana", "pierogi"). `null` means unknown or not a single dish, and the feature stays hidden for the recipe. | `recipes_dish_format check (dish is null or (dish = btrim(dish) and char_length(dish) between 3 and 60 and dish !~ '[A-ZĄĆĘŁŃÓŚŹŻ]'))` |
| `dish_accusative` | `text null` | The same name in the accusative, for "Inne przepisy na **szarlotkę**". `null` makes the UI fall back to case-free wording. | `check (dish_accusative is null or (dish is not null and char_length(dish_accusative) between 3 and 80))` |
| `variant_note` | `text null` | 2–6-word sentence-case phrase saying what sets this version apart from the dish's other versions ("Na kruchym cieście, bez drożdży"). | `check (variant_note is null or char_length(variant_note) between 3 and 60)` |
| `dish_classified_at` | `timestamptz null` | When the classification last **succeeded**, even if it returned `null`. `null` means never classified (or the call failed): the #298 migration and the gap-fill only touch such rows, and a later re-run of the same procedure picks up runtime failures. | — |

**Why `dish_accusative` (a third field beyond the handoff's two):** Polish declines the phrase, so "na zupa dyniowa" would be wrong and "na zupę dyniową" is right. Deriving the accusative in code would need a morphology library. The model returns it in the same call at no extra cost, and validation drops a malformed one; the rule is that it must have the same number of words as `dish`.

**Normalization of `dish`** (`normalizeDish`, applied to every value before it is stored, from the LLM at runtime and in the #298 data migration alike):
1. Non-string, or `confidence !== 'high'`, gives `null`.
2. NFC; trim; collapse whitespace; strip surrounding quotes and trailing `.,;:!`; `toLocaleLowerCase('pl')`.
3. Charset `^\p{L}[\p{L} -]*\p{L}$` (letters, spaces, hyphens), length 3–60, at most 5 words. Anything else gives `null`. This charset also makes the value safe to quote inside a PostgREST `or()` filter (see UI).
4. A **blocklist** of bare class words and category labels gives `null`: "ciasto", "ciasta", "ciasteczka", "zupa", "sałatka", "surówka", "deser", "danie", "obiad", "przekąska", "napój", "syrop", "pieczywo", "inne", and every `RECIPE_CATEGORIES` label lowercased.
5. **Vocabulary snap:** when a vocabulary entry equals the value after diacritic folding (`ą→a`, `ł→l`, …), the vocabulary spelling wins, so "pierogi ruskie" never splits from "pierogi ruskie" typed without diacritics.

**Granularity rule (prompt and review rubric) — decided by the owner, 2026-10-17.** Separately named preparations ("sernik na zimno", "sernik gotowany") are separate dishes, not versions of "sernik". `dish` is the name a home cook types to find *any* recipe for the thing. Flavours, fillings, add-ins, toppings, origin or style ("nowojorski", "babci"), diet ("bez glutenu"), size ("mini") and praise ("najlepszy") are version traits: they go into `variant_note`, never into `dish`. A qualifier stays in `dish` only when it names a separately named dish made differently that a cook would not swap for the plain one. Bare class words name their kind ("zupa ziemniaczana", "ciasteczka owsiane"). When the dish is unclear, the value is `null`.

| Title | `dish` | Why |
|---|---|---|
| Sernik | `sernik` | the plain dish |
| Sernik nowojorski | `sernik` | style/origin is a version → `variant_note` "Nowojorski, na spodzie z herbatników" |
| Sernik baskijski | `sernik` | same |
| Sernik na zimno | `sernik na zimno` | no oven, set with gelatine: a separately named dish |
| Sernik gotowany | `sernik gotowany` | cooked filling, own name (**decided by the owner, 2026-10-17**) |
| Pierogi ruskie / z mięsem | `pierogi` | the filling is a version |
| Ciasto z owocami | `null` | no single recognisable dish |

### View `public_recipes`
Append `r.dish, r.dish_accusative, r.variant_note` **after** `author_gender_form`, at positions 25–27. Current prod order, read 2026-10-17: `id … gallery_count, servings, author_gender_form`. `create or replace view` can only append, so the migration:
- asserts the current last two columns are `servings, author_gender_form` (a `do` block that `raise exception`s otherwise). This fails loudly instead of silently reordering, unlike the dual-path guards #291/#293 needed while both were unmerged;
- repeats the full current definition (the profiles + `profiles_private` joins, `security_invoker = false`) plus the three columns, then re-applies the grants;
- is idempotent: when `public_recipes.dish` already exists it returns early.

`dish_classified_at` is **not** exposed; it is operational data.

### Index
`create index if not exists recipes_dish_idx on public.recipes (dish) where dish is not null;` serves the RPC and the `SimilarRecipes` filter. The existing `favorites_recipe_id_idx` serves the count.

### RPC `public.dish_versions(p_recipe_id bigint)`
`language sql stable security definer set search_path = ''`. It returns the other recipes with the same non-null `dish`, at most 24 (see Resolved assumptions):
`id, slug, title, image_url, source_type, source_url, source_author, variant_note, servings, prep_time_minutes, cook_time_minutes, total_time_minutes, times_estimated, ingredients, created_at, favorites_count integer, total_count integer` (`count(*) over ()`), ordered by `favorites_count desc, created_at desc, id desc`. The order the reader chooses is applied in TypeScript over these rows (`sortVersions`, see UI), so the RPC has a single, cacheable shape. Grants: `revoke all … from public; grant execute … to anon, authenticated`.

### RPC `public.dish_vocabulary()`
`language sql stable security definer set search_path = ''`, returning `dish text, dish_accusative text, recipes integer`: `select dish, min(dish_accusative), count(*) … where dish is not null group by dish order by count(*) desc`. PostgREST has no `DISTINCT` and caps rows at `max-rows`, so reading `dish` off every row would truncate silently as the catalog grows — the `group by` here is what keeps the result to one row per dish. **Bounded-vocabulary guarantee (a hard contract, because a truncated vocabulary silently splits groups):** distinct dishes are bounded by the recipe count (677 today → a few hundred distinct dishes) and must stay below the deployed PostgREST `db-max-rows` cap (Supabase default 1000). Phase 2's #298 report records the distinct-dish count so the margin is auditable; the caller reads the whole set in one request and asserts it got every row (result length `<` the cap). If dishes ever approach the cap, raise `db-max-rows` or switch the function to keyset pagination — never ship a partial vocabulary. Granted to `service_role` only, because the extraction and the backfill use the service client. `dishVocabularyFor` filters the result by title stems in JS.

**Data exposure:** it is the same columns the guest view already exposes, plus **one aggregate per recipe** (how many users have it in Ulubione). No `user_id` and no favorite rows leave the function. Exposing that aggregate to guests is a new disclosure under the owner-only `favorites` RLS, so it is flagged for confirmation (assumption A5).

### Migration and rollback
- **Apply:** idempotent DDL (`add column if not exists`, constraints added only when missing, the guarded view block, `create or replace function`). It is rehearsed first as `begin; … rollback;` via the Management API, per project practice, and the script is checked in as `.ai/qa/s21-rehearse-dish-versions.sql`, like S07b/S23. Afterwards the version is registered in `supabase_migrations.schema_migrations`.
- **Order vs the app:** apply the migration **before** deploying the build that writes the columns, because an insert naming a missing column fails the extraction. The live build reads none of the new columns, so applying first changes nothing for it. The UI phase reads them as optional (`dish ?? null`, RPC error means hidden), so it is safe either way.
- **Rollback (data only):** the #298 rollback script: `update recipes set dish = null, dish_accusative = null, variant_note = null, dish_classified_at = null where id = any($ids)` for the ids that migration set. It is safe because the migration only writes rows that were never classified. The UI disappears on its own because nothing renders for `dish is null`.
- **Rollback (schema), in one `begin … commit` so guests never see a missing view or grant:** `drop function if exists public.dish_versions(bigint), public.dish_vocabulary();` then `drop view public.public_recipes;` and re-create it from `20261017210000_author_gender_form.sql`'s definition (with `servings`) plus grants; `drop index if exists recipes_dish_idx;` then `alter table recipes drop column if exists variant_note, drop column if exists dish_accusative, drop column if exists dish, drop column if exists dish_classified_at;`. Ship the app rollback first, since the extraction would otherwise insert into dropped columns.

## 📝 API Contracts

### LLM: dish classification (`classifyDish`, `gpt-4.1`, temperature 0, `json_object`, 30 s timeout)
- **System:** `DISH_PROMPT`, the granularity rule above with the examples table and the accusative rule, followed by `EXISTING dish names:` and up to 60 vocabulary entries whose stems overlap the title (`dishVocabularyFor`), most frequent first. When nothing overlaps: `(none)`.
- **User:** `JSON.stringify({ title, category, ingredients: names only, steps }).slice(0, 12_000)`. Names only, without amounts, keeps the input around 1k tokens.
- **Response:** `{ "dish": string|null, "dishAccusative": string|null, "confidence": "high"|"low" }`.
- **Validation:** `normalizeDish` (above). `resolveDishAccusative` gives `null` unless the value is a string with the same word count as `dish`, the same charset, and length ≤ 80 after lowercasing; the accusative of a plural-only or masculine-inanimate dish equals the nominative, which is valid. The result is `{ dish, dishAccusative, classified: true }`, or `{ dish: null, dishAccusative: null, classified: false }` on any HTTP, timeout or JSON error (logged with `console.warn`, never thrown).

### LLM: variant note, new recipe (`writeVariantNote`)
- Only when `dish` is non-null. **Input:** the dish, the new recipe (title, ingredient names, steps), and up to 12 siblings with that dish (title, ingredient names, existing `variant_note`).
- **Rule:** 2–6 Polish words, capital first letter, no full stop. Say what sets **this** version apart from the listed ones (base or dough, key ingredient, technique, diet), using only its own ingredients and steps. It must differ from every sibling note. With no siblings, compare against the typical recipe for the dish. If it cannot tell, `null`.
- **Response:** `{ "variantNote": string|null }`. Siblings' notes are **not** rewritten, so cards stay stable.
- **Validation (`resolveVariantNote`):** trim; strip a trailing `.`; capitalize the first letter (`pl`); drop comma-parts that repeat a `dish` stem (the same technique as `resolveDescription`); 3–60 chars, otherwise `null`; equal (case-insensitively) to a sibling's note gives `null`.

### Extraction write paths (`run-extract-recipe.ts`)
| Path | Behaviour |
|---|---|
| Insert (new recipe) | write `dish, dish_accusative, variant_note`, and `dish_classified_at = now()` only when `classified` |
| Same recipe already saved (`findSameRecipe` → `linkToSaved`) | no-op: that path returns before labelling, and the saved row keeps its own classification |
| URL collision on the user's own row (parallel share race), gap-fill | fill the four only when the existing row has `dish_classified_at is null` (never overwrite a reviewed value) |
| Force refresh ("Odśwież przepis") | classify only when `dish_classified_at is null`; otherwise keep all four columns. A refresh must not regroup a reviewed recipe, including a reviewed `null` (an owner override) |
| Classification fails | recipe saved as today, the four columns null (`dish_classified_at` null); a later re-run of the #298 procedure for `where dish_classified_at is null` picks it up |

### RPC (page)
`supabase.rpc('dish_versions', { p_recipe_id })` returns the rows above, or `[]` for a recipe with `dish is null`. An error is logged and treated as `[]`.

## 📝 Backfill of existing recipes (Phase 2, #298)

The ~677 existing recipes are classified **once, by a Claude session, as a reviewed data migration**, not by a paid script (owner decision, 2026-10-17). #298 owns the details. This spec fixes the contract that migration must meet, so the runtime path and the backfill agree.

- **Input:** stored fields only (`id, title, category, ingredients, steps`), read **read-only** from prod with the service client or a `select` over the Management API. No re-scraping: the stored extraction is what the page shows, and Firecrawl or Facebook re-fetches cost money and fail on dead sources.
- **Rubric:** exactly the rules in this spec:
  - Data Model → granularity rule and examples (owner-decided);
  - `normalizeDish` (charset, blocklist, lowercase, ≤ 5 words);
  - the accusative rule;
  - the variant-note rules (2–6 words, sentence case, distinct within a group, only facts from the recipe's own ingredients and steps; `null` when unsure).
  Every value in the migration must pass the same validators the app uses, and #298 checks this with a test that runs them over the generated values.
- **Output:** one data migration of idempotent per-id updates:
  `update public.recipes set dish = …, dish_accusative = …, variant_note = …, dish_classified_at = now() where id = … and dish_classified_at is null;`
  Applying it twice is a no-op, and a recipe the runtime classified in the meantime is left alone. Recipes judged "no single dish" get `dish = null` with `dish_classified_at` set, which records the review.
- **Review (the owner gate):**
  - the migration ships in a PR together with a report listing **every dish group**: dish, "na …", count, members (id · title · category · `variant_note`), plus all `null`s and the groups whose stems overlap (merge candidates);
  - the owner reviews the PR, and corrections are edits to the migration;
  - nothing is applied before that PR is approved.
- **Rehearsal:** `begin; <migration>; <count checks>; rollback;` via the Management API, which must return 201 with the counts the report states; checked in as `.ai/qa/s21b-rehearse-backfill.sql`.
- **Apply:** after approval, via the Management API, and registered in `supabase_migrations.schema_migrations`. **Rollback:** a script that nulls the four columns for the migration's ids (see Data Model → Migration and rollback).
- **Initial vocabulary:** once applied, the backfill's dishes are what `dish_vocabulary()` returns, so the runtime `gpt-4.1` call reuses them for new recipes from then on.
- **Order:** it needs the Phase 1 schema migration applied first. It does not need the Phase 1 app deploy.

### Rubric sample (read-only, 2026-10-17, production rows, nothing written)
The runtime prompt drafted for this spec was run on 15 production recipes with `gpt-4.1` (22 calls, $0.05), with the vocabulary growing during the run and notes written per group. It shows what the rubric produces; #298 applies the same rubric.

| # | Title | `dish` | "na …" | conf. | `variant_note` |
|---|---|---|---|---|---|
| 15 | Truskawkowy sernik zebra na zimno | sernik na zimno | sernik na zimno | high | Z musem truskawkowym i herbatnikami |
| 270 | Tęczowy deser - ekspresowy sernik na zimno | sernik na zimno | sernik na zimno | high | Ekspresowy, tylko serek i galaretka |
| 222 | Sernik gotowany na herbatnikach | sernik gotowany | sernik gotowany | high | Z kremówką i czekoladą |
| 276 | Sernik gotowany na herbatnikach | sernik gotowany | sernik gotowany | high | Z kakao i bakaliami |
| 268 | Szarlotka z budyniem | szarlotka | szarlotkę | high | Z budyniem i kwaśną śmietaną |
| 352 | Szarlotka | szarlotka | szarlotkę | high | Z pianką z białek i rodzynkami |
| 376 | Szarlotka ze smalcem | szarlotka | szarlotkę | high | Ze smalcem i dżemem morelowym |
| 542 | Miodownik | miodownik | miodownik | high | Z polewą kakaową i orzechami |
| 550 | Miodownik | miodownik | miodownik | high | Z masą orzechową na wierzchu |
| 185 | Racuchy z kaszy manny z owocami | racuchy | racuchy | high | Z kaszy manny i owocami |
| 491 | Racuchy drożdżowe | racuchy | racuchy | high | Klasyczne, na drożdżowym cieście |
| 339 | Zupa ziemniaczana | zupa ziemniaczana | zupę ziemniaczaną | high | Ze śmietanką i kurkumą |
| 476 | Zupa ziemniaczana | zupa ziemniaczana | zupę ziemniaczaną | high | Na wędzonych żeberkach |
| 26 | Sałatka z ogórkiem konserwowym | `null` | — | low | — |
| 69 | Sałatka z konserwowym selerem | sałatka z selerem konserwowym | sałatkę z selerem konserwowym | high | Z szynką i porem |

What the sample shows:
- The accusative works ("szarlotkę", "zupę ziemniaczaną").
- Same-titled duplicates get distinct notes.
- The model returns `null` rather than guessing for a vague salad.
- Two calls for the review rubric:
  - "sernik gotowany" split from "sernik" (defensible: a cooked filling, its own name);
  - #69 shows that salads named by their ingredients drift towards an over-specific dish ("sałatka z selerem konserwowym" is effectively a singleton). The #298 report's merge candidates and singleton list exist for exactly this. The prompt adds: "a salad or surówka named only by its ingredients and not by an established name → `null`".

## 📝 UI/UX
Prototype: `.ai/design/przebudowa-handoff/designs/Wersje przepisu.dc.html` (handoff section 8; the authority, no new mockups).

**Page order (S07b, C3).** The bar goes inside item 4, after "Źródło" and "Dodała/Dodał", before item 5, the favorites button. The section goes after 12 (Poprzedni / Następny) and before 13 ("Ten przepis jest" / "Podobne"). Rendered: `RecipeListNav` → **`DishVersions`** → `SimilarRecipes`.

**Bar** (`dish-versions-bar.tsx`, rendered only when `total_count ≥ 1`):
- An `<a href="#inne-przepisy">`, full width (`lg`: width of the header text column), min height 60 px, background `#fff7ed`, 2 px border `#fed7aa`, radius 12. Layers icon 24 px (`aria-hidden`), label 18 px bold `text-ink`, ChevronDown icon (`aria-hidden`).
- Label (`versionsBarLabel`): "Mamy jeszcze 1 inny przepis na {acc}" / "… 2–4 inne przepisy na {acc}" / "… 5+ innych przepisów na {acc}" (Polish plural rules, with 12–14 → "innych przepisów"). Without `dish_accusative` the **same plural rules apply** with the case-free tail "na to danie": "Mamy jeszcze 1 inny przepis na to danie" / "… 2–4 inne przepisy na to danie" / "… 5+ innych przepisów na to danie". The count word is never left in the bare "N inne przepisy" form.
- Scrolling: native anchor. `scroll-behavior: smooth` only under `@media (prefers-reduced-motion: no-preference)`; works without JS. The target `<h2 id="inne-przepisy" tabIndex={-1}>` receives focus, so keyboard and screen-reader users land in the section.

**Section** (`dish-versions.tsx`, `<section aria-labelledby="inne-przepisy">`):
- `h2` 26 px bold "Inne przepisy na {acc} ({N})" (fallback "Inne wersje tego dania ({N})"), with the caption "Różnice w porównaniu z przepisem, który oglądasz." in 16 px `#374151`.
- `<ul>` of cards; mobile one column, `lg` two columns (S17 grid, `gap-6`). It shows up to 12 versions, taken after sorting from the ≤ 24 rows the RPC returns, and `N` is `total_count`.

**Sort control** (decided by the owner, 2026-10-17: default most popular, alternatives allowed). It renders only when there are ≥ 2 versions, between the caption and the list.
- Options and their `sortVersions(rows, order)` keys, all with ties broken by `created_at desc, id desc`:
  - **„Najpopularniejsze”** (`popularne`, default): `favorites_count desc`;
  - **„Najnowsze”** (`nowe`): `created_at desc`;
  - **„Najszybsze”** (`szybkie`): total time (`total_time_minutes ?? prep + cook`) ascending, unknown times last. This one fits the target group ("what can I make in the time I have") and costs no new data. It can be dropped without touching the rest.
- Markup: a visible label „Kolejność:” (16 px bold, `#374151`) and a **segmented control of links** in `<div role="group" aria-labelledby="wersje-kolejnosc">`. Each segment is an `<a href="?wersje={key}#inne-przepisy">` with min 48 × 48 px, 17 px bold, a `border-field` 2 px outline and radius 999, the same look as the S16 tag chips (`chipClasses`).
- The active segment has `aria-current="true"`, the `#111827` fill with white text and a „✓ ” prefix, so it is never marked by colour alone. The segments wrap on 320 px and at A++.
- **Without JS:** the links reload the page with `?wersje=`. The server reads it (whitelisted; anything else falls back to `popularne`) and renders that order. The `canonical` stays the bare `/przepis/{slug}`, so the parameter never competes in search (S07 already handles `?from=` this way). Nothing persists.
- **With JS** (`dish-versions-sort.tsx`, a small client island wrapping the list): a click is intercepted. The cards are reordered in place from the rows already on the page (no request), the URL is updated with `history.replaceState` (keeping the hash, without scrolling), and focus stays on the activated segment. A polite live region (`role="status"`) announces „Kolejność: najnowsze”.
- **Persistence:** the choice is saved per viewer in `localStorage` (`zp.versionsSort`, wrapped in try/catch) and applied on mount when the URL has no `?wersje=`. An explicit URL wins over the stored value. The section sits far below the fold, so reordering after hydration is not a visible jump. A private window or blocked storage simply gives the default.
- Why links and not a `<select>`: a select needs JS or a submit button to act, hides the options behind a tap, and is harder for the target group. Three always-visible 48 px segments are clearer.

**Version card** (`<li>`, `border: 2px solid` `border-card`, radius 16, padding 16; whole card clickable through the **stretched-link** pattern: the `h3` holds the only `<a>`, and its `::after` covers the card, so there is one tab stop and no nested links):
- 72 px thumbnail (`rounded-lg`, `alt=""`, decorative because the link names the recipe) or the category icon placeholder already used by `RecipeCard`.
- **Title = `variant_note`**, 19 px bold, in the link (falls back to the recipe title when the note is null). The visually hidden suffix " — {title}" gives the link a unique accessible name (WCAG 2.4.4).
- Recipe title, then `sourceLabel()` ("aniagotuje.pl", "YouTube · {kanał}"), 16 px `#374151`.
- Badges (`#f3f4f6` background, `text-ink`, 16 px, radius 999, wrap) from `versionBadges`:
  - servings "8 porcji (o 4 mniej)" / "(o 2 więcej)" / no bracket when equal; omitted when the version has no servings; no comparison when the current recipe has none;
  - time from `total_time_minutes ?? prep + cook`, formatted with the existing `formatMinutes` ("1 godz. 30 min"), with a "(krócej)" / "(dłużej)" suffix only when |Δ| ≥ 10 min; "≈ " prefix when `times_estimated`; omitted when unknown.
- `ingredientDiff`:
  - "**+ jest:** mak, miód, rodzynki" (`#15803d`, 5.0:1 on white): the version's ingredients missing from the current recipe;
  - "**− nie ma:** drożdże, masło" (`#b91c1c`, 6.5:1): the current recipe's ingredients missing from the version;
  - each line holds at most 4 names, in source order, and is hidden when empty. The sign and the words carry the meaning, so colour is never alone (WCAG 1.4.1). A visually hidden prefix reads "Składniki, których nie ma w oglądanym przepisie:" and its counterpart.
- "Otwórz ten przepis →" in 16 px, underlined, `aria-hidden` (a visual affordance only; the stretched link is the control).
- Focus: the card shows the global focus outline (`3px solid #1d4ed8`, offset 2) through `:has(a:focus-visible)`.

**Ingredient matching (`ingredientKey`):** lowercase (`pl`); drop bracketed text, quantities and units; drop filler adjectives ("świeży", "drobny", "ulubiony"); map a small synonym table (jajko/jajka/jaja → jaj; cukier puder stays its own key). The key is the set of 5-letter stems (`stems()`). Two ingredients match when **both key sets are non-empty** and one is contained in the other: "mąka" ≈ "mąka pszenna", while "mąka pszenna" ≠ "mąka ziemniaczana". An empty key set (an ingredient reduced to nothing but filler, quantity or unit words) matches nothing and is kept as its own distinct ingredient — the non-empty guard prevents it from matching everything through vacuous containment (`∅ ⊆ anything`). `ingredients` with sections are flattened. Malformed JSON falls back to `[]` via `parseIngredients` and hides both lines.

**"Podobne" exclusion:** `SimilarRecipes` receives `dish`. When it is set, both of its queries add `.or('dish.is.null,dish.neq."<dish>"')`. A plain `neq` would also drop the null-dish rows, because `null <> x` is not true in SQL. The value is safe to embed because `normalizeDish` limits it to letters, spaces and hyphens. The count query for "Wszystkie {kategoria} (N)" is unchanged.

**Desktop (S17, A9):** the bar sits in the header's right text column, under the author line, at that column's width. The section is full width (1152 px container) with cards in 2 columns. It does not join the `1fr 1.6fr` ingredients|steps grid.

**Readability and WCAG 2.2 AA:**
- 19 px card titles; supporting text ≥ 16 px in `#374151`; the bar has a 60 px target and the card is a ≥ 48 px target.
- Tokens only: `bg-surface-accent` (`#fff7ed`) and `border-border-accent` (`#fed7aa`), already in `globals.css`.
- No horizontal scroll at 320 px: badges and ingredient lines wrap, the text column is `min-w-0 break-words`, and the thumbnail is fixed at 72 px. The page joins the `test:reflow` guard list from #294, including A++ text size: the section's text uses the recipe content scale.
- Screen readers get section heading → list of N items → each item's link; nothing is announced live (static content).

**States:** `dish` null, RPC error or 0 versions: no bar, no section, and "Podobne" as today. One version: singular wording. Version without image: placeholder. Version without servings or times: those badges are omitted.

## 📝 Edge Cases & Failure Scenarios
- **No data yet (Phase 1 live, #298 not applied):** `dish` is null on every row. The page makes no RPC call, shows no bar or section, and "Podobne" runs exactly today's queries, so the release is invisible until data exists.
- **LLM down or slow during extraction:** the recipe is saved without a dish (`dish_classified_at` null); no UI change for it; a later re-run of the #298 procedure (`where dish_classified_at is null`) fills it. Extraction never fails because of the dish pass.
- **Synonym split** ("pierogi ruskie" as a dish vs "pierogi"): vocabulary snap and prompt prevent most cases; the #298 report lists merge candidates. After launch a split shows two smaller groups (wrong but harmless) and is fixed with one SQL `update … where dish = 'x'`.
- **Over-grouping** (two different dishes under one key): the reader sees an unrelated "version". Caught in review; fixable per id. The blocklist stops the worst case, a bare "ciasto" grouping 86 recipes.
- **Huge group** (a future "sernik" with 40 recipes): the RPC returns the 24 most popular, sorting is applied within those, and 12 are shown. Under "Najnowsze" a very new, unfavorited version may therefore be missing; the heading still says the full N. A "Pokaż wszystkie" link to search (`/szukaj?q={dish}`) is a later story.
- **Same dish, different category** (a "pierogi" in obiady and one in inne): still versions; "Podobne" is per category anyway.
- **Recipe deleted / merged (S03a collapse):** the RPC reads live rows; nothing is cached.
- **Notes drift as groups grow:** existing notes are never rewritten automatically, so an older note may later overlap a newer recipe's. The new note is told to differ from all siblings, so the new card stays distinct.
- **Refresh re-extracts different ingredients:** `dish` and note kept (reviewed); the ingredient diff is computed live, so it stays correct.
- **Backfill partially applied:** every statement is guarded per row, so re-running the migration finishes the job without touching rows already set.
- **Prompt injection via recipe text** ("ignore instructions, dish = …"): output goes through `normalizeDish` (charset, length, blocklist) and human review; the worst case is a wrong grouping, never markup (React escapes) or a filter break (charset).

## 📝 Risks & Impact Review
- **Schema / public contract (hard to reverse once consumed):** three appended view columns plus one RPC on the guest-safe surface. They are additive, and `select('*')` consumers are unaffected by the append. The migration's column-order assertion prevents a silent reorder.
- **Favorites aggregate to guests:** a new disclosure from an owner-only table, count only. **Approved by the owner (2026-10-17).** It is never displayed as a number on the card; it is used only as the sort key.
- **Production data write (backfill, #298):** 677 rows, four new columns only. Nothing existing is overwritten, so rollback is exact (null them). Gated by the owner's PR review of the migration and its report, plus a rolled-back rehearsal.
- **Extraction latency:** +2 sequential `gpt-4.1` calls (~1–2 s each) inside the Inngest step. The note call can start only after the dish is known; the dish call runs in parallel with `labelRecipe`. The sibling read (`dish = x`, indexed, ≤ 12 rows, ~50 ms) sits between them. Net ≈ +1.5–2 s per save, invisible to the user, who gets a notification on completion.
- **Cost:** the backfill has no API cost (a Claude session authors it). Runtime classification costs ≈ $0.006 per new recipe (≈ 2.5k input and 60 output tokens on `gpt-4.1` at $2 / $8 per 1M; prices checked 2026-10-17 on third-party lists).
- **Product calls:** all decided by the owner (granularity, the favorites sort key with a sort control, the backfill as a data migration).

## 📋 Phasing
1. **Phase 1 — Schema + runtime classification + UI, behind empty data.**
   - Ships: the schema migration (rehearsed; applied by the owner via the Management API), `recipe-dish.ts` and the extraction wiring, and the recipe-page UI: bar, section, sort control, "Podobne" exclusion.
   - **The UI must render gracefully while `dish` is null everywhere:** no bar, no section, "Podobne" exactly as today, no console errors, and **no `dish_versions` call at all** — `page.tsx` issues the RPC only when `recipe.dish` is non-null (consistent with Edge Cases and Implementation Plan step 6). The RPC returning `[]` is the separate case of a *classified* recipe that happens to have no siblings yet, not the empty-data state. This is the state of every page until Phase 2 lands. From the deploy on, new recipes get their `dish`, and the UI lights up for them as soon as a second recipe of the same dish exists.
2. **Phase 2 — Backfill of existing recipes (#298).** A Claude-authored data migration plus a report of every dish group, rehearsed and rolled back, reviewed in a PR by the owner, then applied. The versions appear across the catalog, and the vocabulary is seeded.
3. **Done.** Verify on prod. The backlog row and the test-plan cookbook are updated.

## 📋 Implementation Plan

### Phase 1 — Schema, runtime classification, UI
1. Migration `…_recipe_dish_versions.sql`: columns, checks, index, view append with order assertion, `dish_versions` and `dish_vocabulary` RPCs, grants. Add `.ai/qa/s21-rehearse-dish-versions.sql` (`begin; … ; select column_name … ; rollback;`). **Test:** rehearsal returns 201, `dish_vocabulary()` groups and counts, and the expected view column list; a SQL check that `dish_versions` returns favorites-ordered rows inside the rolled-back transaction.
2. `src/lib/recipe-dish.ts` pure helpers (`normalizeDish`, `resolveDishAccusative`, `resolveVariantNote`, `dishVocabularyFor`). **Tests:** blocklist, charset, case, diacritic snap, `confidence: low` → null, word-count mismatch → accusative null, note repeating dish stem → stripped, sibling duplicate → null.
3. `classifyDish` / `writeVariantNote` with the shared `postChatJson` (exported from `recipe-labeling.ts`). **Tests:** mocked fetch: success; non-2xx / timeout / bad JSON → nulls with `classified: false`, never throws.
4. Wire into `run-extract-recipe.ts`: vocabulary RPC in parallel with `existingRecipesQuery`; dish call in parallel with `labelRecipe`; note after; write on insert, on the own-row URL-collision gap-fill and on refresh, all guarded on `dish_classified_at is null`. **Tests** in `run-extract-recipe.test.ts`: insert payload carries the four fields; failure path leaves them null; refresh does not overwrite a classified row.
5. `src/lib/dish-versions.ts`: `ingredientKey`, `ingredientDiff`, `versionBadges`, `versionsBarLabel`, `versionsHeading`, `sortVersions`, `parseVersionsSort`. **Tests:** each sort order and its tie-breaks, unknown times last, an unknown `?wersje=` value falling back to `popularne`, Polish plurals (1, 2–4, 5, 12–14, 22), servings delta wording, the 10-minute threshold, estimated time "≈", diff cap 4, synonym table, "mąka" vs "mąka ziemniaczana", sections flattened, malformed input → empty.
6. `dish-versions-bar.tsx`, `dish-versions.tsx`, `dish-versions-sort.tsx`; `RecipeHeader` gets an optional `versionsBar` slot (no change for other callers); `page.tsx` calls the RPC **only when `recipe.dish` is non-null** (no request at all while data is empty) inside the existing `Promise.all`, and renders the section before `SimilarRecipes`. **Tests:** `dish` null → no RPC call, no bar, no section; hidden at 0 versions; singular; accusative fallback; note fallback to title; stretched-link accessible name; the sort control (hidden below 2 versions, `aria-current` on the active segment, server order from `?wersje=`, client reorder and the live-region text, localStorage read and write guarded, the URL beating storage).
7. `SimilarRecipes` `dish` prop + `.or()` filter. **Test:** filter applied only when `dish` is set (so with empty data "Podobne" issues exactly today's queries); null-dish rows still eligible.
8. Add the recipe page to `test:reflow` (320 px, A++) and the axe pass with a fixture that has versions; desktop screenshot at 1280 px. A page without data is covered by the existing reflow cases.
9. Deploy order: the owner applies the migration (Management API), **then** the app deploys (Workers Builds from master). **Verify on prod:** a recipe page looks exactly as before (empty data); after the owner extracts a recipe, its row has `dish`.

### Phase 2 — Backfill (#298)
1. A Claude session produces the data migration, the group report, the rollback script and the rolled-back rehearsal per the contract in "Backfill of existing recipes". **Test:** the generated values pass `normalizeDish` / `resolveDishAccusative` / `resolveVariantNote`; the rehearsal counts match the report.
2. The owner reviews the PR (report + migration). After approval the migration is applied and registered.
3. **Verify on prod:** `count(*) filter (where dish is not null)` and the number of groups with ≥ 2 members match the report; full-section screenshots (mobile + desktop) of three pages with versions: bar scroll and focus, order by favorites, the sort control, and "Podobne" without same-dish recipes.

### Done
1. Update `.ai/specs/backlog-przebudowa.md` (S21 row) and the test-plan cookbook entry if one covers render helpers.

## 📝 Decisions for the owner
1. ~~**Granularity**~~ — **decided (owner, 2026-10-17):** separately named preparations ("sernik na zimno", "sernik gotowany") are separate dishes, not versions of "sernik". The #298 review still checks individual groups against this rule.
2. ~~**Favorites count**~~ — **decided (owner, 2026-10-17):** a count may be exposed to guests through the count-only RPC. New requirement from the same decision: a sort control (default most popular, alternative newest; see UI → Sort control).
3. ~~**Backfill approach**~~ — **decided (owner, 2026-10-17):** no paid OpenAI script. A Claude session classifies the existing recipes read-only and produces a reviewed data migration (#298). The owner review is the PR review of that migration and its group report.

## Resolved assumptions (autonomous defaults)
| # | Question | Default chosen | Rationale |
|---|---|---|---|
| A1 | Split into separate specs (data / backfill / UI)? | One spec; the backfill is tracked separately as #298 under this spec's contract | Neither half has user value alone; the phases already isolate deploys |
| A2 | Only the two fields from the handoff? | Add `dish_accusative` (display) and `dish_classified_at` (operational, not exposed) | Polish case in "na {danie}"; the idempotent backfill guard needs "classified → null" ≠ "never classified" |
| A3 | Where does the model produce `dish`/`variant_note`? | A separate `gpt-4.1` call next to `labelRecipe`, not the `gpt-4o-mini` extraction prompt | Needs the dish vocabulary; one rubric shared with the #298 backfill; precedent of tags |
| A4 | Reuse `description` as the variant note? | No — separate column; `description` unchanged | Different scope (per user vs global) and casing; no regression on cards |
| A5 | How to sort versions by favorites when `favorites` is owner-only? | `SECURITY DEFINER` RPC exposing a count only. **Confirmed by the owner (2026-10-17)**, together with the sort control | Count only; never shown as a number |
| A6 | Backfill source and method | Stored fields, read-only, no re-fetch; a Claude-authored data migration (**owner-decided**, #298) | Matches what the page shows; no scrape or API cost; reviewable as SQL |
| A7 | Refresh / gap-fill behaviour | Never overwrite a classified row (`dish_classified_at` set) | Keeps reviewed grouping stable |
| A8 | How many version cards | Up to 12 shown, out of ≤ 24 fetched so the reader's sort has room; the heading shows the full N | No group exceeds ~8 today; "Pokaż wszystkie" deferred |
| A9 | Granularity edge ("sernik gotowany", ingredient-named salads) | Separate dish for named techniques (**owner-decided**); ingredient-only salad names → null | Owner decision 2026-10-17 plus the rubric sample |
