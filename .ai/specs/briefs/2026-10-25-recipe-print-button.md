# Add a print button and print stylesheet to the recipe page

- Date: 2026-10-25
- Category: feature
- Priority signal: medium — a frequently-wanted convenience for the core (often older) audience who cook from paper; not time-critical.
- Risk signal: low — print-only CSS plus one button; no new route, no data change, no change to the on-screen layout. Main risk is page-break tuning and keeping print rules from leaking into screen/reflow assertions.
- Routing: Next: om-auto-create-pr "Add a print button and print stylesheet to the recipe page — brief: .ai/specs/briefs/2026-10-25-recipe-print-button.md"

## Problem

The recipe page (`/przepis/{slug}`) has no way to print a clean copy. Printing the live page today drags in all the screen-only chrome — the global nav header, list bar, breadcrumbs, favourite/share/cooking-mode/text-size/step-photo controls, the YouTube embed, the gallery, prev/next nav, "wersje dania", "podobne przepisy", owner buttons and the footer — so a paper copy is unusable. Users (the target audience explicitly includes older people) want a tidy sheet to cook from. The owner referenced WP Recipe Maker's print view as the quality bar.

## Agreed direction

Ship **Route A**: a "Drukuj" button in the recipe header, styled exactly like the existing "Udostępnij" button (`buttonClasses('outline', 'md')`, lucide `Printer` icon, label "Drukuj"), placed next to "Udostępnij" in `RecipeActions`. The button calls `window.print()`. A print stylesheet under `@media print` hides all the chrome and lays out one good universal sheet. Guest-accessible (printing is public).

**One universal sheet, no settings panel.** Rejected alternatives and why:

- **Route B — a dedicated `/przepis/{slug}/druk` preview route (the WP Recipe Maker shape).** Rejected. WPRM ships a separate print *page* because, as a WordPress plugin, it can't control an arbitrary theme's live markup — a constraint this app does not have (it owns its own DOM). Route B would add a permanent second public route to maintain, keep in sync with every future recipe-data change, `noindex`, and test, to reproduce a result Route A already gets with a stylesheet. Not worth the ongoing surface.
- **Image on/off toggle (WPRM's one standard control).** Rejected for v1. Keeps the recipe header clean and the feature one-button. The cover image is always included, small, at the top; a reader who wants it gone can untick graphics in the browser's own print dialog.
- **Print text-size toggle (Smaller/Normal/Larger).** Rejected. Print CSS sets its own paper-appropriate font sizes anyway, so a screen-side size control would not reach the printout. Ship one generous, readable default sized for the older audience instead. (Note: this is *not* justified by the app's `/wyswietlanie` text-size setting — `.text-scalable` screen scaling does not apply in print media.)
- **Build nothing.** Rejected: the current page prints badly and this is a low-cost, high-fit convenience. Route A is itself the "do less" option (~90% of the value for a fraction of the surface of Route B).

## Resolved unknowns

| Question | Answer (from the conversation) |
|----------|--------------------------------|
| Separate print route or print the live page? | Live page. `window.print()` + `@media print` stylesheet on the existing recipe page. No new route. |
| Any reader controls / settings panel? | None. One "Drukuj" button, no image toggle, no size toggle, no unit/servings scaling. |
| Cover image on the printout? | Yes, always on, small, at the top. No toggle. |
| Step photos on the printout? | No — excluded (owner confirmed). |
| What content stays on the sheet? | Title; short description (`description`, and/or `meta_description` intro); porcje (`servings`, "na N porcji"); prep/cook/total times (with the `times_estimated` "≈"); ingredients with amounts + household measures; numbered steps. |
| Footer? | Yes: a source + canonical-URL line, e.g. `Źródło: {formatSource(...)} · zapiszprzepis.pl/przepis/{slug}`. |
| Print font size | One generous, readable default suited to older users. No control. |
| Guest access | Yes — printing is public, same as a guest's view of the recipe. |
| Why not a size control tied to `/wyswietlanie`? | Print media uses its own font sizes; screen `.text-scalable` never reaches print. One good default instead. |

## Non-goals

- No dedicated `/druk` route and no `noindex` work (nothing new is indexed — it's the same page).
- No PDF generation.
- No image on/off, text-size, unit or servings-scaling controls.
- No step photos on the printout.
- No change to the on-screen recipe layout beyond adding the "Drukuj" button to the actions row.

## Affected areas (if known)

- `src/app/przepis/[slug]/_components/recipe-actions.tsx` — add the "Drukuj" button beside "Udostępnij" (needs the canonical `shareUrl`/slug already available there, plus title for the print footer if built client-side).
- A small client component for the button (`window.print()`), mirroring `share-button.tsx`'s shape and button styling.
- The print stylesheet: `@media print` rules (likely in `src/app/globals.css`) that hide the global header/footer (they live in a shared layout, so the rules must reach them), the list bar, breadcrumbs, action buttons, cooking-mode, toggles, video, gallery, locked gallery, prev/next nav, dish versions, similar recipes, owner buttons and toasts; and lay out the cover, title, description, servings, times, ingredients and steps for paper. Prefer Tailwind's `print:hidden` on page sections plus a shared print block; keep page-break hints (`break-inside: avoid`) on ingredient/step blocks.

### Implementation watch-points

- Keep every print rule under `@media print` so the screen layout and `pnpm test:reflow` (which runs in screen media) are untouched.
- The cover currently renders full-bleed with negative margins below `lg`; in print it must sit as a normal small block — reset those margins in the print layout.
- The ingredient rows are interactive checkboxes; on paper render them as a plain list (name + amount + household measure), not as empty UI boxes, unless a tick-box for shopping is explicitly wanted.
- Validate against the gate: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:reflow`. Check the actual printout in a browser print preview (Chrome + Firefox render differently).
