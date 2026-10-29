# Admin focal point for recipe social cards

**Depends on:** `2026-10-29-og-social-card-generation.md` (Phase 1 must be shipped; `og_card_url` and `makeSocialCard` must exist).

## 📝 TLDR

The recipe social card is cut around the centre. Admins cannot change the framing, so a dish that sits off-centre can be cropped out of the preview. Proposed: store a focal point per recipe, add an admin control that shows the card frame, and regenerate the card when the point changes.

## 📝 Problem Statement

- The generation spec gives every card a centred crop. On portrait photos this can drop the dish from the preview.
- Admins edit recipes in the admin panel, but there is no way to set the crop for the card.

## 📝 Proposed Solution

- Store `og_focus_x` and `og_focus_y` (0–100, nullable; `NULL` means centre).
- Add a control on the admin recipe editor: a 1.91:1 frame over the cover, a draggable point, and two number inputs for keyboard users.
- On save, emit `recipe/og-card` with `reason: 'focus-change'`. The function reuses `makeSocialCard` from the generation spec, writes a new `og-<version>.jpg`, updates `og_card_url`, and deletes the previous object only after that update succeeds.

### Alternatives considered

- **Crop by automatic subject detection.** Rejected for now: it needs a model and an extra dependency, and it can still miss. Manual focus is predictable and reviewable.
- **Re-generate on every recipe edit.** Rejected: most edits do not touch the cover, and each regeneration writes to Storage.

## 📝 Architecture

Reuses `makeSocialCard`, the `recipe/og-card` event (introduced by the generation spec's backfill path), `og_card_url`, and the staff permission and `staff_audit` mechanism the admin panel already uses.

## 📝 Data Model

Additive only (`BACKWARD_COMPATIBILITY.md`, schema surface):

- `public.recipes.og_focus_x numeric(5,2) null` and `og_focus_y numeric(5,2) null`, with a check `0 <= value <= 100`.
- No existing column, policy, or object is dropped, renamed, or moved.

## 📝 API Contracts

- Admin server action `setRecipeOgFocus(recipeId, x, y)`. It requires the staff permission for recipe edits and writes a `staff_audit` row.
- Internal event `recipe/og-card` with `{ recipeId, userId, reason: 'focus-change' }`.

## 📝 UI/UX

- Admin only. Visitors see no change.
- The frame shows the card area over the cover. The point can be dragged or set with two number inputs (0–100). A status line says "Card updates in a few seconds" while regeneration runs.
- The frame has a text label for screen readers.

## 📝 Edge Cases & Failure Scenarios

- **Regeneration fails:** the previous card stays, so the public link does not break. The admin sees a status line that the update did not apply.
- **Point changed twice quickly:** the newer event wins, because the version is written last and the older object is removed only after a successful update.
- **Recipe has no cover:** the control is disabled.
- **Unauthorized user:** the server action refuses the call and writes no audit row.

## 📝 Risks & Impact Review

- **Storage writes per change:** one JPEG per save that changes the point. Previous versions are deleted after success.
- **Permission scope:** a new write path to recipe metadata. It must be checked against the staff permission set; widening a grant is a breaking change under `BACKWARD_COMPATIBILITY.md`.
- **Rollback:** the control can be removed without losing data. The stored points are then unused and the cards keep their last version.

## 📝 Decisions in play

No `product-brief.md` exists for this area.

## Resolved assumptions (autonomous defaults)

| # | Question | Chosen answer | Rationale | Status |
|---|---|---|---|---|
| A1 | Is this in the same delivery as the generation spec? | No. Separate spec, after Phase 1. | Keeps Phase 1 shippable and reviewed on its own. | Default |
| A2 | Who can change the point? | Staff with the recipe-edit permission. | Matches other recipe edits in the admin. | ⚠ NEEDS HUMAN CONFIRMATION (which permission string) |
| A3 | Does a change regenerate immediately or on save? | On save only. | Avoids a write per drag. | Default |

## 📋 Phasing

- **Phase 2 — Admin focal point:** depends on the generation spec's Phase 1. Shippable on its own once Phase 1 is live.

## 📋 Implementation Plan

1. Add migration: `recipes.og_focus_x` and `og_focus_y numeric(5,2) null`, with range checks. Test: migration applies to a copy of the schema, and out-of-range values are rejected.
2. Add `recipe/og-card` handling for `reason: 'focus-change'`: regenerate with the stored point, write a new version, update `og_card_url`, then delete the previous object. Test with a fake storage client: success deletes the old object; a failed write keeps it.
3. Add `setRecipeOgFocus` with the staff permission check and a `staff_audit` row. Test: an unauthorized user is refused and no audit row is written. Test: values are clamped or refused outside 0–100.
4. Add the focal-point control to the admin recipe editor, with the frame, drag handling, number inputs, and a status line. Test: number inputs enforce 0–100 and the frame label is present.
5. Verify in the admin panel with a QA staff account (`/api/dev/login?as=full`). *Requires a QA account that has the staff permission. This is not established yet and must be confirmed by the owner before this step.* Do not add recipes with the QA account. Then verify the public card changes after save. *Production data; keep the test to one recipe and restore its point afterwards.*
