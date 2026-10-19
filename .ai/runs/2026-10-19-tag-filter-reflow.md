# Execution plan — Category tag filter reflow at 320 px / A++

Found while working on #327: the reflow guard's long-content run "category, all text, long content"
(`e2e/reflow.spec.ts`) fails on master. Separate PR at the owner's request.

## Goal

The "Pokaż wszystkie (N)" / "Pokaż mniej" toggle under the category page's tag chips never makes the
page scroll sideways at 320 px / A++ (WCAG 1.4.10, CLAUDE.md readability rules).

## Cause

The toggle in `src/app/przepisy/[kategoria]/_components/tag-filter.tsx` is an `inline-flex` button. Its
label is an anonymous flex item that never shrinks below its longest word, so a long label (the
guard appends a 40-letter word to every text) widened the page to well past 320 px. The chips next
to it already wrap, because `chipClasses` carries `wrap-anywhere`.

## Scope

- `tag-filter.tsx`: add `wrap-anywhere` to the toggle, like `chipClasses`.
- A unit test for the toggle's class.

## Non-goals

- Anything else on the category page; the recipe page (#327).

## Implementation Plan

### Phase 1 — Fix

1.1 Add `wrap-anywhere` to the toggle with a unit test; run the gate and the category reflow guard
    against a local guest dev server.

## Risks

- None material: one utility class on one button. The 48 px target and the underline are unchanged.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Fix

- [ ] 1.1 Wrap the tag filter toggle, with a test and the reflow guard
