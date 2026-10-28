# Execution plan — recipe page per the 2026-10-28 handoff (#590)

Engine: om-auto-create-pr (steps: 5, --loop: no)
Goal: bring `/przepis/[slug]` in line with the 2026-10-28 handoff for the parts that are not already on master.
Issue: #590 (Closes #590)
Spec: #593 (Refs #593), `Source doc: .ai/specs/2026-10-28-recipe-page-handoff.md` (design-only PR, not changed here)

## Scope

Already on master, checked against the spec before planning (no work needed):

- Source badge on the photo, and no "Źródło:" line or "Oryginał" button (`recipe-header.tsx`, `recipe-actions.tsx`).
- Subtitle under the title (`recipe-header.tsx`).
- "Ma dodatkowo:" / "Nie ma:" labels (`dish-versions.tsx`).
- Ingredient ticks with a persisted per-tab state (`recipe-checklists.tsx`, `lib/recipe-checklist.ts` already has a `steps` kind).
- Guest gallery lock (`locked-gallery.tsx`), kept per A1.
- "Wielkość tekstu" on `/wyswietlanie`, not on the recipe page, per A2.

In this run:

- Rename "Tryb gotowania" to "Zacznij gotować" (label only; `cooking-mode.tsx` logic unchanged).
- "Mamy jeszcze N…" bar becomes the plain link "Inne przepisy na {danie} (N) ↓".
- Steps can be ticked: numbered button with `aria-pressed`, struck-through done state, "Teraz" on the first open step, "N z M kroków zrobione" with a progress bar, "Gotowe! Smacznego." when all are done. State is kept in sessionStorage through the existing `steps` kind.

Non-goals / deferred to a follow-up (not in this run):

- Hero action row restyle ("Zacznij gotować" black + "Zapisz" outline, quiet "Drukuj" / "Udostępnij" row).
- Gallery thumbnails under the main photo for signed-in users (the separate "Zdjęcia" block stays for now).
- Time strip with icons.

Non-goals (kept): no portion calculator, no timers, no temperature labels; no schema, route or server-action change; ingredient grouping bug is reported, not fixed.

## Risks

- Step ticking reverses an owner decision recorded in `recipe-checklists.tsx` ("ticking is for ingredients", 2026-10-20). The 2026-10-28 handoff, from the same owner, asks for it. Flagged in the PR for confirmation.
- The `steps` kind exists in `lib/recipe-checklist.ts` but was never rendered, so `recipe-checklists.test.ts` may assert that steps have no buttons; those assertions are updated, not removed.
- The spec overstated the gap on the hero and source badge; the PR body corrects this.

## Implementation Plan

### Phase 1: wording and links

1.1 Rename the cooking-mode entry: `cooking-mode.tsx` title and sr-only prefix to "Zacznij gotować"; update `recipe-actions.test.ts` and the doc comments in `recipe-actions.tsx`, `recipe-checklists.tsx`.

1.2 Versions bar: `lib/dish-versions.ts` `versionsBarLabel` returns "Inne przepisy na {danie} (N)"; `dish-versions-bar.tsx` renders it as a plain underlined link to `#inne-przepisy` with a ChevronDown, no yellow box; update `lib/dish-versions.test.ts` and `dish-versions.test.ts`.

### Phase 2: step ticks

2.1 `recipe-checklists.tsx`: each step gets a 48 px numbered button (`aria-pressed`, `aria-label` "Krok N — oznacz jako zrobiony" / "Krok N — zrobiony, cofnij"), toggling `steps` via `toggleChecked` and `setRaw` like ingredients. Done steps are greyed and struck through.

2.2 Progress: heading line "N z M kroków zrobione", a 6 px bar with `role="progressbar"`, a "Teraz" marker on the first unticked step when at least one is ticked, and the `role="status"` message "Gotowe! Smacznego." when all are ticked.

2.3 Tests in `recipe-checklists.test.ts`: a tick round-trips through the stored state, the progress text is correct for 0, some and all ticked, the "Teraz" marker moves, no-step and one-step recipes render, and the "Wyczyść zaznaczenia" reset clears steps too.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: wording and links

- [ ] 1.1 Rename the cooking-mode entry to "Zacznij gotować"
- [ ] 1.2 Versions bar becomes the plain link "Inne przepisy na … (N) ↓"

### Phase 2: step ticks

- [ ] 2.1 Numbered, ticked steps with aria-pressed
- [ ] 2.2 Progress text, "Teraz" marker, done message
- [ ] 2.3 Tests for step ticks and the reset
