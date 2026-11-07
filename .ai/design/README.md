# Design handoffs — index for agents

The owner's design handoffs (Claude Design exports) live in this folder as **design authority** for the rebuild (epic E01). They are HTML mockups (`*.dc.html`, open in a browser with the `support.js` next to them) plus Markdown instructions. They are references, not production code. Specs link them in a `Prototype:` / `Design authority:` line.

## Order of precedence
1. `CLAUDE.md` (owner decisions and project rules, WCAG).
2. The code and its tests where `CLAUDE.md` names them as the source of truth (for example `app-header.tsx`).
3. The newest handoff for the screen in question, then older ones. A newer handoff states what it supersedes.
4. Specs under `.ai/specs/` (they record what was decided per phase and the autonomous defaults).

## Handoffs

| Folder | Date | Covers | Main instruction |
|---|---|---|---|
| `redesign-handoff/` | v8, 2026-10-20 | Navigation, search, recipe page, profile, access (variants 1a/1b/1c). Older; most of it is built. | `README.md`, `design-rules.md` |
| `redesign-handoff-13/` | 2026-10-21 | Visual style **1b** on every screen (pills, 4 px tiles, flat menu, section rules), header and menu, "← Wróć", recipe-of-the-day, cards and source tab, previous/next, step photos, tag filters on a phone, footer. | `changes-clickable-prototype.md` (main), `change-step-photos.md` (step-photo data) |
| `home-hero-handoff-14/` | 2026-10-21 | The home hero: one column, search first (variants 3a/3b desktop, 3c/3d phone). | `README.md` |
| `other-versions-handoff-16/` | 2026-10-21 | "Inne wersje {dania}" and "Zobacz więcej przepisów" on the recipe page. The same files were delivered as handoffs 16 and 17. | `README.md` |

The `Zapisz Przepis - prototyp klikalny.html` bundle of handoff 13 (1.3 MB, generated) is not committed; its sources are `redesign-handoff-13/designs/clickable-prototype.dc.html`. The logos inside `designs/public/` are mockup assets: the app uses `src/app/components/brand-logo.tsx` only (see `CLAUDE.md`).

## What was built from them (as of 2026-11-04)

| Handoff | Built in | Notes |
|---|---|---|
| 13, style 1b | spec #419 (`.ai/specs/2026-10-21-visual-style-1b.md`); #420 tokens and pill buttons, #421 cards / source tab / home, #422 menu and header (folds in #412), #424 recipe page and the other screens | Radius aliases `rounded-field` / `rounded-card` are removed. |
| 13, "← Wróć" and "Poprzedni" | #425 → #432 | Return point in `sessionStorage` (`src/lib/return-point.ts`). |
| 13, tag filter on a phone | #434, #437 | One sideways row with "Więcej ›" / "‹ Wstecz". Handoff's "stable order" and `aria-disabled` zero-result tags are **not** built (logic change). |
| 13, step photos | data and import landed earlier (#414); visible to signed-in users only (owner decision, #424) | |
| 14, hero | spec #427 (`.ai/specs/2026-10-21-home-hero-search.md`); #428, #429, #430, #431, #433 | See the deviations below. |
| 16/17, other versions and tags | #434 | See the deviations below. |

## Where the code deliberately differs from a handoff
- **Hero suggestions panel:** handoff 14 says the suggestions panel opens under the hero field. The home field never had suggestions (the panel belongs to the header search, which is hidden on `/`), so none were added. Adding them is a new feature.
- **Hero "Często szukane":** the first 5 terms of `POPULAR_SEARCHES` (4 on a phone); the shared list is unchanged because the header panel and `/szukaj` use it.
- **Attention banner:** removed from the signed-in hero as handoff 14 states; failed imports show only in the menu row "Powiadomienia", its counter and the dot on the Menu button.
- **"Inne wersje" heading:** the handoff wants the genitive ("pączków"). The data holds only the nominative and accusative, so `src/lib/dish-versions.ts` has a curated `DISH_GENITIVE` map; an unknown dish gets "Inne wersje tego dania (N)". A `dish_genitive` column would replace the map (migration, prompt, backfill).
- **Header, wordmark, logo, source badge text:** `CLAUDE.md` wins over any mockup.

## Not built / open
- Handoff 13 "stable order" and `aria-disabled` tags in the category filter.
- Slow tag filtering: only part of #435 was done (instant feedback, parallel favorites); the tag counters still read every recipe's tags per tap, and no timings were taken.
- Visual comparison with the mockups and `pnpm test:reflow` were not run during the work (no `.env.local` in the cloud sessions): worth a manual pass at 320 / 390 / 767 px and on desktop.

## Working notes for agents
- Start from `CLAUDE.md`, then the handoff's main instruction for the screen. Quote only values you read in the handoff; if it is silent, follow `design-rules.md` and the tokens in `src/app/globals.css`.
- A handoff step that changes logic ("do not change existing logic" is the handoff's own rule) becomes its own issue; do not smuggle it into a styling PR.
- When a new handoff arrives, import it as a new folder here (decode the `#UXXXX` file names that unzip leaves for non-ASCII letters, then rename every file and directory to English kebab-case without spaces; in `*.dc.html` also rename the `<dc-import name="…">` values, because the name is the file name), add a row to the tables above and link it from the spec's `Prototype:` line.
