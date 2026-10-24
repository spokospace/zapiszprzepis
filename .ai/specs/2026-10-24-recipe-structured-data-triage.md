# Triage Search Console Recipe structured-data suggestions

## 📝 TLDR

Google Search Console lists 11 non-critical Recipe structured-data suggestions on
zapiszprzepis.pl (none block rich results). This change does **not** add any
suggested field. There is no honest stored source for the headline candidate
(`recipeCuisine`), and the rest (`nutrition`, `video`, `aggregateRating`, per-step
`image`/`video`) were already deliberate omissions. The proposed behavior is to
**record the per-field decision in code** — a complete doc comment above
`buildRecipeJsonLd` and matching test assertions — so these suggestions stop being
re-triaged and no future edit silently starts emitting invented data.

## 📝 Problem Statement

The JSON-LD builder `buildRecipeJsonLd` (`src/lib/recipe-json-ld.ts`, inlined by
`src/app/przepis/[slug]/page.tsx`) already omits `aggregateRating`, `nutrition`
and `video` on purpose, and `src/lib/recipe-json-ld.test.ts` enforces "never
invents a rating or nutrition". But the omissions of `recipeCuisine` and per-step
`image`/`video` are undocumented, so every Search Console re-crawl re-raises them
and a maintainer re-investigates whether they can be filled. The waste is the
re-triage, not a missing field.

The owner (project maintainer) has resolved the one blocking question — the source
of `recipeCuisine` — in favour of **not emitting it**: the data to fill any of
these fields honestly does not exist, and the project's hard "never invent data"
rule forbids deriving or defaulting them.

## 📝 Proposed Solution

Make every per-field decision explicit and test-locked, emitting nothing new:

| Field | Decision | Reason |
|---|---|---|
| `recipeCuisine` | **Do not emit** | No stored cuisine. `category` is a dish-type enum (`obiady`/`zupy`/`desery`…), `tags` are free-form keywords; deriving or defaulting (e.g. "Polish") would be invented data. Revisit only if a real cuisine field is ever stored. |
| `nutrition` | **Do not emit** | Not stored; estimating it would be invented data. |
| `aggregateRating` / `review` | **Do not emit** | No ratings system; Google forbids fabricated ratings (they render the SERP stars). |
| `video` (`VideoObject`) | **Do not emit** | A `VideoObject` needs a real `uploadDate` we do not store, even where `youtube_id` exists. The suggestion is an accepted known warning. |
| `image`/`video` per `HowToStep` | **Do not emit** | Step photos are login-gated (`visibleStepImages(…, Boolean(user))`); Googlebot is anonymous, so the markup must describe only what a signed-out visitor sees. |

Alternatives considered and rejected for `recipeCuisine`: deriving from
`tags`/`category` (dish-type and free-form — mostly invented); an LLM-extraction
field + DB column + backfill (a much larger, separate effort, with its own risk of
the model inventing a cuisine). Both are explicitly out of scope; this spec ships
only the documentation and tests.

## 📝 Architecture

Single pure builder `buildRecipeJsonLd` in `src/lib/recipe-json-ld.ts`. No new
components, no cross-system effects. The consumer (`page.tsx`) is unchanged — it
already inlines the builder's output. No DB, extraction pipeline, UI, or API
surface is touched.

## 📝 Edge Cases & Failure Scenarios

- A recipe with `youtube_id` set still emits **no** `video` — the page keeps its
  own `<iframe>` embed; the two are independent and the test fixture need not
  cover the embed.
- A future contributor adds one of these fields back without a source: the new
  test assertions fail, surfacing the "never invent" rule at the point of change.
- A signed-in author's step photos exist in data: they must never reach the
  markup; the per-step assertion guards the guest view.

## 📝 Risks & Impact Review

Risk-low. Output bytes are unchanged (no field added or removed from what ships
today), so there is no structured-data regression and nothing to re-validate
beyond a Rich Results spot-check. The only durable commitment is the documented
intent, which a human can revise by editing the doc comment and tests together.

## 📋 Phasing

Single phase — documentation and tests only, independently shippable.

## 📋 Implementation Plan

**Phase 1 — Record the per-field decisions (one PR).**

1. **Doc comment.** Extend the doc comment above `buildRecipeJsonLd` in
   `src/lib/recipe-json-ld.ts` so it states the decision and reason for every
   non-emitted suggested field — `recipeCuisine`, `nutrition`,
   `aggregateRating`/`review`, `video`, and per-step `image`/`video` — alongside
   the fields it does emit. No code behavior changes. Run `pnpm typecheck`,
   `pnpm lint`.
2. **Tests.** In `src/lib/recipe-json-ld.test.ts`, keep the existing "never
   invents a rating or nutrition" test and add assertions that the output never
   contains `recipeCuisine`, `video`, or a `recipeInstructions[].image` / `.video`
   — including a fixture variant with `youtube_id` set, proving the YouTube embed
   does not leak into a `video` field. Run `pnpm test` (and the full gate:
   `pnpm lint`, `pnpm typecheck`, `pnpm test:reflow`).

Validation for the implementation PR: the full configured gate, plus a manual
Google Rich Results Test spot-check on one live recipe to confirm the page still
qualifies for the Recipe rich result (no field was lost).
