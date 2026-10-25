# Execution plan — recipe print button + print stylesheet

- Date: 2026-10-25
- Slug: recipe-print-button
- Branch: claude/recipe-page-print-option-0c152c (session worktree reused)
- Base: master
- Source brief: `.ai/specs/briefs/2026-10-25-recipe-print-button.md`
- Engine: om-auto-create-pr (steps: 9, --loop: no)

## Goal

Add a "Drukuj" button to the recipe page (styled like "Udostępnij") that calls `window.print()`, plus an `@media print` stylesheet that strips the app chrome and prints one clean universal recipe sheet: small cover, title, short description, servings, times, ingredients (with household measures), numbered steps, and a `Źródło: … · zapiszprzepis.pl/przepis/…` footer. No step photos. No new route, no settings panel.

## Scope

Route A (print the live recipe page via `window.print()` + print CSS). In scope: a Drukuj button + client component; a print stylesheet; `print:hidden` on the recipe page's screen-only chrome and on the shared header/footer; a print-only source/URL footer. Hiding the shared `AppHeader`/`SiteFooter` in print is a deliberate, universally-correct side effect for every page's printout.

## Non-goals

- No dedicated `/druk` route, no PDF export, no image/size/units toggles, no step photos on paper.
- No change to the on-screen recipe layout beyond adding the Drukuj button.

## Implementation Plan

### Phase 1: Drukuj button

- New client component `print-button.tsx` mirroring `share-button.tsx`'s shape: a `<button type="button" onClick={() => window.print()}>` with a lucide `Printer` icon + "Drukuj", taking a `className`.
- Wire it into `recipe-actions.tsx` beside "Udostępnij"; keep the heart prominent, let the three buttons stack below sm and share the row from sm (`sm:flex-wrap`). Mark the actions row `print:hidden`.
- Tests: a unit test that the button renders "Drukuj" and clicking calls `window.print()`; update `recipe-actions.test.ts` to assert the Drukuj button is present and the existing structure/regex still holds.

### Phase 2: Print stylesheet + strip chrome

- `globals.css`: add one `@media print` block — white background, black text, sensible `@page` margins, a generous readable base size, single-column flow, `break-inside: avoid` on ingredient rows and steps, drop link underlines, and reset the header cover's below-lg full-bleed negative margins so it prints as a small block.
- Add `print:hidden` to the shared chrome: `AppHeader` `<header>`, `SiteFooter` `<footer>`.
- Add `print:hidden` to the recipe page's screen-only parts: the list-bar/breadcrumbs row, the on-photo source badge, the versions bar, the author line, the actions row (Phase 1), cooking-mode, "Wyczyść zaznaczenia", the step-photos toggle, step-photo figures, the video section, the gallery, the locked-gallery teaser, prev/next nav, "wersje dania", "podobne przepisy", and the owner buttons.
- Cap the cover size for print (`print:max-w-[...]`, small) so it reads like the reference.

### Phase 3: Print-only source + URL footer

- In `page.tsx`, render a `hidden print:block` footer at the end of the recipe content: `Źródło: {formatSource(...)} · {canonicalUrl without protocol}` (add the `formatSource` import together with its use). It must not be a `<footer>` element reused by any hide rule.
- Test: a unit test that the print footer renders the source text and the canonical URL and is `print:block` / `hidden` on screen.

## Risks

- Many `print:hidden` touch points across components — low risk (additive presentational classes) but easy to miss one; verify by print-preview reasoning and a page screenshot.
- `@media print` must stay inside the media block so `pnpm test:reflow` (screen media) is unaffected.
- The recipe header cover is full-bleed below lg; print must reset those negative margins or the image overflows the sheet.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Drukuj button

- [x] 1.1 Add print-button.tsx client component — 25395c5
- [x] 1.2 Wire Drukuj into recipe-actions + print:hidden on the row — 25395c5
- [x] 1.3 Tests for print button + updated recipe-actions test — 25395c5

### Phase 2: Print stylesheet + strip chrome

- [x] 2.1 Add @media print block to globals.css — 25395c5
- [x] 2.2 print:hidden on shared header/footer — 25395c5
- [x] 2.3 print:hidden on recipe-page chrome + cover print sizing — 25395c5

### Phase 3: Print-only source + URL footer

- [x] 3.1 Add hidden print:block source/URL footer (RecipePrintFooter) in page.tsx — 25395c5
- [x] 3.2 Test for the print footer — 25395c5

Status: complete. Full gate green (typecheck, lint, test 1761, test:reflow 109). /simplify applied: centralized the cover print layout into a `.recipe-print-cover` rule, fixed the globals.css selector/comment drift, simplified a brittle test regex; skipped the shared-component (SourceBadge) centralization to keep the change off other pages.
