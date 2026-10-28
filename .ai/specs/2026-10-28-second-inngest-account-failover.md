# Second Inngest account as failover for recipe extraction

## 📝 TLDR

Recipe extraction runs as Inngest jobs on one Inngest account. When that account refuses an event or stops running jobs (plan limit, suspension, broken key), every new share fails with "Failed to queue extraction" until someone fixes the account. This spec adds a second Inngest account as a failover: the same `recipe/extract` event goes to the secondary account when the primary refuses it or its runs are throttled, and the secondary account runs the same `extract-recipe` function through its own serve endpoint. Behaviour when both accounts are healthy does not change.

## 📝 Problem Statement

- Every job is sent through `new Inngest({ id: 'zapiszprzepis' })` in `src/inngest/client.ts`. The SDK takes the event key from `INNGEST_EVENT_KEY` and the signing key from `INNGEST_SIGNING_KEY`. There is no second account and no second key.
- When `inngest.send()` throws, `src/app/share/actions.ts` marks the share `failed` with "Failed to queue extraction". The user has no working path until the owner fixes the account.
- A send can succeed while the run never starts: the account accepts the event, but its plan limit throttles the function. Today nothing detects this, so the share stays `pending` and no error surfaces.
- Who has the problem: the owner, who has to fix the account, and every user who shares a link and waits for a recipe.

Evidence: issue #580 (owner's decision: failover also triggers on throttled runs, recorded in the issue comments on 2026-10-28). The send-failure path is in the code today; the throttled-run path is not observable from the code and is designed below.

## 📝 Proposed Solution

Two Inngest accounts, one active per event:

1. **Primary account** stays as it is: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, served by `/api/inngest`.
2. **Secondary account** gets `INNGEST_EVENT_KEY_2` and `INNGEST_SIGNING_KEY_2`, served by a second route `/api/inngest-2`, which registers the same `extractRecipe` function with the secondary client.
3. **Send helper** `src/inngest/send.ts`: `sendRecipeExtract(payload)` sends to the primary; on a send error, or on a throttled run detected by the watchdog (below), it sends the same event to the secondary. It returns which account accepted the event. Every share action calls this helper instead of `inngest.send` directly.
4. **Throttle watchdog**: after an event is accepted, a check looks up its run through Inngest's REST API. If no run has started within a window (default 10 minutes, configurable), the event is re-sent to the secondary account. The watchdog runs from a cron trigger that already exists pattern-wise (`custom-worker.ts`) or from a scheduled Supabase function; the mechanism is part of Phase 3.
5. **Idempotency**: the extraction function already keys its work by `shareId`, so a late run on the primary after a failover must not create a second recipe. The spec requires an explicit guard (Phase 3, step 3) rather than relying on that.

Alternatives considered:

- *Round-robin between the two accounts.* Rejected: it doubles the places a run can be lost and makes failures look random. The owner asked for failover, not balancing.
- *Retry the same send after a delay on the primary.* Rejected: it does not help when the account is suspended or over its limit, which is the case that matters.
- *A second Inngest app inside the same account.* Rejected: a plan limit is per account, so it does not add capacity.

## 📝 Architecture

```mermaid
flowchart LR
  A[share / add / retry / refresh actions] --> H[sendRecipeExtract]
  H -->|1. send| P[Inngest primary account]
  H -->|2. on send error| S[Inngest secondary account]
  P -->|run callback| R1[/api/inngest]
  S -->|run callback| R2[/api/inngest-2]
  R1 --> F[extractRecipe]
  R2 --> F
  W[watchdog cron] -->|no run after window| H
```

- **Existing, unchanged:** `extractRecipe` (`src/inngest/functions.ts`), the event name and payload (`recipe/extract`), the `/api/inngest` route.
- **New:** `src/inngest/send.ts`, `src/inngest/client-secondary.ts` (or a factory in `src/inngest/client.ts`), `src/app/api/inngest-2/route.ts`, the watchdog job.
- **Changed:** the four send sites (below), `src/middleware.ts` (exempt `/api/inngest-2` like `/api/inngest`), `custom-worker.ts` only if the watchdog needs a cron trigger (see Phase 3).

Consumers: `src/app/share/actions.ts`, `src/app/(authenticated)/recipes/add-recipe-action.ts`, `src/app/(authenticated)/recipes/retry-action.ts`, `src/app/(authenticated)/recipes/[slug]/refresh-action.ts`. The scripts `scripts/archive-recipe-images.ts` and `scripts/refresh-recipe-times.ts` keep the primary; they run by hand and are out of scope.

## 📝 Data Model

No schema change. The account that accepted an event is recorded in the existing `recipe_shares` row through a new nullable column `inngest_account text` (values `primary` | `secondary`). This is a migration, so it follows the `risk-high` path in `BACKWARD_COMPATIBILITY.md` section 5: a forward migration, regenerated `src/lib/supabase.types.ts`, and a rollback note in the PR body. The column is needed for the watchdog to find runs that were sent to the primary and for the log the owner reads. If the owner prefers no schema change, the account can be written to the logs only; the watchdog then cannot find its candidates and Phase 3 must be dropped. This is the one blocking choice in this spec; it is recorded in Resolved assumptions.

## 📝 API Contracts

- `sendRecipeExtract(data: RecipeExtractData): Promise<{ account: 'primary' | 'secondary'; eventIds: string[] }>` — throws only when both accounts refuse the event.
- `POST /api/inngest-2` — Inngest's serve handler for the secondary account (`serve({ client: inngestSecondary, functions: [extractRecipe] })`). Same methods as `/api/inngest`: GET, POST, PUT.
- Event `recipe/extract` and its payload: unchanged (see `BACKWARD_COMPATIBILITY.md` section 4).
- Watchdog: reads `recipe_shares` rows with status `pending` older than the window and `inngest_account = 'primary'`, then calls `sendRecipeExtract` for the secondary.

## 📝 UI/UX

No new screen. The existing notification bell keeps showing `failed` only when both accounts refuse the event, with the same Polish message "Failed to queue extraction" (`BACKWARD_COMPATIBILITY.md` section 8: the text is stored and shown verbatim, so it stays Polish and readable on its own). A share that is re-sent by the watchdog stays `pending` and shows the normal progress state.

## 📝 Edge Cases & Failure Scenarios

- **Primary refuses the event (plan limit, bad key):** the helper sends to the secondary immediately. The share stays `pending`; no error is shown.
- **Both refuse:** the share is marked `failed` as today. The helper logs both errors.
- **Primary accepts, run throttled:** the watchdog re-sends to the secondary after the window. The primary run may still start later. The idempotency guard (below) makes the second run a no-op for the recipe.
- **Primary run starts after the failover:** `extractRecipe` checks the share status before it writes. If the share is already `done` (the secondary finished), the run exits without writing. If it is `pending` and held by the secondary, the run exits and logs the account conflict.
- **Secondary keys missing:** the helper behaves exactly as today. Failover is off until `INNGEST_EVENT_KEY_2` is set, so deploying the code before the secret exists changes nothing.
- **Retries (3 by Inngest):** a retry on the primary of an event the secondary already completed exits through the same guard.
- **Watchdog outage:** shares stay `pending` longer than usual. A stale-pending report (older than 30 minutes) is shown to the owner in the existing error-surfacing path (issue #374), not to users.
- **Signing key mismatch on `/api/inngest-2`:** Inngest rejects the run; the share stays `pending` until the watchdog re-sends it to the primary, if the primary is healthy. The owner sees the failed sync in the Inngest dashboard.

## 📝 Risks & Impact Review

- **Two accounts doubling cost:** the secondary is a second plan. The spec does not decide the tier; the owner pays for it.
- **Secrets:** two new secrets (`INNGEST_EVENT_KEY_2`, `INNGEST_SIGNING_KEY_2`) must be set in Cloudflare before merge (`BACKWARD_COMPATIBILITY.md` section 7). A missing secret silently disables failover; the helper logs a warning at first use.
- **Duplicate runs:** covered by the idempotency guard. Without it, a late primary run could overwrite a recipe the secondary finished. The guard is Phase 3, step 3, and is required before the watchdog ships.
- **Rollback:** Phase 1 and Phase 2 roll back by unsetting `INNGEST_EVENT_KEY_2` (the helper then sends to the primary only). Phase 3 rolls back by disabling the watchdog cron. The migration is additive (a nullable column) and needs no data rollback.
- **Product direction:** whether failover should also cover throttled runs is decided by the owner (issue #580 comments). Not a product call left open here.

## ⚠️ Resolved assumptions (autonomous defaults)

| Question | Chosen answer | Rationale | Marker |
|---|---|---|---|
| Failover trigger | Send error **and** runs not started within a window | Owner decision on #580 | — |
| Window before a throttled run is re-sent | 10 minutes, configurable through an env var | Long enough to avoid double sends on normal queueing, short enough for users to notice a stall | ⚠ NEEDS HUMAN CONFIRMATION |
| Account choice per event | Primary first, secondary on failure only (no balancing) | Smallest blast radius; owner asked for failover | — |
| Schema change for the account column | Add nullable `recipe_shares.inngest_account` | Watchdog needs to know which account holds a pending share; the alternative (logs only) cannot drive the watchdog | ⚠ NEEDS HUMAN CONFIRMATION |
| Second serve endpoint | Separate route `/api/inngest-2` with its own signing key | One endpoint cannot be synced to two accounts with two signing keys without relying on `INNGEST_SIGNING_KEY_FALLBACK`, which is not designed for two live accounts | — |
| Watchdog trigger | Cron entry added to `custom-worker.ts` and `wrangler.jsonc` in the same commit | Matches the existing cron pattern; both files must change together (`BACKWARD_COMPATIBILITY.md` section 6) | — |
| Idempotency guard | Check share status before writing; exit when `done` or held by the other account | Prevents double writes; no new contract | — |

## 📋 Phasing

**Phase 1 — Failover send (no schema change, no new endpoint).** Adds the secondary client and the send helper. Without `INNGEST_EVENT_KEY_2` the behaviour is unchanged. Covers send errors only.

**Phase 2 — Secondary serve endpoint.** Adds `/api/inngest-2` and its middleware exemption. Failover runs can execute on the secondary account. Needs the secondary secrets set in Cloudflare.

**Phase 3 — Throttle watchdog and idempotency guard.** Adds the `inngest_account` column, the watchdog cron, and the guard in `extractRecipe`. Needs the migration path from `BACKWARD_COMPATIBILITY.md` section 5 and `risk-high` labelling.

Each phase ships on its own PR and leaves the app working; Phase 1 alone already covers the "primary refuses" case.

## 📋 Implementation Plan

### Phase 1 — Failover send

1. Add an explicit client factory: in `src/inngest/client.ts` keep `inngest` as is, and export `inngestSecondary = new Inngest({ id: 'zapiszprzepis', eventKey: process.env.INNGEST_EVENT_KEY_2 })` only when `INNGEST_EVENT_KEY_2` is set; otherwise export `null`. Test: unit test that the module exports `null` without the variable.
2. Create `src/inngest/send.ts` with `sendRecipeExtract(data)`: try `inngest.send({ name: 'recipe/extract', data })`; on throw, if `inngestSecondary` is set, send to it; return `{ account, eventIds }`; rethrow when both fail. Test: unit tests for primary ok, primary throws + secondary ok, both throw, secondary unset.
3. Change `src/app/share/actions.ts` (the `inngest.send` call near line 59, and its catch block) to call `sendRecipeExtract`. Keep the `failed` update on the final throw. Extend `src/app/share/actions.test.ts` (mocks at lines 6–7, failure cases at lines 26–82): primary throws + secondary ok → share stays `pending`; both throw → share `failed`.
4. Change `src/app/(authenticated)/recipes/add-recipe-action.ts` (line 49), `src/app/(authenticated)/recipes/retry-action.ts` (line 57) and `src/app/(authenticated)/recipes/[slug]/refresh-action.ts` (line 51) to use `sendRecipeExtract`. Test: one call-through test per action file, mocking the helper.
5. Add `INNGEST_EVENT_KEY_2` to the Cloudflare secrets list in the deployment notes, and record it in `BACKWARD_COMPATIBILITY.md` section 7. Gate: `pnpm build`, `pnpm check`, `pnpm test:unit`.

### Phase 2 — Secondary serve endpoint

6. Create `src/app/api/inngest-2/route.ts`: `serve({ client: inngestSecondary, functions: [extractRecipe], signingKey: process.env.INNGEST_SIGNING_KEY_2 })`. First confirm that the installed `inngest` (^4.20.0, lockfile pins 4.x) accepts a `signingKey` option on `serve`/`new Inngest`; if not, use the constructor option. Test: a route test that GET returns 200 when the secondary key is set and 404/disabled when it is not.
7. Extend `src/middleware.ts` (line 35, the `/api/inngest` exemption) to also exempt `/api/inngest-2`. Test: middleware test that the path bypasses the session check.
8. Set `INNGEST_SIGNING_KEY_2` in Cloudflare and register the app with the secondary account (sync `https://<site>/api/inngest-2`). Record the steps in the PR body. Gate: as in step 5, plus a manual sync check in the Inngest dashboard.

### Phase 3 — Throttle watchdog and idempotency guard

9. Migration `supabase/migrations/<timestamp>_recipe_shares_inngest_account.sql`: `alter table public.recipe_shares add column inngest_account text check (inngest_account in ('primary','secondary'));`. Regenerate `src/lib/supabase.types.ts`. Rollback described in the PR body. Label `risk-high`.
10. `sendRecipeExtract` writes `inngest_account` on the share row it was sent for (the four send sites already have `share.id` or a row id in scope). Test: unit test that the account is written for each path.
11. Watchdog job: a function `src/inngest/watchdog.ts` (or a plain route called by cron) that finds `recipe_shares` with `status = 'pending'`, `inngest_account = 'primary'` and `created_at` older than the window, then re-sends them through `sendRecipeExtract` with the secondary forced. Add the cron string to `custom-worker.ts` and `wrangler.jsonc` in one commit (`BACKWARD_COMPATIBILITY.md` section 6). Test: unit test of the candidate query and of the forced-secondary send.
12. Idempotency guard in `src/inngest/run-extract-recipe.ts`: before any write, read the share; exit without writing when `status = 'done'`, or when `inngest_account` is the other account and the share is not `pending`. Test: unit test covering done, other-account, same-account and missing-row cases (`src/inngest/run-extract-recipe.test.ts` already exists).
13. Gate: `pnpm build`, `pnpm check`, `pnpm test:unit`; then `pnpm test:e2e` on the share flow before merge (the share flow is user-visible, so the PR needs a before/after note, not visual screenshots).
