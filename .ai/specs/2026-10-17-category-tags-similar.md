# E01-S16 — Category with tag chips + similar recipes

> Backlog: `.ai/specs/backlog-przebudowa.md` (E01-S16, screen 6). Issue: #218. Risk: **medium** (public read-only UI on two existing routes, no schema change, no migration). Depends on S01 (tokens, chip primitive) and S03 (one recipe per link). Extends S09's `/przepisy/{kategoria}` (`.ai/specs/2026-10-17-menu-drawer.md`) and fills S07's similar-recipes slot (`.ai/specs/2026-10-17-recipe-page-rebuild.md`).

## 📝 TLDR
Today `/przepisy/{kategoria}` (S09) is a flat grid of the 48 newest recipes in a category, and the recipe page shows its tags as chips in the header that link to the owner-only `/recipes?tag=` (plain text for a guest). *Proposed (future behavior):* the category page gets **tag chips** (`?tag=a,b`, AND logic, counters, first 8 + "Pokaż wszystkie (N)"), an **`aria-live` summary** with "× Wyczyść", and simple paging. The bottom of the recipe page gets **"Ten przepis jest"** (its tags as links to the category filtered by that tag) and **"Podobne"**: 3–4 recipes from the same category ranked by shared tags, plus "Wszystkie przepisy: {Kategoria} (N) →". `RECIPE_TAGS` gains eight leading-ingredient tags (`kokosowe`, `owsiane` and six more the data asks for).

## 📝 Problem Statement
- A big category is unbrowsable: `ciasta` has 203 recipes, `obiady` 160, and the page shows the newest 48 with no way to narrow down or to reach the rest.
- Tags exist on 572 of 677 recipes (production, 2026-10-17), but nothing public uses them: header chips link to `/recipes?tag=`, which is owner-only and bounces a guest to `/login`.
- A recipe page is a dead end: no path to "more like this" other than the list bar's Poprzedni/Następny.
- The closed tag list has no tag for several leading ingredients that recur in titles (coconut, oats, nuts, lemon, honey, poppy seed, pumpkin, potatoes).

## 📝 Proposed Solution
1. **Tag filter on the category page.** The URL carries the selection: `/przepisy/{kategoria}?tag=kruche,czekoladowe`. Unknown and duplicate values are dropped, so a hand-edited URL never reaches a query. Each chip is a **link** that toggles its tag in the URL. That makes the filter shareable, lets it work before hydration and keeps Back/Forward working. Selection is AND: PostgREST `contains('tags', selected)`.
2. **Facet counters.** One light query reads `id, tags` for the whole category (≤ ~200 rows today). A pure function derives the counters and the chip order from it: for each tag, how many recipes in the *current* selection also carry it, i.e. how many results tapping that chip would leave. Unselected tags with 0 are hidden (they would lead to an empty page). Selected tags always show. Order: selected first, then count desc, then `RECIPE_TAGS` order.
3. **Card query.** A second query, run in parallel, reads the page of cards: `contains` + `order(created_at desc, id desc)` + `range`, with `count: 'exact'` for the summary and paging. Page size stays 48. `?strona=N` adds "← Nowsze" / "Starsze →" links that keep the tags.
4. **Recipe page, bottom.** A self-loading async server component `<SimilarRecipes>` replaces S07's placeholder comment. That way `page.tsx` changes by one import and one line (S06 and S14 edit the same file in parallel). It renders:
   - "Ten przepis jest" + the recipe's tags as chip links → `categoryPath(category, { tags: [tag] })`;
   - "Podobne": candidates from the same category sharing ≥ 1 tag (`overlaps`), ranked by shared-tag count, then newest. If there are fewer than 4, newest recipes from the category fill the rest. At most 4 are shown, and the section is hidden at 0;
   - "Wszystkie przepisy: {Kategoria} (N) →", with N the category total.
5. **Header tags move down.** The header's tag chips are removed: the AC puts tags at the bottom ("dół"), and two chip rows of the same tags is noise. The owner's `/recipes?tag=` filter keeps working; it just loses this entry point, and the new links are public.
6. **`RECIPE_TAGS`**: add `kokosowe`, `owsiane`, `orzechowe`, `cytrynowe`, `miodowe`, `makowe`, `dyniowe`, `ziemniaczane` (each with an LLM hint and an unambiguous title pattern). Title counts on production: 9 / 10 / 13 / 13 / 14 / 14 / 18 / 19.

**Alternatives considered**
- *Chips as client-side `<button>`s with `router.push`* (the owner `/recipes` pattern) — rejected: does nothing before hydration, and buttons that navigate are the wrong role. The existing `Chip` primitive's look is reused through an exported class builder instead.
- *A second category route* (`/kategoria/…`, or a `/szukaj` facet) — rejected: S09 already fixed `/przepisy/{kategoria}` as the public URL.
- *OR logic* — rejected by the AC (AND), and AND is what "narrow down" means to the target group.
- *Counting with one `count` query per tag* — rejected: 34 round trips. Reading the category's `id, tags` once is cheaper at this volume (see Risks for when to revisit).
- *Reuse `src/app/components/category-filter.tsx`* (named in the issue's Files) — rejected: that is the owner list's **category** button row on `/recipes`, a different control. The tag filter gets its own component next to the route.

## 📝 Architecture
- `src/lib/category-tags.ts` *(new, pure)* — `parseTagParam(raw)`, `tagFacets(rows, selected)`, `rankSimilar(tags, candidates, fill, limit)`.
- `src/lib/routes.ts` — `categoryPath(category, opts?: { tags?: string[]; page?: number })`. With no options it is unchanged, so existing callers (menu, home tiles, list bar) keep working.
- `src/lib/recipe-tags.ts` — eight new entries + title patterns.
- `src/lib/recipe-list-context.ts` — adds the `kategoria` list key, so a recipe opened from a filtered category shows "← {Kategoria} · N z M" over that filtered list.
- `src/app/components/ui/chip.tsx` — exports `chipClasses(selected)`; `Chip` uses it (no visual change).
- `src/app/przepisy/[kategoria]/page.tsx` — parses `tag` / `strona`, runs the facet + card queries in parallel, renders filter, summary, grid, paging, `RecipeListSnapshot`.
- `src/app/przepisy/[kategoria]/_components/tag-filter.tsx` *(new, client)* — chip links; "Pokaż wszystkie (N)" / "Pokaż mniej" toggle (`aria-expanded`). Without JS the extra chips stay hidden and the toggle is inert, while the first 8 still work.
- `src/app/przepis/[slug]/_components/similar-recipes.tsx` *(new, async server)* — loads and renders the bottom section; logs and renders nothing on query failure.
- `src/app/przepis/[slug]/page.tsx` — one import + `<SimilarRecipes recipe={…} />` in place of the S16 comment.
- `src/app/przepis/[slug]/_components/recipe-header.tsx` — the tag `<ul>` is removed. The `isAuthenticated` prop stays, because the gallery/author logic may need it and removing it would touch the call site S06/S14 edit.

## 📝 Data Model
No schema change, no migration, no data change. Reads only `public_recipes` (guest-safe view, already exposes `tags`). Recipes extracted before this story never get the eight new tags retroactively (re-extraction or a refresh assigns them). A title-based backfill is a separate, owner-gated data change (follow-up).

## 📝 API Contracts
```ts
// src/lib/category-tags.ts
export function parseTagParam(raw: string | string[] | undefined): RecipeTag[]   // valid, deduped, list order kept, max MAX_FILTER_TAGS (6)
export interface TagFacet { value: RecipeTag; label: string; count: number; selected: boolean }
export function tagFacets(rows: { tags: string[] | null }[], selected: RecipeTag[]): TagFacet[]
export function rankSimilar<T extends { id: number; tags: string[] | null }>(
  tags: string[], candidates: T[], fill: T[], limit?: number /* 4 */
): T[]

// src/lib/routes.ts
export function categoryPath(category: string, opts?: { tags?: readonly string[]; page?: number }): string
// '/przepisy/ciasta', '/przepisy/ciasta?tag=kruche,czekoladowe', '/przepisy/ciasta?tag=kruche&strona=2'
```
`?tag=` is comma-separated (also accepts repeated `tag` params). `?strona=` is an integer ≥ 1; anything else is page 1, and a page past the end shows the empty-results state with a link to page 1.

## 📝 UI/UX
Variant 1c style, 1a structure. Tokens only (`bg-ink`, `text-ink-soft`, `border-border-card-2`, `text-action-text`), no raw hexes. Mockup: `assets/category-tags-similar/mockup-01-category.html`, `mockup-02-similar.html`.

**Category page `/przepisy/{kategoria}`**
- `h1` category label (unchanged).
- **Filter** (`<nav aria-label="Filtruj według tagów">`, only when the category has any tags): `h2` "Tagi" (visually small), wrapping chip row, no horizontal scroll. Chip = `Chip` look: ≥ 48 px, pill, 2 px border, 17 px bold. Selected = `bg-ink` (#111827) + white + "✓ " (the ✓ is `aria-hidden`; sr-only ", wybrany"). Count after the label, with an sr-only unit ("12 przepisów"). First 8 chips, then a `Pokaż wszystkie ({N})` button (outline, ≥ 48 px, `aria-expanded`, `aria-controls`). Selected chips are always within the first 8 because they sort first.
- **Summary** (`<p role="status" aria-live="polite">`): "{N} {przepis/przepisy/przepisów}" plus, with a selection, " z tagami: kruche, czekoladowe". Next to it (outside the live region), the "× Wyczyść" link → `categoryPath(category)`, ≥ 48 px, underlined, shown only with a selection. Next.js keeps the region mounted across soft navigation, so a chip tap announces the new count.
- **Grid** as today (`RecipeCard`, now `from="kategoria"`). Empty with a selection: "Brak przepisów z tymi tagami." + "× Wyczyść". Empty category: today's empty state.
- **Paging** below the grid, only when needed: "← Nowsze" / "Strona 2 z 5" / "Starsze →", links ≥ 48 px.
- `<title>`: "{Kategoria} · ZapiszPrzepis"; canonical = bare `categoryPath(category)` (filtered variants do not compete).

**Recipe page, bottom (before the owner's refresh/delete row)**
- `section aria-labelledby`: `h2` "Ten przepis jest" (26 px, like "Wideo"), a chip-link row of its tags (unselected chip look). Hidden when the recipe has no tags.
- `h2` "Podobne": a 2-column grid (3 at `sm`) of up to 4 `RecipeCard`s (no `from`, so the list bar falls back to the category). Hidden at 0.
- "Wszystkie przepisy: {Kategoria} ({N}) →" link (underlined, `text-action-text`, ≥ 48 px), N omitted when the count failed. It shows even without similar recipes, as long as the category has other recipes.

## 📝 Edge Cases & Failure Scenarios
- **Tag query fails** → page throws to the route error boundary (same as today's listing). **Facet query fails** → logged, the filter is hidden, cards still render.
- **Invalid tags in URL** (`?tag=xyz,kruche,kruche`) → `[kruche]`; all invalid → unfiltered.
- **Selected tag with 0 results** (shared old link) → chip still shown selected, empty-results state with "× Wyczyść".
- **More than 6 tags in the URL** → first 6 kept (a recipe carries at most 6, so 7+ can never match).
- **Recipe with no tags** → no "Ten przepis jest". "Podobne" falls back to the newest in the category. Single-recipe category → section hidden.
- **Similar query fails** → logged, the whole bottom section renders nothing; the page is unaffected.
- **A new tag before any recipe has it** → no chip (count 0), no error.
- **Large text scale** → chips wrap. The grid stays 2 columns on mobile, as on `/ulubione`.

## 📝 Risks & Impact Review
- **Query cost:** the category page does 2 queries (facets: `id, tags` for the category; cards: one page). The recipe page adds 2 small ones (overlaps candidates limited to 50, fill limited to 5) plus a head count. No index on `tags`/`category`: fine at ~700 recipes. Revisit (GIN on `tags`, `(category, created_at desc)`) past ~5k recipes or if the category page p95 grows. Noted, not done here (owner-gated migration).
- **Header change** is user-visible: tags move from the top of the recipe page to the bottom. Reversible.
- **New tags** change the LLM prompt (`LLM_TAGS` is derived from the list). The model may now pick e.g. `orzechowe` over `owocowe`. Bounded by `MAX_TAGS` and the closed list; covered by the existing tag tests.
- **Parallel sessions:** `page.tsx` (S06/S14) gets a 2-line diff; `recipe-list-context.ts` `LIST_KEYS` also grows in S05 (trivial merge); `chip.tsx` gets an additive export.

## 📝 Resolved assumptions (autonomous defaults)
| # | Question | Default applied | Rationale |
|---|----------|-----------------|-----------|
| Q1 | Which "other missing" tags? | `orzechowe`, `cytrynowe`, `miodowe`, `makowe`, `dyniowe`, `ziemniaczane` (+ the two named) | The most frequent leading-ingredient words in production titles not covered by an existing tag; fruit-specific words (`jabłkowe`) stay under `owocowe`. |
| Q2 | Counter semantics | Results left after adding that tag to the current selection (facet count) | The only number that predicts what a tap does under AND logic; zero-result chips hidden. |
| Q3 | Header tag chips | Removed; tags render only in "Ten przepis jest" | AC places tags at the bottom; avoids two identical rows; header links were owner-only anyway. |
| Q4 | Paging | `?strona=N`, 48 per page, prev/next links | S09 left paging to S16; without it 155 of 203 `ciasta` are unreachable. |
| Q5 | Label for "Wszystkie {kategoria}" | "Wszystkie przepisy: {Kategoria} (N) →" | "Wszystkie pieczywo / inne" is ungrammatical; this form works for all 12 labels. |
| Q6 | Backfill new tags onto existing recipes | Not in this story; follow-up, owner-gated | A production data change; the feature works without it (chips appear as recipes carry the tag). |

## 📋 Implementation Plan
Single implementation PR (`Refs #218`, `Refs` the spec PR, `Source doc:` this file).

**Phase 1 — pure seams**
1. `recipe-tags.ts`: eight tags + title patterns; tests.
2. `category-tags.ts`: `parseTagParam`, `tagFacets`, `rankSimilar`; tests.
3. `routes.ts`: `categoryPath` options; `recipe-list-context.ts`: `kategoria` key; tests.
4. `chip.tsx`: export `chipClasses`.

**Phase 2 — category page**
5. `tag-filter.tsx` (chip links, show-all toggle).
6. `page.tsx`: parse params, parallel queries, summary (`role="status"`), clear, empty states, paging, snapshot, canonical.

**Phase 3 — recipe page**
7. `similar-recipes.tsx` (loader + render); wire into `page.tsx`; drop header tag row.

**Phase 4 — verification**
8. Local gate (`pnpm typecheck`, `pnpm lint`, `pnpm test`); dev server as a guest at 375 px and desktop: chip toggling, AND narrowing, counters, show-all, clear, paging, keyboard focus, no horizontal scroll; recipe page bottom section and links; screenshots on the PR.
