# Execution plan — Recipe page design fidelity (C3 / A4 / A5 / A9)

Source doc: .ai/design/przebudowa-handoff/README.md (sections "C3 / A4 / A5 — Przepis", "Desktop (A8, A9)", "Design Tokens")
Design files: `Propozycja C - wysoka czytelność.dc.html` (C3), `Propozycja A.dc.html` (A4, A5, A9)
Epic: #201 (Refs only — never a closing keyword)
Branch: `claude/admiring-goldberg-rbngtn` (the session's designated branch; replaces the default `feat/<slug>`)

## Goal

Close the remaining gaps between the live recipe page (`/przepis/{slug}`, master f08b117) and
the final design handoff, so the page matches C3 on phones and A9 on desktop.

## Audit (2026-10-19)

Compared production (master f08b117, guest, 390 px and 1280 px) with the rendered artboards C3,
A4, A5 and A9. Everything in the E01 checklist (S07, S07b, S16, S21, #322) is in place: order of
sections, 4:3 photo, source line, author line, 58 px favourite, text size, cooking mode,
ingredient ticks, "Krok N z M", locked gallery, original button, stacked prev/next, tags and
"Podobne". The gaps left are:

| # | Where | Now | Handoff |
|---|---|---|---|
| G1 | Desktop header column (A9, README Desktop) | favourite sits in a row below the whole header; "Otwórz oryginał" is an inline link in the source row; no share | title column holds the 54 px buttons "W ulubionych / Udostępnij / Oryginał" |
| G2 | Desktop times (A9, README Desktop) | only the "Kategoria · czas" line | "Przygotowanie / Gotowanie / Łącznie" with 20 px bold values |
| G3 | Desktop list bar + breadcrumbs (A9) | boxed list bar; breadcrumbs above the title | one row: "← {lista} · N z M" left, "Przepisy › {Kategoria}" right |
| G4 | Mobile list bar (A4) | bordered rounded box, "←" glyph, 17 px bold count | flat row with a bottom rule, arrow icon 20 px, label 18 px, "N z M" 16 px secondary |
| G5 | Desktop end of page (A9) | the outlined "Otwórz oryginał na …" button also shows on desktop | desktop has "Oryginał" in the header only |
| G6 | Typography (C3, README tokens) | title line-height 1.25; recipe H2s 26 px; "na N porcji" under the heading | title line-height 1.15; H2 22–24 px; "Składniki" and "na 4 porcje" on one row |
| G7 | Locked gallery (A5) | accent `#fff7ed` box, 2 px dashed border, 19 px text, 56 px button | neutral `#f9fafb` box, 1.5 px dashed `#d1d5db`, lock 26 px, 18 px text, 48 px dark button |
| G8 | Signed-in gallery (A9) | raw `text-gray-900` / `bg-gray-100` / `text-2xl` | tokens; heading like the page's other H2s; thumbnails radius 12 |
| G9 | Prev/next (C3, A9) | no rule above; neutral arrows | 2 px top rule above the stacked buttons (C3); accent arrows on desktop (A9) |
| G10 | Small C3 details | "Wielkość tekstu" label `#374151`; favourite label 18 px | label `#111827`; favourite label 19 px |

## Scope

- `src/app/przepis/[slug]/page.tsx` and `_components/` (header, actions, checklists, list bar, locked gallery).
- `src/app/components/recipe-gallery.tsx`, `src/app/components/favorite-button.tsx` (full size label only),
  `src/app/components/ui/text-size-controls.tsx` (label colour only).
- New: `src/lib/recipe-meta.ts` `recipeTimeStats`, a `ShareButton` client component and a pure share helper.
- Unit tests for every changed behaviour.

## Non-goals

- The site header (logo, "← Wróć", bell, MENU): owned by #320/#321/#323/#324. CLAUDE.md says
  `app-header.tsx` is the source of truth there, not the `.dc.html` files.
- ~~"Udostępnij" on phones~~ — superseded 2026-10-19: the owner asked for it on phones too (Phase 4).
- "Dodała {autor} · 12 października" (A4/A9 date): not in the README's C3 list; skipped.
- A4's numbered step circles and the A4 times tiles on mobile: 1c (C3) replaced them.
- "Podobne" as a 2-column grid on phones (A5): #311 deliberately made it a carousel.
- Cooking mode, dish versions, tags: already per handoff (S08, S21, #322).
- Any data, schema or migration change.

## Implementation Plan

### Phase 1 — Desktop header (A9)

1.1 Add `recipeTimeStats(recipe)` to `src/lib/recipe-meta.ts`: the known "Przygotowanie /
    Gotowanie / Łącznie" values, `≈` when estimated, nothing when no time is known. Unit tests.
1.2 Add a `ShareButton` client component ("Udostępnij", share-2 icon with its label): Web Share
    API when available, else copy the canonical URL to the clipboard and say "Skopiowano link"
    in a `role="status"` region; a cancelled share is silent; a failure says so. The decision
    logic is a pure helper with unit tests.
1.3 Header text column: an `actions` slot under the author line (mobile order unchanged: author →
    description → versions bar → favourite). From lg the actions are a row of 54 px buttons
    "W ulubionych / Udostępnij / Oryginał"; below lg only the full-width favourite (C3).
    Deviation: the three labels do not fit one row of the ~480 px column without breaking a
    word, so the heart spans the column and the other two sit side by side under it. From lg the
    times row (G2) replaces the "Kategoria · czas" line; the inline "· Otwórz oryginał" link goes.
    The bottom "Otwórz oryginał na …" button becomes `lg:hidden` (G5). Header tests.
1.4 List bar: a flat row with a bottom rule, arrow icon, 18 px label, 16 px secondary count (A4).
    From lg the row also carries the breadcrumbs on the right, and the header's breadcrumbs
    are hidden there (A9). Tests for the bar markup.

### Phase 2 — Mobile and shared details (C3 / A5)

2.1 Typography: title line-height 1.15; the recipe page's H2s at 24 px; "Składniki" and
    "na N porcji" on one baseline row (C3).
2.2 Locked gallery per A5 (G7) and signed-in gallery on tokens (G8). Update the locked-gallery test.
2.3 Prev/next: 2 px top rule above the block (C3), accent arrows (A9). "Wielkość tekstu" label in
    `text-ink`, favourite label 19 px (C3).

### Phase 4 — "Udostępnij" on phones (owner request, 2026-10-19)

4.1 Render "Udostępnij" at every width: below lg a full-width outlined button under the heart
    (where a phone's share sheet is most useful), from lg unchanged beside "Oryginał". "Oryginał"
    stays desktop-only; phones keep the end-of-recipe original button (C3, item 11). Tests,
    gate, reflow guard and a fresh phone screenshot.

### Phase 3 — Verification

3.1 Full gate (`pnpm typecheck`, `pnpm lint`, `pnpm test`), the reflow guard at 320 px against a
    local guest dev server (public read-only Supabase values from `wrangler.jsonc`), and
    before/after screenshots at 390 px and 1280 px.

## Verification notes (3.1)

- Gate: `pnpm typecheck` ✓, `pnpm lint` 0 errors (2 pre-existing warnings in `public/sw.js` and
  `src/app/login/signin-form.tsx`), `pnpm test` 1245/1245 ✓.
- Reflow guard (`e2e/reflow.spec.ts`, guest screens against a local dev server): 20 passed,
  20 skipped (signed-in screens; no QA login here). Two long-content runs ("recipe, all text"
  and "cooking mode") failed on master f08b117 as well; the cause was three flex items that
  never shrank below their longest word ('Ten przepis jest' tag buttons, 'Kolejność:',
  'Ekran nie wygaśnie'). Fixed in a3fbe7a; the first run also caught this change's own locked
  gallery and servings row (0a27ef9).
- Screenshots: `.ai/qa/recipe-page-design-fidelity/` (production before, local after).

## Review (om-auto-review-pr)

- Merged master (5 PRs ahead, no conflicts) into the branch; gate on the merged head 2cfdc74:
  typecheck ✓, lint 0 errors, 1273/1273 tests ✓.
- Fixed: the "Skopiowano link" confirmation now fades after 5 s (2cfdc74).
- Follow-up candidate (pre-existing, outside the diff): the gallery lightbox's icon-only buttons and
  14 px counter.

## Risks

- Moving the favourite into the header column must keep the mobile order and the 58 px
  full-width button (C3); covered by header tests and screenshots.
- The share fallback depends on the Clipboard API, which needs a secure context; when both are
  missing the button reports a failure instead of doing nothing.
- Signed-in screens (grid gallery, favourite toggle) cannot be checked in this environment: no
  QA login (no service-role key). Guest screens are verified; signed-in ones are reported as
  unverified.

## Progress

PR: #327

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Desktop header (A9)

- [x] 1.1 Time stats helper with tests — 18d8a16
- [x] 1.2 Share button with a tested share helper — a599a77
- [x] 1.3 Header column actions, desktop times, original button placement — 32dfe76, 29214ff
- [x] 1.4 Flat list bar with desktop breadcrumbs — 4132672

### Phase 2: Mobile and shared details (C3 / A5)

- [x] 2.1 Title, H2 and servings typography — 9b03a0a
- [x] 2.2 Locked gallery and signed-in gallery styling — b0e42f8
- [x] 2.3 Prev/next rule, accent arrows, text-size label and favourite label — 665a9bd

### Phase 3: Verification

- [x] 3.1 Full gate, reflow guard and screenshots — 0a27ef9, a3fbe7a

### Phase 4: Share on phones

- [ ] 4.1 "Udostępnij" at every width, with tests and a phone screenshot
