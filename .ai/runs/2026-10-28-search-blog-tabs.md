# Execution plan — search-blog-tabs (E01-S30, #346, epic #201)

Source doc: `.ai/design/przebudowa-handoff/designs/Wyszukiwarka.dc.html` („Dwie zakładki”, „Wynik z bloga, który już mamy”, „Zapis z bloga”, „Gość”)

## Goal

Epic #201 has two open stories. E01-S12 (#205) is implemented (#248, #252 merged) and waits only on
owner-side OAuth setup, so the remaining code work is E01-S30 (#346): split `/szukaj` results into the
tabs „W serwisie” (default, count) and „Na blogach” (on-demand blog search).

## Scope

- `searchViaExa` reports, per blog result, whether its link is already in the app — the user's own
  recipe (`own`) or anyone's (`other`, via `public_recipes`) — with the recipe slug.
- New client tabs component on `/szukaj`: „W serwisie” holds „Szukaj w:”, the count, the category
  filter, the results and a „Szukaj „{q}” na blogach” prompt; „Na blogach” runs the Exa search once
  per query when first opened.
- Blog result card: domain, title, snippet, „Otwórz stronę bloga”; existing → „Ten przepis jest już
  w aplikacji Zapisz Przepis” / „Masz go w Moich przepisach” + „Otwórz w aplikacji Zapisz Przepis”;
  full access → „Zapisz do moich przepisów”; no full access → „Odblokuj zapisywanie” (→ `/dodaj`, 3c).
- Guest: tab shows a lock and „po zalogowaniu”; the panel leads to login; no Exa request.

**Non-goals:** changing the Exa provider or result count; the add-recipe flow; the `/dodaj` Exa panel
(only adapted to the new result shape); „Moich” scope visibility rules.

## Implementation Plan

### Phase 1: Existing-recipe lookup for blog results
- 1.1 Return `existing: { owner, slug } | null` from `searchViaExa` (global dedup), adapt `/dodaj` panel, tests.

### Phase 2: Tabs on /szukaj
- 2.1 `SearchTabs` + blog panel component with the 3 access states, tests.
- 2.2 Wire into `/szukaj` page, update reflow e2e selector.

## Risks

- Up to 2 extra DB reads per blog result (5 results) — bounded, run in parallel.
- Reflow e2e not run in this session (no env); verify locally before merge.
- Tabs must keep server-rendered results in the DOM (hidden panel) so links work without JS.

## Progress

PR: #602

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Existing-recipe lookup for blog results

- [x] 1.1 Return existing recipe per blog result from searchViaExa — 9c45996

### Phase 2: Tabs on /szukaj

- [x] 2.1 SearchTabs and blog panel component — 984958f
- [x] 2.2 Wire tabs into /szukaj and update reflow e2e — 984958f

## Validation

- `pnpm typecheck`, `pnpm lint` (0 errors; 1 pre-existing warning in `signin-form.tsx`), `pnpm test` (187 files, 2074 tests) — green.
- `pnpm test:reflow` — not run: no `.env.local` in this checkout or the main one, so the dev server cannot reach Supabase. The `#no-results-heading` selector the reflow spec uses is kept.
