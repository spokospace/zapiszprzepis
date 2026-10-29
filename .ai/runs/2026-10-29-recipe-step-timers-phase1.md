# Recipe step timers — Phase 1 (in-page timers)

Tracking issue: #611. Refs #611 (not Closes).

## Goal
A reader on a recipe page can start a timer from a duration in a step ("30 minut"), see several running timers in a card stack and the Menu, and keep the screen on. Everything runs in the browser; no server, push, Inngest or migration.

Source doc: .ai/specs/2026-10-29-recipe-step-timers-push.md (Phase 1 only).

## Scope
- `src/lib/step-duration.ts`: pure parser `{ min, addMin } | null` for a step text (N minut/min, N–M minut, N godz./godzin; number words are not matched; range start at lower bound; addMin = difference rounded to 1/3/5).
- `src/lib/timer-store.ts`: localStorage (try/catch), endsAt-based remaining time, start/pause/resume/extend/end, pure reducer plus a thin storage adapter.
- `src/app/components/timer-provider.tsx`: context + one-second tick only while a timer runs; mounted in the root layout.
- Recipe step renderer (`src/app/przepis/[slug]/_components/recipe-checklists.tsx`): duration button (link-styled, `aria-label` "Włącz minutnik: {name}, {min} min"); running state text and badge.
- `timer-cards.tsx`: fixed bottom-right stack, `role="region"` "Minutniki", ended state `role="status"`.
- `app-menu.tsx`: "Minutniki" section at top (list, empty state, custom timer 1–180 min); `app-header.tsx`: count badge on the Menu button.
- Keep-screen-on switch (`role="switch"`), Wake Lock API, hidden when unavailable.

## Non-goals
- No `/api/timers`, no `push_subscriptions`/`timers` tables, no Inngest, no service worker changes, no notification consent dialog (Phase 2).
- No changes to cooking mode, text size, menu structure beyond the new section, or the recipe redesign.

## Implementation Plan

### Phase 1: In-page timers
- Step 1.1 Duration parser `src/lib/step-duration.ts` with unit tests (handoff examples, ranges, number words, godz.).
- Step 1.2 Timer store `src/lib/timer-store.ts` with unit tests (fake timers, reload simulation, corrupt storage).
- Step 1.3 `timer-provider.tsx` mounted in the root layout; unit test for start/pause/resume/extend/end.
- Step 1.4 Duration button in the step renderer; test: button present, aria-label, running state after click.
- Step 1.5 Timer cards and Menu section and badge; test: badge count equals running timers.
- Step 1.6 Keep-screen-on switch; test: hidden without Wake Lock, toggles when available.

## Risks
- The recipe step renderer is shared with the checklist state; the duration button must not change ticking behaviour (the step `<button>` toggles done state; the timer button is a separate control inside the text).
- Reflow: the new card stack must not cause horizontal scroll at 320 px (pnpm test:reflow).
- No e2e run is planned beyond the gate; UI screenshots are attached if a verification environment is available.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: In-page timers

- [ ] 1.1 Duration parser `src/lib/step-duration.ts`
- [ ] 1.2 Timer store `src/lib/timer-store.ts`
- [ ] 1.3 Timer provider mounted in the root layout
- [ ] 1.4 Duration button in the recipe step renderer
- [ ] 1.5 Timer cards, Menu section and count badge
- [ ] 1.6 Keep-screen-on switch
