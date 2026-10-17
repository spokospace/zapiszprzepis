# E01-S09 — Menu drawer: "Moje" + "Wszystkie wg kategorii"

> Backlog: `.ai/specs/backlog-przebudowa.md` (E01-S09, refs C5 / A6 / 3d). Issue: #212. Risk: **low** (UI + read-only counts, one new public read-only route, no schema change). Depends on S01 (tokens, live). The lock state is fed by S11 (#214, in flight) through a single seam defined here.

## 📝 TLDR
Today the MENU drawer (`app-menu.tsx`) is a flat list: Ulubione + Ustawienia + Wyloguj for a signed-in user, Zaloguj / Załóż konto for a guest. There is no way to browse recipes by category from the menu, no counters, and no notion of "full access". *Proposed (future behavior):* the drawer gets three blocks — **"Moje"** (Moje przepisy with a counter — full access only, Ulubione with a counter, Dodaj przepis, locked with a padlock and a caption without full access), **"Wszystkie przepisy według kategorii"** (a 2-column grid of every category from `recipe-categories.ts`, for guests too) and a footer **"Ustawienia | Wyloguj"**. A guest sees "Zaloguj się / Załóż konto" instead of "Moje". Category tiles open a new **public** listing `/kategoria/{value}`, so no menu link bounces a guest to `/login`.

## 📝 Problem Statement
- The rebuild's navigation structure (variant 1a) puts everything behind MENU; without categories there, a guest has no way to browse beyond the home feed.
- The only existing category filter is `/recipes?category=…`, which is owner-only ("Moje przepisy") and redirects a guest to `/login` — linking it from a menu a guest can open would break the access rule in `CLAUDE.md` ("a guest browses and searches").
- The handoff (C5/A6/3d) shows counters next to "Moje przepisy" and "Ulubione" so the user knows what is inside before tapping.
- "Dodaj przepis" requires full access (code or payment, S11). A user without it must see *why* before tapping, not discover it on a gate screen.

## 📝 Proposed Solution
1. **Drawer rebuild** (`src/app/components/app-menu.tsx`), still on the native `<dialog>` + `showModal()` (keeps Escape, focus trap, inert background with no extra code). Content derived from a pure, unit-tested model builder so every access state is testable without a DOM.
2. **Menu summary** loaded server-side next to the existing failed-shares query in `AppShell`: `{ hasFullAccess, myRecipesCount, favoritesCount }` via two `count: 'exact', head: true` queries (no rows transferred), passed `AppShell → AppHeader → AppMenu` as one optional prop.
3. **Full-access seam**: `getFullAccess(supabase): Promise<boolean>` in `src/lib/full-access.ts`. That is S11's (#214) exact signature: the RPC-backed `has_full_access()` reads `auth.uid()` and fails closed. Callers pass `false` for a guest instead of calling it. Until S11 merges, this branch ships a same-signature stub returning `true`, which is today's capability, so the two changes merge in either order. The locked branch is built and tested now.
4. **Public category listing** `/kategoria/[category]`: newest recipes in that category from the guest-safe `public_recipes` view, rendered with the existing `RecipeCard` grid. One helper, `categoryPath(category)` in `src/lib/routes.ts` (the seam S04 also uses for its home tiles), owns the URL, so S05 (`/szukaj`) can later redirect or retarget it in one place.

**Alternatives considered**
- *Link categories to `/recipes?category=`* — rejected: owner-only, scoped to *my* recipes, bounces guests.
- *Link categories to `/szukaj?kategoria=`* (S05) — rejected for now: the route does not exist yet; S05 is not a dependency of S09. `categoryPath` makes the later switch a one-line change.
- *Fetch counters client-side when the drawer opens* (server action) — rejected: "Moje przepisy" visibility depends on full access, so the "Moje" block would reflow after opening, which is disorienting for the target group and for screen readers. Two head-count queries per page render are cheap and run in parallel with the existing failed-shares query.

## 📝 Architecture
- `src/lib/full-access.ts` *(new)* — `getFullAccess(supabase)`; S11's implementation, stubbed here until it merges.
- `src/lib/menu-summary.ts` *(new)* — `getMenuSummary(supabase, user): Promise<MenuSummary | null>` (null for a guest). Counts: `recipes` where `user_id = me` (exactly the set `/recipes` lists) and `favorites` where `user_id = me` (owner-only RLS already scopes both; the explicit `eq` is defence in depth, matching `/recipes`).
- `src/lib/recipe-categories.ts` — adds `isRecipeCategory(value)`.
- `src/lib/routes.ts` — `categoryPath(category)` (shared with S04) returns `/kategoria/{value}`; `isPublicRoute` allows it.
- `src/app/components/app-menu-model.ts` *(new)* — pure `buildMenuModel({ isAuthenticated, summary })` → which "Moje" entries show, their counters, the lock state, guest CTA vs footer.
- `src/app/components/app-menu.tsx` — renders the model.
- `src/app/components/app-shell.tsx` — adds `getMenuSummary` to its `Promise.all`; passes `menu` to `AppHeader`.
- `src/app/components/app-header.tsx` — **one optional prop** (`menu?: MenuSummary | null`) forwarded to `AppMenu`. No other header change (other sessions edit the header's neighbours in parallel).
- `src/app/kategoria/[category]/page.tsx` + `layout.tsx` *(new)* — public, wrapped in `AppShell` like `/przepis/[slug]`.
- **Not touched:** `src/app/page.tsx` (home, owned by S04 in parallel). It renders `AppHeader` without `menu`; the drawer degrades gracefully (see Edge Cases). S04 can pass `getMenuSummary` (or move to `AppShell`) when it lands.

## 📝 Data Model
No schema change, no migration. Reads only: `recipes` (owner-only RLS), `favorites` (owner-only RLS), `public_recipes` (guest-safe view).

## 📝 API Contracts
```ts
// src/lib/menu-summary.ts
export type MenuSummary = {
  hasFullAccess: boolean
  myRecipesCount: number | null   // null = query failed → counter hidden, never a false 0
  favoritesCount: number | null
}
export function getMenuSummary(supabase, user: User | null): Promise<MenuSummary | null>

// src/lib/routes.ts
export function categoryPath(category: string): string  // '/kategoria/{value}'
// src/lib/recipe-categories.ts
export function isRecipeCategory(value: string): value is RecipeCategory
```
`/kategoria/{value}`: `value` must be a member of the `recipe_category` enum, otherwise `notFound()`. Lists up to 48 newest recipes (`created_at desc`); pagination is S05's concern.

## 📝 UI/UX
Layout (variant 1c style, 1a structure):
- **Panel:** full screen below `sm` (640 px), 330 px wide right-side panel from `sm` up; vertical scroll inside the panel only, never horizontal.
- **Header row:** "Menu" title + labelled "Zamknij" button (icon + text, ≥ 48 px).
- **"Moje"** (signed-in): heading `h2` "Moje", list of rows ≥ 56 px, 19 px text, icon + label always:
  - "Moje przepisy" + counter (only when `hasFullAccess`) → `/recipes`
  - "Ulubione" + counter → `/ulubione`
  - "Dodaj przepis" → the add route (`/?tab=add` today; S10 moves it to `/dodaj`). Without full access: padlock icon, caption "Wymaga kodu lub pełnego dostępu" (16 px, `text-ink-soft`) under the label; it links to `/`, where S11 renders the 3c `AccessCodeGate` in place of the add form (S10 moves it to `/dodaj`). The padlock is decorative (`aria-hidden`); the caption is part of the link's accessible name.
  - Counter rendered as text in a pill (`text-ink`, `bg-surface-3`), with a visually-hidden unit so a screen reader hears "Ulubione, 12 przepisów", not "Ulubione 12".
- **Guest** instead of "Moje": a short line "Zaloguj się, żeby zapisywać ulubione przepisy." and two 56 px buttons: "Zaloguj się" (primary, `bg-action`) and "Załóż konto" (outline).
- **"Wszystkie przepisy według kategorii"** (everyone): `h2` + 2-column grid of every category from `RECIPE_CATEGORIES` (labels with diacritics via the list, never raw enum values); each tile a link ≥ 56 px tall, 2 px `border-field` (3:1), 17–19 px text.
- **Footer** (signed-in): "Ustawienia" (link → `/settings`) and "Wyloguj" (form submit, existing `signOut` action) side by side, separated by a divider, each ≥ 48 px, icon + label.
- **Active route:** `aria-current="page"` + `text-action-text` (#9a3412) and a left bar; never colour alone.
- **Focus / keyboard:** `showModal()` moves focus into the dialog; the first focusable element is "Zamknij". Escape closes; focus returns to the MENU button (native `<dialog>` behaviour). Backdrop click closes. Any navigation closes the drawer (existing `pathname` effect). Global `:focus-visible` outline (3 px #1d4ed8, offset 2 px) applies; nothing overrides it.
- **Category page `/kategoria/{value}`:** `h1` = category label, the `RecipeCard` grid used by `/ulubione`, empty state "W tej kategorii nie ma jeszcze przepisów." plus a link back to `/`.

## 📝 Edge Cases & Failure Scenarios
- **Count query fails** → that counter is `null` and hidden; the entry still shows. Errors are logged server-side (`console.error`), never surfaced as "0".
- **`menu` prop absent** (home page until S04 passes it) → signed-in drawer shows "Moje przepisy" (full access is the default today), "Ulubione", "Dodaj przepis" without counters. No crash, no lock shown.
- **Favorites pointing at a recipe no longer in `public_recipes`** → counter may be one higher than the grid on `/ulubione`. Acceptable; the dedup collapse (S03a) keeps favorites consistent in practice.
- **Unknown category in the URL** → 404, not an empty page.
- **Category with zero recipes** → empty state, not a 404.
- **Large text scale** (S01 text-size controls): grid tiles wrap their label; the panel scrolls vertically.
- **Guest** → never sees "Moje przepisy", "Ulubione", "Dodaj przepis", "Ustawienia" or "Wyloguj"; every link in the guest drawer is public.

## 📝 Risks & Impact Review
- **Per-render cost:** two extra head-count queries on every `AppShell` page for signed-in users (none for guests), run in parallel with failed-shares. Reversible by dropping the call.
- **Public route `/kategoria/*`** is a new public URL (SEO-visible). It reads only the guest-safe view already exposed on `/` and `/przepis/*`; no new data exposure. If S05 supersedes it, keep it as a 301 to `/szukaj?kategoria=` rather than deleting it.
- **S11 seam:** until S11 lands, the `getFullAccess` stub returns `true` for every signed-in user — the same capability they have today. No user loses access because of this story.

## 📝 Resolved assumptions (autonomous defaults)
| # | Question | Default applied | Rationale |
|---|----------|-----------------|-----------|
| Q1 | Where do category tiles link, given `/recipes?category=` is owner-only? | New public route `/kategoria/{value}` behind `categoryPath()` (shared with S04) | Guests must not bounce to `/login`; `/szukaj` (S05) does not exist yet; one helper makes retargeting a one-liner. |
| Q2 | What decides "full access" before S11 ships? | S11's `getFullAccess(supabase)`; a same-signature stub returning `true` until S11 merges, `false` for a guest without calling it | Agreed with the S11 session; matches today's capability; merge order does not matter. |
| Q3 | Where does the locked "Dodaj przepis" lead? | `/` (S11's 3c `AccessCodeGate` replaces the add form there); `/dodaj` after S10 | Agreed with the S11 session; the gate's real location today. |
| Q4 | Counters: server-side per render or client-side on open? | Server-side in `AppShell`, head-count queries | No reflow inside an open dialog; cheap; parallel with an existing query. |
| Q5 | Should the home page (`src/app/page.tsx`) be wired now? | No — S04 owns it; the drawer degrades without counters there | Avoids a merge conflict with the parallel S04 session. |
| Q6 | Which categories in the grid? | All entries of `RECIPE_CATEGORIES` (12) | The AC says "z `recipe-categories.ts`"; the 8-item cut is a home-page (S04) decision. |

## 📋 Implementation Plan
Single implementation PR (`Refs #212`, `Source doc:` this file).

**Phase 1 — data seams (no UI change)**
1. `recipe-categories.ts`: `isRecipeCategory`; `routes.ts`: `categoryPath` + public allowlist; unit tests.
2. `src/lib/full-access.ts`: `getFullAccess(supabase)` stub with S11's signature (covered through `getMenuSummary`'s tests).
3. `src/lib/menu-summary.ts`: `getMenuSummary` (two head counts, null on error) + unit tests with a stubbed Supabase client (guest → null; error → null counter; happy path).

**Phase 2 — public category listing**
4. `src/app/kategoria/layout.tsx` (AppShell) + `src/app/kategoria/[category]/page.tsx` (validate, query `public_recipes`, grid, empty state, `generateMetadata`).

**Phase 3 — drawer**
5. `app-menu-model.ts` `buildMenuModel` + unit tests for guest / signed-in full access / signed-in without access / missing summary / null counters.
6. Rebuild `app-menu.tsx` on the model (sections, counters with SR unit, lock caption, guest CTA, category grid, footer, panel sizing).
7. Plumb `menu`: `AppShell` (`Promise.all`) → `AppHeader` optional prop → `AppMenu`.

**Phase 4 — verification**
8. Local gate (`pnpm typecheck`, `pnpm lint`, `pnpm test`); dev-server check as guest and signed-in at 375 px and desktop: open/close with keyboard, Escape, focus return, no horizontal scroll, category link lands on a public page; screenshots on the PR.
