# Menu drawer: category names must never break mid-word

## 📝 TLDR
A signed-in user who opens the header **MENU** drawer sees category names broken
mid-word in the "Wszystkie przepisy według kategorii" grid — "Ciastecz·ka",
"Śniadani·a", "Pieczyw·o", "Przekąs·ki". The 2-column tiles carry the app-wide
`wrap-anywhere` utility and the longest names do not fit at phone width, so the
browser splits them at an arbitrary character. Proposed: keep the compact 2-column
tiles but size them to fit the longest single word, drop to a single column on the
narrowest phones (< 360 px), break words only as a last resort, and bind Polish
single-letter words ("i", "w", "z"…) to the next word so they are never left
dangling at the end of a line (orphan / "sierotka" rule).

## 📝 Problem Statement
The drawer category grid (`src/app/components/app-menu.tsx:229–253`) is a
`grid-cols-2` of 12 tiles — an icon + an 18 px bold label — each carrying
`wrap-anywhere` (`overflow-wrap: anywhere`), the pattern used across the app to stop
long user text forcing horizontal page scroll at 320 px (documented in
`src/app/globals.css:80`, guarded by `pnpm test:reflow`).

For a 2-column tile the text width at 320 px is ≈ 70–75 px, narrower than the longest
single-word labels, so `overflow-wrap: anywhere` breaks those words at an arbitrary
character. This reads as a typo and hurts scannability — against the project's "wysoka
czytelność" rule for an audience that includes older users (CLAUDE.md, E01 design rules).

Labels (`src/lib/recipe-categories.ts:52–65`): longest single words — "Ciasteczka" (10),
"Śniadania"/"Przekąski" (9), "Pieczywo" (8); one multi-word — "Syropy i napary".

Two defects, one grid:
1. **Mid-word break** of single words that do not fit a 2-column tile.
2. **Polish orphan** — "Syropy i napary" currently wraps as "Syropy i" / "napary",
   leaving the one-letter "i" stranded at the end of a line. Polish typography requires
   single-letter words to be carried to the next line with the following word.

The S09 menu-drawer spec (`.ai/specs/2026-10-17-menu-drawer.md:70`) recorded the 2-column,
icon-left, 18 px grid, and its edge cases (line 82) accepted label wrap only **at large
text scale**. Mid-word breaking at the default size is an unintended regression.

## 📝 Proposed Solution
Keep the compact two-column tiles (owner's choice: variant **C**), but make them fit and
read correctly:

1. **Column count by width.** `grid-cols-1 min-[360px]:grid-cols-2`. Below 360 px the
   drawer shows one full-width column (ample room, no break); from 360 px up, the compact
   two columns. This reuses the exact breakpoint `CategoryGrid` already uses on the home
   page for the same reason (`src/app/components/home/category-grid.tsx:5–6`).
2. **Sizing that fits the longest word.** 16 px bold label (keeps the ≥ 16 px readability
   floor), 20 px icon, tighter padding (`px-2.5`), so "Ciasteczka" sits on one line from
   360 px up with slack.
3. **Break only as a last resort.** Replace `wrap-anywhere` with `break-words`
   (`overflow-wrap: break-word`) on the label span, keeping `min-w-0`. A word breaks only
   if it genuinely cannot fit (extreme zoom), so the reflow guard still holds but default
   rendering never breaks mid-word.
4. **Orphan binding (sierotka rule).** A small render-time helper inserts a non-breaking
   space (U+00A0) after every single-letter Polish word, so "Syropy i napary" renders as
   "Syropy i napary" and can only break as "Syropy" / "i napary". Applied at render,
   not in the data, so the enum-matching path (`toRecipeCategory` → `foldCategory`) and
   SEO/markdown consumers of the raw label are untouched.

**Alternatives considered.** (A) Single full-width column — safest, but the owner chose the
more compact 2-column look. (B) Icon-on-top stacked tile — good, but a bigger visual change
than needed. Baking the NBSP into the label constant — rejected: the label feeds
`toRecipeCategory`'s matcher and the SEO title/markdown builders, where an injected U+00A0
would break LLM-category matching (`foldCategory` does not fold NBSP → space) and alter
plain-text output.

## 📝 Architecture
- **Changed:** `src/app/components/app-menu.tsx` — the category grid's `<ul>` column
  classes and the tile `<Link>` class list; the label span gains the orphan helper.
- **New:** `src/lib/polish-typography.ts` — `bindOrphans(text)`; a pure string helper,
  no dependencies, reusable by any Polish-copy surface later.
- **Unaffected:** `recipe-categories.ts` data, `categoryPath`, routing, the "Moje" rows,
  the footer, panel sizing, and every other `wrap-anywhere` usage in the app.
- The home-page `CategoryGrid` has the identical `wrap-anywhere` + "Syropy i napary"
  issue; it is **out of scope** here (owner: drawer only) and handed to a follow-up.

## 📝 API / Helper contract
```ts
// src/lib/polish-typography.ts
// Binds Polish single-letter words (a, i, o, u, w, z — any case) to the next word with
// a non-breaking space, so they are never orphaned at a line end. Idempotent.
export function bindOrphans(text: string): string
// "Syropy i napary"  -> "Syropy i napary"
// "Obiady"           -> "Obiady"            (no-op)
// "A to i owo"       -> "A to i owo"
```
Regex: match a single-letter word (start-of-string or after whitespace) followed by
whitespace, and replace that trailing whitespace with U+00A0. Letter set
`[aiouwzAIOUWZ]` (includes the Polish one-letter prepositions/conjunctions a, i, o, u, w, z).

## 📝 UI/UX
- From 360 px: two columns, 16 px bold names, 20 px `action-text` icon, `min-h-[56px]`
  tiles (touch target ≥ 48 px kept), `#fff7ed` fill with the 1.5 px `#fed7aa` frame
  unchanged; active tile keeps `border-action` + `text-action-text`.
- Below 360 px: one full-width column, same tile chrome.
- "Syropy i napary" is the only label that wraps; it wraps at the space to two lines
  ("Syropy" / "i napary"), never mid-word, never on the "i".
- Focus ring, `aria-current="page"` active marking, and `no-underline!` are unchanged.

Prototype: none (reference is the inline mockup reviewed in-session — variant C).

## 📝 Edge Cases & Failure Scenarios
- **Extreme text zoom (S01 A++ / 200 %).** A single word may exceed even a one-column
  tile; `break-words` then breaks it as a last resort instead of forcing horizontal page
  scroll — accepted (matches S09's large-scale allowance), and never happens at normal sizes.
- **A future long single-word category.** Same mechanism: fits at 16 px from 360 px up, or
  the < 360 px single column catches it; `break-words` is the final safety net.
- **Screen readers.** U+00A0 is announced as a normal space; the accessible name of each
  tile is unchanged.
- **LLM category matching.** Untouched — the NBSP lives only in the rendered label, not in
  `RECIPE_CATEGORIES[].label`, so `toRecipeCategory("Syropy i napary")` still resolves.

## 📝 Risks & Impact Review
- **Readability floor.** 16 px bold is at the project's ≥ 16 px helper floor and below the
  18 px the S09 tile used. This is the owner's compact-layout trade-off; the single-column
  fallback below 360 px keeps the smallest screens legible. If a 320–360 px device must
  stay 2-column in future, 15 px is the only lever — flagged, not taken.
- **Supersedes S09.** The 2-column/18 px/icon-left decision in
  `.ai/specs/2026-10-17-menu-drawer.md:70` is refined here (16 px, 1-col < 360 px, no
  `wrap-anywhere`). Owner-approved by the variant-C choice.
- **Divergence from home grid.** Until the follow-up lands, the drawer and the home
  `CategoryGrid` handle "Syropy i napary" differently. Low impact; follow-up filed.
- **Reversibility.** Pure CSS-class + one small pure helper; revert is a one-commit diff.

## 📝 Decisions in play
No `product-brief.md` in this area. The only recorded decision touched is the S09 tile
layout (above), explicitly superseded with owner sign-off (variant C).

## 📋 Phasing
One shippable phase. The home-grid parity fix and any app-wide orphan sweep are a separate
follow-up issue, not a phase of this spec.

## 📋 Implementation Plan
**Phase 1 — Non-breaking, orphan-safe drawer category tiles**

1. **Add `src/lib/polish-typography.ts` + unit test.** Implement `bindOrphans(text)` per
   the contract. Test `src/lib/polish-typography.test.ts`: "Syropy i napary" →
   "Syropy i napary"; no-op for "Obiady"; multiple orphans ("A to i owo"); idempotent
   (running twice adds no second NBSP). App unaffected (helper not yet wired). Gate green.
2. **Rework the drawer grid + tile in `app-menu.tsx`, wiring the helper in the same edit.**
   - `<ul>`: `grid grid-cols-2 gap-2 px-5` → `grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 px-5`.
   - Tile class list: `gap-2.5`→`gap-2`, `px-3.5`→`px-2.5`, `text-[18px]`→`text-[16px]`,
     remove `wrap-anywhere`, add `break-words`; icon `h-6 w-6`→`h-5 w-5`.
   - Label span: `{label}` → `{bindOrphans(label)}` (import added in this same Edit, per the
     import+first-usage rule).
   - Extend the drawer unit test: tile class list no longer contains `wrap-anywhere` and
     does contain `break-words`; the rendered "Syropy i napary" label contains U+00A0;
     the `<ul>` carries `grid-cols-1` and `min-[360px]:grid-cols-2`.
   - Run `pnpm test:reflow` (320 px — no horizontal scroll, single column) and capture a
     320 px + a 360 px drawer screenshot confirming no mid-word break and "i" carried over.

**Validation gate:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:reflow`.

## 📋 Out of scope (follow-up issue)
- Apply the same no-`wrap-anywhere` + `bindOrphans` treatment to the home-page
  `CategoryGrid` (`src/app/components/home/category-grid.tsx:56`) so the two grids agree.
- Consider an app-wide orphan sweep for Polish headings/titles where the rule should hold
  (CLAUDE.md "wysoka czytelność"). Evaluate separately; not every surface wants NBSP.
