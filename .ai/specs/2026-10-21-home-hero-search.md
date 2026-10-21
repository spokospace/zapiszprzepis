# Home hero: one column, search first (handoff 14, variants 3a/3b)

## 📝 TLDR

The home page hero is a two-column block: search on the left, "Przepis dnia" on the right, with the voice button inside the field (from `lg`), a small grey 18 px label (bold only for members), "Często szukane" far below the fold for guests only, and a "N przepisów wymaga uwagi" banner in the signed-in hero. Handoff 14 (accepted by the owner for desktop, variants **3a** guest and **3b** signed in) proposes a single centered column where searching is the only task at the top, with "Przepis dnia" as its own block under a rule. This spec describes that **future** layout; it is a layout and copy change, not a logic change.

## 📝 Problem Statement

The audience is mostly older adults. Observed on `master` (`3796761`):

- `src/app/page.tsx`: `Hero` is a two-column grid (`repeat(auto-fit,minmax(min(100%,25rem),1fr))`) with the search and greeting on the left and `RecipeOfTheDay` on the right; `GuestHome` renders `PopularSearches` *below* the hero; `MemberHome` puts `AttentionBanner` under the field.
- `src/app/components/home/home-search.tsx`: the `attached` field puts "Powiedz" inside the pill from `lg` and below it only on a phone; the label is visible but small and grey (`text-[18px] text-ink-soft`), bold only for members (`strongLabel`).
- `src/lib/home.ts`: `homeGreeting` returns "Dzień dobry, {wołacz}!"; `POPULAR_SEARCHES` has 6 terms (`sernik, pierogi, rosół, szarlotka, naleśniki, zupa pomidorowa`).

The handoff's own claim is that a visible label, search as the single task and "Często szukane" next to the field are easier for older users; no usage data exists in the repo to confirm it (it is the owner's design decision).

**Limitation:** the handoff files (`design_handoff_hero_wyszukiwarka/README.md`, `Hero - propozycje.dc.html`) are not in the repository. This spec transcribes the README as quoted in issue #426. The README also names files that do not exist: `notification-bell.tsx` (today the notifications entry is the "Powiadomienia" row and counter in `app-menu.tsx`, and the Menu-button dot) and `recipe-search.tsx` (the field is `home-search.tsx`).

## 📝 Proposed Solution

Rework `Hero` into a one-column, centered composition and move "Często szukane" into it; keep every behaviour component as is.

Alternatives considered:

- **Keep two columns, only add the label/voice row** — rejected: the owner accepted 3a/3b, whose point is one task at the top.
- **A new search component** — rejected: `HomeSearch` already owns the form, the voice flow (`useVoiceField`, `ListeningScreen`) and `compact`/`attached` modes used on `/szukaj` and "Moje przepisy". A new `layout` variant of `attached` is smaller and keeps one voice implementation.
- **Change `POPULAR_SEARCHES` to the handoff's 5 terms** — rejected: the list also feeds the header search panel and the `/szukaj` quick bar via `popularMinusRecent`; the hero shows a slice instead.

## 📝 Architecture

- **Primary modules:** `src/app/page.tsx` (`Hero`, `GuestHome`, `MemberHome`), `home/home-search.tsx`, `home/popular-searches.tsx`, `home/recipe-of-the-day.tsx`, `src/lib/home.ts` (greeting).
- **Reused as is:** `useVoiceField`, `ListeningScreen`, `SEARCH_PATH`/`searchPath`, `getRecipeOfTheDay`, `formatSource`/`SourceBadge`, `buttonClasses`, `CardCarousel` rows below the hero.
- **Hero** (`page.tsx`): a single centered column; it no longer receives `recipeOfDay`. "Przepis dnia" is rendered by the page *after* the hero, under its own rule, so the hero contains only heading, subtitle, search block, voice row and "Często szukane".
- **`HomeSearch`:** the `attached` field loses the in-field "Powiedz" at every width; a new voice row ("albo" + "Powiedz, czego szukasz") renders under it when `micSupported`. `/szukaj` and "Moje przepisy" (non-`attached`) are untouched. The label becomes 19 px bold `#111827` at both access levels.
- **`PopularSearches`:** gains a hero presentation (centered, under a 1 px `#d1d5db` rule, lead-in text, 52 px pills with a 2 px `#6b7280` frame, 5 pills on desktop and 4 on a phone via a `max-sm:hidden` fifth pill). The standalone section under the hero is removed. It now shows for **both** guest and member homes.
- **`RecipeOfTheDay`:** becomes a two-column block (7fr/5fr, gap 40) from `md`: 360 px photo left, text right with an explicit "Zobacz przepis →" link; one column below `md`.
- **`AttentionBanner`:** no longer rendered on the home page. The component, `failedShares` data and the notification entries stay (menu row + counter, Menu-button dot); only the hero render is dropped, and with it the now-unused prop plumbing on `MemberHome` if nothing else reads it.
- **Cross-system effects:** none outside the home page, except `homeGreeting`'s copy. No query, schema or route changes; the page already loads the vocative and the recipe of the day.

## 📝 UI/UX

Values are the handoff README's, checked against `CLAUDE.md` where noted.

**Desktop, guest (3a) and signed in (3b)**
- Hero: white, `padding: 64px 28px 52px`, centered column, `gap: 18px`.
- H1 64 px / 800 / 1.02, `#111827`. Guest "Czego dziś szukasz?"; signed in "Czego dziś szukasz, {wołacz}?", falling back to "Czego dziś szukasz?" when the vocative is missing (`homeGreeting` changes copy only).
- Subtitle 20 px `#374151`. Guest: "Przepisy z internetu w jednym miejscu. Zawsze pod ręką, kiedy gotujesz." Signed in: "Szukaj w swoich przepisach i ulubionych albo we wszystkich."
- Field block max 780 px: visible `<label for>` "Wpisz nazwę dania lub składnik" (19 px bold); form `role="search"`; field 68 px, 2 px `#111827` frame, pill, `padding: 0 5px 0 24px`; input 19 px, placeholder `#4b5563` ("np. sernik, zupa z dyni, kurczak" for guests, "np. zupa z dyni" for members); submit "Szukaj" (text only, 56 px, `bg-action` + white, 19 px bold; hover `#9a3412`).
- Voice row: "albo" (18 px `#374151`) + "Powiedz, czego szukasz" (52 px, 2 px `#111827` pill, `Mic` 22 px). Same handler as today's "Powiedz".
- "Często szukane": rule `1px #d1d5db`, lead-in "Nie wiesz, co wpisać? Kliknij jedno z najczęściej szukanych:" (18 px bold), pills 52 px / 2 px `#6b7280` / 18 px bold; click = search for that term (existing `searchPath` link).
- "Przepis dnia": `margin: 0 28px`, `border-top: 1px solid #111827`, `padding: 32px 0 48px`, grid 7fr/5fr; whole block is a link (`aria-label="Przepis dnia: {tytuł}"`); photo 360 px, 4 px radius, no shadow, source tab as on cards (already built in Phase 2 of style 1b); label "PRZEPIS DNIA" (16 px bold, uppercase via CSS, `#9a3412`), title 40 px / 800, subtitle 20 px, "Zobacz przepis →" 19 px bold `#9a3412`, underlined; hover `opacity: .92`.
- Signed in: no attention banner in the hero.

**Phone (3c/3d) — proposal, not accepted.** Left-aligned, padding `28px 16px 24px`, H1 36 px, 60 px field with a 50 px "Szukaj", full-width 52 px voice button, 4 popular pills, "Przepis dnia" with a full-bleed 220 px photo and a 28 px title. Default in this spec: **keep today's phone layout** except the changes that are not layout-specific (visible label, voice button outside the field — already the phone behaviour — "Często szukane" in the hero for both audiences, banner removed). Adopting 3c/3d is a one-phase follow-up.

**Accessibility.** WCAG 2.2 AA: the 2 px `#6b7280` pill frame is 4.8:1 on white (≥ 3:1); `#9a3412` text on white is 7.3:1; `#c2410c` only as a background with white text; every control ≥ 48 px (pills 52 px, field 68 px); focus `3px solid #1d4ed8`, offset 2 px; links underlined ("Zobacz przepis →"); the "Przepis dnia" block is one link whose accessible name carries the title. The label stays associated with the input through `htmlFor`/`id`.

**Suggestions panel.** The handoff says the suggestions panel "opens under the field at the block width". On `master` the home field has **no** suggestions: `header-search.tsx` / `header-search-panel.tsx` serve the signed-in desktop header on pages other than `/` (the header search is hidden on `/`). Showing suggestions on the hero field would be a new feature; this spec does not add it (see Q4).

Prototype: not in the repository (see Problem Statement).

## 📝 Edge Cases & Failure Scenarios

- **No Web Speech API:** `micSupported` is false → no voice row and no "albo"; the layout does not leave a gap (the row is rendered conditionally).
- **No recipe of the day** (`getRecipeOfTheDay` returns null): the "Przepis dnia" block and its rule are omitted entirely; the hero still ends with "Często szukane".
- **Long recipe title:** 40 px title wraps (`break-words`); on 7fr/5fr below `lg` the grid collapses to one column from `md`.
- **Vocative missing or uncertain:** H1 falls back to "Czego dziś szukasz?"; the comma and name are never shown for a nominative or guessed form (existing rule in `homeGreeting`).
- **Large system font / text scale:** the centered column and 780 px block shrink with `width: 100%`; pills wrap (`flex-wrap`); the 320 px reflow check (`pnpm test:reflow`) must pass with the 64 px H1 reduced on small screens (`text-[36px] lg:text-[64px]`).
- **Failed imports are no longer announced on the home page.** The notifications menu row, its counter and the Menu-button dot remain. Anyone who relied on the banner now has to open the menu; see Risks.
- **JS disabled:** the search form is a plain GET form and the popular pills are links, so both work without JS (as today).

## 📝 Risks & Impact Review

- **Reversibility:** high — markup and copy only, no data or contract changes; a revert restores the previous hero.
- **Removing the attention banner is a product trade-off.** `attention-banner.tsx` was added in E01-S15/E01-S31 because "older users often miss the badge alone". The handoff removes it and points to the notifications menu; a dedicated error channel for the administrator is out of scope. Impact: members with failed imports see no prompt on the home page. Mitigation: none in this change; the owner has accepted it in the handoff. Recorded as Q3.
- **Shared list.** `POPULAR_SEARCHES` also feeds the header search panel and the `/szukaj` quick bar; this spec leaves it untouched and slices it in the hero.
- **Unrelated screens.** `HomeSearch` is also used on `/szukaj` (`compact`) and "Moje przepisy"; changes are scoped to the `attached` path and covered by existing tests.
- **Layout shift.** "Przepis dnia" moves from the hero's right column to a block below; images load lazily so the hero's first paint is text only (a plus for LCP, not measured here).
- **Handoff accuracy.** File names and the suggestions-panel claim in the README do not match the repo; implementation follows the repository.

## 📋 Phasing

Each phase is its own PR, green on `pnpm typecheck && pnpm lint && pnpm test && pnpm test:reflow`, and leaves the page usable.

1. **Phase 1 — Hero copy, label, voice row.** New heading/subtitle copy, visible label, in-field "Powiedz" removed with the new voice row, 68 px field and text "Szukaj" button. Interim look: the hero keeps two columns.
2. **Phase 2 — "Często szukane" into the hero; banner out.** Hero presentation of `PopularSearches` for both audiences, standalone section removed, `AttentionBanner` removed from the home page.
3. **Phase 3 — One column and "Przepis dnia" block.** Hero becomes one column; `RecipeOfTheDay` is rendered after it as a 7fr/5fr block with the new typography and link.
4. **Phase 4 (optional, needs owner confirmation).** Phone layout 3c/3d.

## 📋 Implementation Plan

### Phase 1 — Hero copy, label, voice row
1. `src/lib/home.ts`: `homeGreeting` → "Czego dziś szukasz, {wołacz}?" / "Czego dziś szukasz?". Update `home.test.ts`. Test: both cases and a blank/undefined vocative.
2. `home-search.tsx` (`attached`): visible label for both audiences (19 px bold), 68 px pill field (`lg`) with the text "Szukaj" (no icon), remove the in-field "Powiedz" and add the voice row ("albo" + 52 px "Powiedz, czego szukasz"), rendered only when `micSupported`. Update `home-visuals.test.ts` / `home-search.test.ts`. Test: label `for` matches the input id; no `lg:inline-flex` voice button inside the field; the voice row exists once.
3. `page.tsx`: pass the new subtitle/placeholder copy for guest and member. Test: snapshot-style assertions on the strings.

### Phase 2 — "Często szukane" into the hero; banner out
1. `popular-searches.tsx`: `variant="hero"` — rule, lead-in text, 5 pills (4 on a phone), 52 px / 2 px `#6b7280` pills; keep the default variant if another caller needs it, else delete it. Test: renders the first five terms; the fifth carries `max-sm:hidden`; every pill is a link to `searchPath(term)`.
2. `GuestHome` and `MemberHome` render it inside the hero; remove the standalone `<PopularSearches />` from `GuestHome`. Test: `PopularSearches` appears exactly once per home.
3. Remove `AttentionBanner` from `MemberHome` (and any dead `failedShares` plumbing); keep the component file only if tests or other screens use it, otherwise delete it with its test. Test: the signed-in home markup contains no "wymaga uwagi".

### Phase 3 — One column and "Przepis dnia" block
1. `Hero` → single centered column (`flex-col items-center text-center`, field block `max-w-[780px] text-left`); drop the `recipeOfDay` slot. Test: no grid template in the hero markup.
2. `RecipeOfTheDay`: rule + 7fr/5fr block, 360 px photo, 40/20 px text, "Zobacz przepis →"; `page.tsx` renders it between the hero and the card rows only when a recipe exists. Test: link `aria-label`, absence when null, underlined "Zobacz przepis".
3. Visual and keyboard check as guest and as `qa-free`/`qa-full` via `/api/dev/login` (no recipes added as QA); `pnpm test:reflow` at 320 px.

### Phase 4 — Phone layout (only after confirmation)
1. Left-aligned hero below `md`, H1 36 px, 60/50 px field, full-width voice button, 4 pills, full-bleed 220 px "Przepis dnia" photo. Test: class assertions and `pnpm test:reflow`.

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why | Confirm? |
|---|----------|-----------------|-----|----------|
| Q1 | Adopt the phone layout 3c/3d? | No — keep today's phone layout; Phase 4 is optional | The handoff calls it a proposal "to be confirmed" and says the current phone layout may stay | reversible |
| Q2 | Which popular terms does the hero show? | The first 5 of the existing `POPULAR_SEARCHES` (4 on a phone); the list itself is unchanged | The list also feeds the header panel and `/szukaj`; the handoff allows "data from the current source" | reversible |
| Q3 | Remove the attention banner from the member hero? | Yes, as the handoff states; notification entries in the menu stay | Explicit owner decision in the handoff; the banner's removal is a product trade-off recorded under Risks | reversible |
| Q4 | Add suggestions under the hero field? | No — the home field has none today; adding them is a new feature | The "no logic changes" rule; the handoff's wording assumes a panel that is not on the home page | reversible |
| Q5 | Show "Często szukane" to signed-in users too? | Yes | Handoff 3b says "ta sama sekcja co u gościa" | reversible |
| Q6 | Handoff files are not in the repo | Treat the issue's transcription as authoritative; repo file names win over the README's | Values were quoted in #426; two README file names do not exist | reversible |
