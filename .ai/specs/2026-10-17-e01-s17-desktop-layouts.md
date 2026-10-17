# E01-S17 — Desktop layouts (A8, A9)

> Issue: #219 · Epic: #201 · Backlog: `.ai/specs/backlog-przebudowa.md` (E01-S17, refs A8/A9) · Depends on: S01 (tokens), S04 (home, #247), S05 (search, #262), S07 (recipe page, #245). All of them are live.
> Design reference: `.ai/design/przebudowa-handoff/designs/Propozycja A.dc.html` (frames A8, A9) and `README.md` § "Desktop (A8, A9)". Where this spec and the prototype differ, the prototype wins unless a Resolved assumption says otherwise.

## 📝 TLDR

All rebuilt screens are mobile-first, and on a 1440 px monitor they read as a stretched phone. The guest home shows a 3-column category grid and a 2-column feed, and the recipe page is a 1024 px single column with an 816 px-tall cover photo. **Proposed:** add desktop variants at the `lg` breakpoint (≥ 1024 px) only:
- **A8, header and guest home.** The header gets a wide row.
  - A guest sees logo · „Przepisy” · „Kategorie ▾” · „Zaloguj się” · „Załóż konto”.
  - A signed-in user sees logo · search field (max 460 px, 48 px) · „+ Dodaj przepis” · bell · MENU.
  - The guest home gets a centred hero with a 46 px H1 and a 760×64 search field with „Szukaj” inline, 9 category columns and a 4-column „Ostatnio dodane”.
- **A9, recipe page.** The header splits into a 16:10 photo | text column (`1.2fr 1fr`) with a 44 px title. The list bar fits on one row. The body is an ingredients panel (`#f9fafb`) | steps + 4-column gallery (`1fr 1.6fr`), and „Podobne” has 4 columns.
- **Every screen.** The container is `max-width: 1152px` with 32 px padding and no horizontal scroll.

Below `lg`, every screen must render pixel-identical to today.

## 📝 Problem Statement

The E01 rebuild (S04/S05/S07) deliberately shipped "no desktop variants beyond a sane `max-w`" (S04 spec, Architecture; S05 Non-goals; S07 "desktop layout is S17"). Measured at 1440×900 on `master` (f128a26):

- **Header:** the logo sits on the left and Dodaj · bell · MENU on the right, with ~900 px of empty space in between. There is no search and no category entry point except inside the MENU drawer.
- **Guest home:** the hero H1 is 30 px. The search field stretches to 1088 px wide. 8 category tiles wrap into 3 rows of 3 (and the last row has 2). The feed has 2 columns of 530 px-wide cards.
- **Recipe page:** `PageContainer narrow` (1024 px). The 4:3 cover is ~768 px tall, so the title starts below the fold. Ingredients and steps are one long column. The gallery has 3 columns, and „Podobne” has 2 columns of 490 px cards.

Desktop users include the same older audience (larger monitors, zoomed browsers), so the layout should use the width without shrinking type.

## 📝 Proposed Solution

This is a **CSS-first refactor**: Tailwind `lg:` variants on the existing components. There are no new routes and no data changes, and no component changes ownership. A structural change happens only where a grid needs a wrapper element, and each wrapper is a plain `<div>` that is a no-op below `lg`.

Breakpoint: **`lg` (1024 px)**. It is the first width where the A8 header row fits: at 1024 px the content box is 960 px, and logo 120 + nav ~210 + search ≥ 260 + actions ~330 ≈ 920 px. `sm`/`md` stay untouched, so tablets keep today's mobile layout, which already works there.

Alternatives considered:
- *A separate desktop header component switched by `hidden lg:block`.* Rejected: two copies of the bell/MENU (two `<dialog id="app-menu">` = duplicate ids) and double hydration. One header with responsive items is simpler.
- *`md` (768 px) breakpoint.* Rejected: the header row does not fit at 768 px with a 460 px search field, and a 2-column recipe body at 704 px gives ~270 px ingredients, which is too narrow at 19 px type.
- *Sticky ingredients panel.* Rejected: long ingredient lists (20+ rows at A++) exceed the viewport, and a sticky element taller than the viewport cannot be scrolled to its end.

## 📝 Architecture

| Area | File | Change (all `lg:` unless noted) |
|---|---|---|
| Container | `components/page-container.tsx` | Unchanged: `max-w-6xl` = 1152 px, `lg:px-8` = 32 px already match the AC. |
| Header | `components/app-header.tsx` | Guest: adds `HeaderNav` („Przepisy” + „Kategorie ▾”) and a „Załóż konto” primary link, both `hidden lg:flex`. The MENU button is `lg:hidden` for a guest: the guest drawer holds only the sign-in CTA and the categories, which the desktop header already shows. Signed-in: adds `HeaderSearch` (`hidden lg:flex`), and the Dodaj link reads „Dodaj przepis” at `lg` (mobile keeps „Dodaj”). Logo 140×35 at `lg`. |
| Header | new `components/header-nav.tsx` (client) | „Kategorie ▾”: a disclosure button (`aria-expanded`, `aria-controls`) with a list of `RECIPE_CATEGORIES` → `categoryPath()`. Escape and an outside click close it, and focus returns to the button. |
| Header | new `components/header-search.tsx` | A plain GET `<form role="search" aria-label="Szukaj w serwisie" action={SEARCH_PATH}>`: a 48 px input (visually hidden label) plus a labelled „Szukaj” submit, max 460 px. No mic (the page fields keep it). |
| Home | `app/page.tsx` | Guest hero centred at `lg` (`lg:text-center`, `lg:py-14`), H1 `lg:text-[46px]`, field centred. „Ostatnio dodane” `lg:grid-cols-4`. |
| Home | `components/home/home-search.tsx` | The input row becomes `flex-wrap` with the submit inside it. Below `lg` the submit wraps to its own full-width line, with the same 12 px gap as today's `mt-3`. At `lg`:<br>• the row is `max-w-[760px]` and the input and buttons are `h-16` (64 px);<br>• the submit sits inline and reads „Szukaj” (the full „Szukaj przepisu” stays below `lg`).<br>The mic status `<p>` moves after the row. This applies to every HomeSearch: home guest and member, and `/szukaj`. |
| Home | `components/home/category-grid.tsx` | Guest grid `lg:grid-cols-9` and renders a 9th category (`RECIPE_CATEGORIES[8]`, Sałatki) as `hidden lg:block`. Member grid (2 cols) `lg:grid-cols-4`. |
| Search | `components/search/search-results.tsx` | Results list `lg:grid lg:grid-cols-2`. Not in the AC; it keeps 1088 px-wide row cards readable (see A6). |
| Recipe | `przepis/[slug]/page.tsx` | Drops `narrow` (1152 px container; the width is identical below 1024 px). Video, gallery and locked gallery move into the steps column via a `children` slot of `RecipeChecklists`. |
| Recipe | `_components/recipe-header.tsx` | With a cover: `lg:grid lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-10`. The cover sits in the left column at `lg:aspect-[16/10]` (`lg:mb-0`), and the text block is wrapped in one `<div>`. Title `lg:text-[44px]`. |
| Recipe | `_components/recipe-checklists.tsx` | `lg:grid lg:grid-cols-[1fr_1.6fr] lg:gap-8 lg:items-start`. The text-size row spans both columns. Ingredients become a panel (`lg:rounded-card lg:border lg:bg-surface-2 lg:p-6`). Steps plus `children` form the right column. |
| Recipe | `_components/recipe-list-bar.tsx` | At `lg` the bar is one row: back link + "N z M" on the left, prev/next side by side on the right (each `lg:w-[260px]`). Placeholder `min-h` follows (`lg:min-h-[82px]`). |
| Recipe | `components/recipe-gallery.tsx` | Grid `lg:grid-cols-4`; `sizes` updated. |
| Recipe | `_components/similar-recipes.tsx` | `grid-cols-2 lg:grid-cols-4`. |

Takeaway: two small new header components; everything else is class changes plus three no-op wrapper `<div>`s and one `children` slot.

```mermaid
flowchart LR
  H[AppHeader] --> N[HeaderNav - new, lg only]
  H --> S[HeaderSearch - new, lg only]
  H --> B[Bell / Dodaj / MENU - existing]
  P[przepis page] --> RH[RecipeHeader: photo | text]
  P --> RC[RecipeChecklists: panel | steps + children]
  RC --> G[Video / Gallery / LockedGallery as children]
```

## 📝 Data Model

No change. No migration, no new query.

## 📝 UI/UX

Mockup: `assets/e01-s17-desktop-layouts/mockup.png` (illustrative). Current state: `current-home-guest-desktop.png`, `current-recipe-desktop.png`.

- **Header (A8).** Nav links are 18 px semibold and underlined (links are underlined, per the rule), with 48 px targets.
  - „Kategorie ▾” is a button with a `ChevronDown` icon (`aria-hidden`). Its panel is a 2-column list of all 12 categories: 48 px rows, a white card with a `border-card-2` border, `z-30` above the page content.
  - Guest buttons: „Zaloguj się” (outline) and „Załóż konto” (primary, `bg-action`). Both are 48 px and point to `/login`, the one OAuth screen that both signs in and creates an account.
  - Signed-in header search: a 48 px field with a 2 px `border-field` (3:1), max 460 px, a search icon and a visible „Szukaj” submit.
  - The signed-in header search also renders on `/szukaj` and the member home, which have their own field. That keeps one consistent header, and the landmarks have distinct labels („Szukaj w serwisie” vs the page form's label).
- **„Przepisy” target:** `/szukaj` (A1).
- **Dodaj button:** today it uses raw `bg-orange-500` with white text (2.8:1, which violates the COLOR rule). It switches to `bg-action` (#c2410c, 5.2:1) at all widths. This is the only intended mobile pixel change, and it is a WCAG fix (A3).
- **Guest home.** Centred hero, H1 46 px. The field is 760×64 with „Mów” and „Szukaj” inline, all 64 px. Categories are in 9 columns: 64 px tiles at 17 px bold, about 112 px each (1088/9), so „Ciasteczka” fits. „Ostatnio dodane” has 4 columns, so the 4 recipes fill one row.
- **Recipe (A9).** A 16:10 photo | text header puts the title (44 px) above the fold. Text size (A/A+/A++) spans the full width. Below it, the ingredients panel sits next to the steps. Gallery 4 columns, „Podobne” 4 columns. The prototype's prev/next sits at the bottom. Ours stays in the top list bar (S07), now on one row, side by side (A9).
- **No horizontal scroll** at 1024, 1280 and 1440, and at 320/390 (`scrollWidth == clientWidth`, asserted in QA).
- Focus: the global `:focus-visible` outline (3 px #1d4ed8, offset 2 px) applies. The categories panel's links are in DOM order after its button.

## 📝 Edge Cases & Failure Scenarios

- **1024–1100 px:** the header search shrinks (`flex-1 min-w-0`, min ~200 px). Header buttons stay on one line via `whitespace-nowrap`. If the row still overflows (e.g. 200 % zoom → effective 720 px), the zoomed viewport is below `lg`, so the mobile header applies.
- **Text-size A++ on the recipe:** the ingredients column is ~400 px. Long ingredient names wrap (`break-words`), and checkboxes stay 32 px.
- **Recipe without ingredients/steps/gallery:** the grid columns collapse naturally. An empty steps column shows „Brak kroków przygotowania.” as today.
- **Recipe without cover:** the header grid gets a single child, so the text sits in the 1fr column. Mitigation: the grid applies only when `image_url` is set.
- **List bar hydration placeholder:** both the placeholder and the bar share `BAR`, so the `lg:min-h` applies to both and there is no jump.
- **No JS:** the header search is a plain GET form. „Kategorie ▾” needs JS to open, but the same categories stay in the MENU drawer and on the home grid.

## 📝 Risks & Impact Review

| Risk | Severity | Mitigation |
|---|---|---|
| Mobile regression from structural wrappers (HomeSearch row, header text wrapper, checklists column) | Medium | Before/after full-page screenshots at 390 px for the guest home, member home, `/szukaj`, and the recipe (guest + member), diffed pixel-wise. |
| Merge conflicts with S08 (cooking mode, `recipe-actions`/checklists), S10 (`/dodaj` header link) and S15 (home banner slot) | Medium | Class-only edits where possible; keep the S08/S10/S15 slot comments in place; merge `master` before review and before hand-off. |
| Header row overflow 1024–1100 px | Low | `min-w-0` search; QA at 1024. |
| Two `role="search"` landmarks on home and `/szukaj` | Low | Distinct accessible names. |

## 📋 Phasing

One PR, one phase: the changes are cross-cutting classes and verified together by screenshots.

## 📋 Implementation Plan

### Phase 1 — desktop variants
1. `header-search.tsx`, `header-nav.tsx` (new); `app-header.tsx` wires them in `hidden lg:flex` (nav + „Załóż konto” for a guest, search for a signed-in user), guest MENU `lg:hidden`, „Dodaj przepis” label at `lg`, `bg-action` on Dodaj.
2. `home-search.tsx` row restructure (wrap + inline submit at `lg`, 760×64); `page.tsx` hero 46 px + feed 4 cols; `category-grid.tsx` 9 cols / member 4 cols.
3. `search-results.tsx` 2 cols at `lg`.
4. Recipe: `page.tsx` (drop `narrow`, children slot), `recipe-header.tsx`, `recipe-checklists.tsx`, `recipe-list-bar.tsx`, `recipe-gallery.tsx`, `similar-recipes.tsx`.
5. Gate (`pnpm typecheck`, `pnpm lint`, `pnpm test`); full-page screenshots at 1440/1024/390 before and after; horizontal-scroll assertion; keyboard check of „Kategorie ▾”.

## Resolved assumptions (autonomous defaults)

| # | Question | Default | Why |
|---|---|---|---|
| A1 | Where does „Przepisy” point? There is no public "all recipes" listing. | `/szukaj` (`SEARCH_PATH`), the public browse/search entry. | The only public cross-category list; `/recipes` is owner-only and would bounce a guest. Repoint later via one constant if a catalog page lands. |
| A2 | Breakpoint for "desktop" | `lg` (1024 px) | The header row fits only from ~1000 px; tablets keep the working mobile layout. |
| A3 | Is the Dodaj colour fix (`orange-500` → `bg-action`) in scope, given "mobile must look identical"? | Yes, at all widths. | It is a COLOR/WCAG violation (2.8:1); the project rule forbids it. This is the single intended mobile change. |
| A4 | Which header items does each audience get? | Guest: „Przepisy”, „Kategorie ▾”, „Zaloguj się”, „Załóż konto” (no search, bell, Dodaj or MENU at `lg`). Signed-in: search, „+ Dodaj przepis”, bell, MENU. | This is the A8/A9 prototype split (README § Desktop). The guest drawer's only content (sign-in CTA + categories) is already in the desktop header. |
| A9 | Prev/next position on the recipe | It stays in the top list bar, on one row at `lg`, side by side. | Moving it to the bottom like the prototype would change the mobile S07 layout. Side by side satisfies the AC. |
| A5 | 9 category columns with 8 home categories | Show a 9th category (Sałatki) at `lg` only. | Fills the 9-column row the AC asks for without an empty cell; mobile keeps 8. |
| A6 | `/szukaj` desktop layout (not in the AC beyond the container) | Results in 2 columns at `lg`; the field follows HomeSearch (760×64). | Single 1088 px row cards are hard to scan; the change is class-only. |
| A7 | Member home desktop | Category grid 4 columns at `lg`; tiles and add form unchanged. | The AC covers only the guest home; 2 columns of 530 px tiles look broken. |
| A8 | Signed-in header search on pages that already have a search field | Rendered everywhere. | A consistent header; distinct landmark labels avoid ambiguity. |
| A10 | Prototype extras not in the AC: category icons/counts, "Wszystkie przepisy →", Udostępnij/Oryginał 54 px buttons, prep/cook/total time trio, dark CTA | Out of scope. | The AC lists layout only; these are content/feature changes that belong to their stories. |

## Non-goals

- Variant 1b (bottom tabs, side panel).
- Desktop variants of `/settings`, `/u/{username}`, `/przepisy/{kategoria}`, `/ulubione`, `/recipes` beyond what the shared container/header give them.
- Restyling `RecipeGallery`'s legacy heading/focus colours (separate token pass).
