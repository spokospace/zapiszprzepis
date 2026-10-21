# Visual style 1b across the app (handoff 13)

## 📝 TLDR

The owner's handoff "Przebudowa aplikacji przepisów 13" (2026-10-21) replaces the current visual language (14/16 px rounded cards with grey frames, tinted `#fff7ed` tiles, rounded-rectangle buttons, bordered-tile menu categories) with variant **1b**: pill buttons, 4 px tiles/cards/photos, a flat menu list, hairline section rules and white section backgrounds. This is a **future, appearance-only** change delivered in four independently shippable phases (tokens + buttons → cards/home → menu + header → recipe page + remaining screens). No logic, data or contract changes.

## 📝 Problem Statement

Today the app renders the 2026-10-20 handoff (#404). Observed in the repo at `master` (`4a38e67`):

- `src/app/globals.css`: `--radius-field: 14px`, `--radius-card: 16px`, `--radius-pill: 999px`; tinted `--color-surface-accent: #fff7ed` / `--color-border-accent: #fed7aa`.
- `rounded-field` is used in 32 component files, `rounded-card` in 12, `rounded-pill` in 13, and 11 files carry ad-hoc `rounded-[8|10|12|14|16|20px]`.
- `ui/button.tsx` gives every variant `rounded-field`; `source-badge.tsx` uses `rounded-lg … shadow-sm`; `category-grid.tsx` tiles are `bg-surface-accent rounded-[12px]`.

The owner wants the app to match the new handoff, mainly corner radii, tiles and the menu, on **all** screens (including ones the prototype does not show). Because the radii are scattered, a screen-by-screen edit would leave inconsistencies; the work needs a token-first order.

**Limitation:** the handoff zip (`ZMIANY_prototyp_klikalny.md`, `designs/*.dc.html`) is **not in the repository** (no `designs/` directory). This spec transcribes the values stated in issue #418; the "visual comparison with the prototype" acceptance step needs the owner to supply the files (see Q6).

## 📝 Proposed Solution

Introduce a small set of radius/colour tokens, switch the shared primitives (`Button`, `Chip`, `buttonClasses`) first, then migrate screens group by group. Each phase is one PR that leaves the app consistent enough to ship on its own (see Phasing for the interim look).

Alternatives considered:

- **One big PR** — rejected: ~60 files, hard to review, and `pnpm test:reflow` regressions are hard to bisect.
- **Change token values in place only** (`--radius-card: 4px`) — rejected as the only step: it would also turn pill-intended controls and circles into 4 px shapes, and cannot express "no frame, no background" card layouts. Used as the first step, then components are edited.

## 📝 Architecture

- **Primary modules:** `src/app/globals.css` (tokens), `src/app/components/ui/button.tsx`, `ui/chip.tsx`, then consumers.
- **Token plan (Phase 1):**
  - `--radius-field` → `--radius-pill: 999px` for buttons/inputs-as-buttons; new `--radius-tile: 4px` for tiles, cards, photos and info frames. Keep `--radius-field` / `--radius-card` as deprecated aliases during the migration so unmigrated screens keep rendering, and remove them in the last step of Phase 4 once `grep` finds no use.
  - Replace the 11 ad-hoc `rounded-[..px]` usages with a token class.
  - Colour: white section backgrounds; orange only for primary action (`#c2410c` + white), category icons/labels (`#9a3412`) and notification counters; helper lines `#d1d5db` / `#e5e7eb`. No new raw hex in components — use the existing `bg-action`, `text-action-text`, `border-field` tokens.
- **Reused as-is:** `RecipeCard`, `FavoriteButton`, `SourceBadge`, `CardCarousel`, `AppMenu`, `buttonClasses()` — only classes change; props and behaviour do not.
- **Cross-system effects:** none outside the UI layer. Existing class-string assertions in tests (`button.test.ts`, `app-header.test.ts`, `source-badge.test.ts`, `recipe-card.test.ts`, `home-visuals.test.ts`, `app-menu*.test.ts`) must be updated with each phase; they are the safety net for "appearance only".
- **Dependency on #412** (open): mobile header captions 16 px / sentence-case "Menu" / 64×56 targets. Phase 3 (header) must land **after** #412 or fold it in — never re-implement it separately.

## 📝 UI/UX

Rule set from the handoff (§10 "Kierunek wizualny 1b"), as transcribed in #418:

**Principles.** Primary button `#c2410c` + white; secondary white with a 2 px `#111827` frame; section separators 1 px `#111827` above a 26–28 px heading; tiles/cards/photos/info frames 4 px; buttons pills.

**Phase 1 — tokens + buttons.** Button variants → pill; `outline`/secondary = 2 px `#111827` frame; `Chip` re-checked (already `rounded-pill`). Min heights stay 48/56/72 px.

**Phase 2 — cards, source badge, home.**
- `RecipeCard`: no frame, no background — photo (4 px, no outline) with text below (title 21 px bold, subtitle 17 px `#374151`); hover `opacity: .92` instead of image scale. Grids `repeat(auto-fill, minmax(200–220px, 1fr))`.
- Heart: the 48 px white circle already has the `0 2px 8px rgba(17,24,39,.22)` shadow (`favorite-button.tsx`); remove any remaining frame. Favorited state `#c2410c`.
- Source badge: white, no frame/shadow, `left:1px; bottom:6px`, `padding: 4px 12px 4px 10px`, `border-radius: 0 2px 2px 0`; on the recipe page it stays a link (underlined name + `ExternalLink`, 48 px target via a transparent button).
- Home: hero on white (H1 50 px/800 desktop, 32 px mobile); search = single pill (2 px `#111827`, 60/56 px, orange "Szukaj" pill inside, no shadow; desktop "Powiedz" 44 px pill); suggestion panel (2 px `#6b7280` frame, radius 16, shadow, 1 px `#e5e7eb` rows); recipe of the day = text **below** a 4 px photo (mobile: full-bleed 220 px, no radius), label "PRZEPIS DNIA" 16 px bold `#9a3412`; mobile category tiles white, 1 px `#111827`, 4 px, 3 columns, min-height 76 px under a 26 px "Kategorie" heading with a rule; attention banner and guest CTA per issue; card-row headings 28 px with a 1 px top rule, "Poprzednie/Następne" pills, "Pokaż wszystkie" as an underlined 18 px bold link.

**Phase 3 — menu + header.**
- Menu drawer: 2-column flat category list (56 px rows, 1 px `#d1d5db` lines, 20 px `#9a3412` icon + 17 px bold `#111827` name, hover `#f9fafb`); new first item "Strona główna" (24 px House icon, 19 px bold, 56 px, 2 px `#e5e7eb` line below) → `router.replace('/')`, `aria-current="page"` on `/`; "Powiadomienia" shows a counter (≥ 28×28 px, `#c2410c`, white 16 px bold, pluralised `aria-label`) instead of the dot, "Moje przepisy"/"Ulubione" counters stay grey; panel `overflow: hidden`, header bar `flex-shrink: 0`, only the list scrolls (`overscroll-behavior: contain`); open animation 200/280 ms, none under `prefers-reduced-motion`; desktop panel 460 px with the specified shadow.
- Header (≥ 1024 px): row 1 with 1 px `#111827` bottom line, wordmark, "Ulubione" text link, outlined "+ Dodaj przepis" pill (guest: "Zaloguj się"), "Menu"; row 2 scrollable category bar (`nav aria-label="Kategorie"`, "Więcej ›"/"‹ Wstecz"). **`CLAUDE.md` header decisions (#339, #340, #344) win** where they conflict, and `src/app/components/app-header.tsx` plus its tests stay the source of truth. `category-bar.tsx` already exists and is reviewed first rather than rebuilt.

**Phase 4 — recipe page + remaining screens.** Main photo and desktop ingredient frame 4 px; pill buttons on the recipe page (favourite, share, cooking mode, A/A+/A++, step photos toggle, version sorting, refresh/delete) with 2 px `#111827` secondary frames; "Poprzedni / Następny" nav (1 px `#111827` top line, buttons min-height 64 px, 1 px frame, 4 px); step photos 4:3, 4 px, no frame/caption; lightbox and cooking-mode photo 4 px; desktop footer (2 px `#e5e7eb` top line, `#f9fafb`, 19 px brand, 17 px links); tag filter result bar 4 px; account/auth, add-recipe, settings, notifications and public profile get the same pill/4 px rules.

**Accessibility (unchanged bar, all phases).** WCAG 2.2 AA: text ≥ 4.5:1, UI components and field borders ≥ 3:1, touch targets ≥ 48 px, visible focus (`outline: 3px solid #1d4ed8; offset 2px`), underlined links, no horizontal scroll at 320 px (`pnpm test:reflow`). Removing the card frame is allowed because the photo is the affordance; focus outline must still wrap the whole card link.

Prototype: not available in the repo (see Problem Statement).

## 📝 Edge Cases & Failure Scenarios

- **Heart over a light photo** — a white circle with shadow only may fall below 3:1 against a pale image. Verify on a sample of light/dark photos in Phase 2; if it fails, restore a 1 px `#6b7280` ring (the ring is a one-line change).
- **Frameless card in a grid** — cards without frames lose the visual boundary for keyboard focus; check the focus outline is not clipped by `overflow-hidden`.
- **Pill buttons with long labels** — `wrap-anywhere` multi-line labels in a 999 px radius look like a lozenge; allow `rounded-[28px]`-style max radius only if a visual check shows clipping, otherwise keep pills (min-height grows, radius caps at half height).
- **Unmigrated screen during phases** — aliases keep old tokens working so a half-migrated app has mixed 14 px and pill corners, never broken layout.
- **320 px reflow** — larger captions/targets in the header and 76 px category tiles are the likeliest reflow regressions; run `pnpm test:reflow` in every phase.
- **Dark/contrast of `#9a3412` labels on white** passes 4.5:1; `#c2410c` is used only as a background with white text.

## 📝 Risks & Impact Review

- **Reversibility:** high. Pure CSS-class changes; each phase reverts by reverting its PR. Deprecated token aliases mean a revert of a later phase never leaves a dangling token.
- **Blast radius:** every screen visually (risk-medium per the issue), but no auth, data, schema or public-contract surface; `BACKWARD_COMPATIBILITY.md`-style protected surfaces are not touched.
- **Product vs rule:** removing the card frame and the heart frame is an owner design decision, not a rule violation — provided the 3:1 check above passes. Header decisions in `CLAUDE.md` are an owner decision that the handoff does not override.
- **Test churn:** class-string tests change in every phase; reviewers should check updated assertions describe intent (pill/4 px), not just the new string.
- **Process risk:** without the handoff files the implementer relies on issue transcription; pixel-level disagreements are possible (Q6).

## 📋 Phasing

Each phase is its own PR, passes `pnpm typecheck && pnpm lint && pnpm test && pnpm test:reflow`, and leaves the app usable.

1. **Phase 1 — Tokens and buttons.** New tokens + aliases, `Button`/`Chip`/`buttonClasses`, removal of the 11 ad-hoc radii. Interim look: pill buttons, other surfaces unchanged.
2. **Phase 2 — Cards, source badge, home.** `RecipeCard`, `RecipeCardSkeleton`, `SourceBadge`, `FavoriteButton`, carousel/grid, home hero/search/recipe of the day/category tiles/banner/guest CTA.
3. **Phase 3 — Menu and header.** After #412 lands. `AppMenu`, `app-menu-model`, `AppHeader`, `HeaderNav`, desktop category row.
4. **Phase 4 — Recipe page and remaining screens.** Recipe page, cooking mode controls, lightbox, footer, tag filter, auth/add/settings/notifications/profile; remove deprecated aliases.

Follow-up (out of scope here): the "Wróć" return-point logic and the "Poprzedni" button's new behaviour (logic change; own story, Q2).

## 📋 Implementation Plan

### Phase 1 — Tokens and buttons
1. Add `--radius-tile: 4px`; keep `--radius-field`/`--radius-card` as aliases; set the button radius token to `999px`. Test: a unit test asserting `buttonClasses()` for each variant contains the pill class and not `rounded-field`.
2. Update `ui/button.tsx` variants (secondary = 2 px `#111827`) and re-check `ui/chip.tsx`. Update `button.test.ts`. Test: `pnpm test`.
3. Replace the 11 ad-hoc `rounded-[..px]` usages with token classes (pill for buttons, tile for photos/frames). Test: `grep -rE "rounded-\[[0-9]+px\]" src` returns none; `pnpm test:reflow`.

### Phase 2 — Cards, source badge, home
1. `RecipeCard` + skeleton: frameless layout, 4 px photo, text scale, hover opacity, auto-fill grids. Update `recipe-card.test.ts`.
2. `SourceBadge` per spec (position, padding, radius, no frame/shadow; link variant keeps 48 px target). Update `source-badge.test.ts`.
3. `FavoriteButton` icon variant: drop frame, keep shadow; measure 3:1 on sample photos (light and dark), restore a ring if it fails. Update `favorite-button.test.ts`.
4. Home: `home-search.tsx` pill, `header-search-panel.tsx` frame, `recipe-of-the-day.tsx` text-below layout, `category-grid.tsx` tiles, `attention-banner.tsx`, `guest-cta.tsx`, card-row headings/links. Update `home-search.test.ts`, `home-visuals.test.ts`.
5. Verify as guest and as `qa-free`/`qa-full` via `/api/dev/login` (no recipes added as QA); `pnpm test:reflow`.

### Phase 3 — Menu and header
1. Confirm #412 merged (otherwise fold its three edits in, once).
2. `app-menu-model.ts`: add the "Strona główna" item and the notification-counter model (pluralised `aria-label`); tests in `app-menu-model.test.ts`.
3. `app-menu.tsx`: flat 2-column list, non-scrolling header bar, animation with `prefers-reduced-motion`, desktop 460 px panel. Update `app-menu.test.ts`.
4. `app-header.tsx` / `header-nav.tsx`: desktop row 1 styling and row 2 category bar, reconciled with `CLAUDE.md` (#339/#340/#344); update `app-header.test.ts`.
5. Keyboard and focus check (Tab order, Escape, focus return); `pnpm test:reflow`.

### Phase 4 — Recipe page and remaining screens
1. Recipe page photo/frames and buttons (`text-size-controls.tsx`, `dish-versions-sort`, `cooking-mode.tsx` controls — appearance only).
2. Prev/next nav and step photos/lightbox radius.
3. `site-footer.tsx`, tag filter result bar.
4. Account/auth, add-recipe, settings, notifications, public profile.
5. Delete the deprecated radius aliases once `grep -rE "rounded-(field|card)" src` is empty; final `pnpm typecheck && pnpm lint && pnpm test && pnpm test:reflow`.

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why | Confirm? |
|---|----------|-----------------|-----|----------|
| Q1 | Ship as one change or phased? | Phased: four PRs as listed, one spec | The issue recommends it; keeps reflow regressions bisectable | reversible |
| Q2 | Ship the "Wróć" return-point logic and "Poprzedni" button here? | No — separate follow-up story | It is a logic change; the issue's overriding rule is appearance only | reversible |
| Q3 | Mobile footer? | None | The handoff says "to be decided"; smallest scope | reversible |
| Q4 | Overlap with #412 (mobile header captions)? | Land #412 first; Phase 3 builds on it without duplicating | Avoids two PRs editing the same header lines | reversible |
| Q5 | Heart without a frame — does it still meet 3:1? | Follow the handoff (shadow only), verify on sample photos in Phase 2, restore a 1 px ring if it fails | Keeps WCAG 2.2 AA as the hard constraint | reversible |
| Q6 | Handoff files missing from the repo | Treat the values in #418 as authoritative; the owner may add the handoff under the repo for a visual comparison | Pixel values come from the issue text, not the prototype | reversible |
