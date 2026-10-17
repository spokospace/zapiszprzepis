# E01-S20 — Home page visuals per design handoff (C1/A1)

Source doc: .ai/design/przebudowa-handoff/README.md
Issue: #280 (epic #201). Gaps: .ai/analysis/2026-10-17-design-gap-audit.md §1.

## Goal
Bring the guest (A1) and signed-in (C1) home page in line with the handoff, without breaking the S15 banner, S05 search or the S17 desktop layout.

## Scope
- `src/lib/recipe-categories.ts`: a category → lucide icon map.
- `src/app/components/home/*`: category tiles (guest/member variants), dark guest CTA, shortcut rows with chevron, search field variants (guest hero: orange border, mic inside the field; member: "Czego szukasz?" + "Szukaj").
- `src/app/page.tsx`: guest H1 28 px + hero description; drop the add form / access gate left over from before S10.

## Non-goals
- Header (S19), recipe page (S07b), login (S12b), settings (S13b).
- /szukaj and "Moje przepisy" search fields keep their current look.
- Counters in shortcut captions ("24 dodane przez Ciebie") — needs data the home does not load.

## Risks
- HomeSearch is shared with /szukaj and /recipes: the new looks are opt-in props, defaults unchanged.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Home visuals

- [ ] 1.1 Category icon map and tile variants
- [ ] 1.2 Guest CTA and member shortcut rows
- [ ] 1.3 Search field variants and hero copy
- [ ] 1.4 Remove the leftover add form from the member home
- [ ] 1.5 Tests for the home components

### Phase 2: Verification

- [ ] 2.1 Browser check guest/signed-in, mobile/desktop
- [ ] 2.2 Local gate (typecheck, lint, test)
