# E01-S15b — Notifications: demote from the header, signal with a dot, future-proof the model

Epic: #201 · Backlog: `.ai/specs/backlog-przebudowa.md` (E01-S15) · Supersedes in part: `.ai/specs/2026-10-17-e01-s15-notifications.md` (#273, #323) · Related: #340 (header v8), #365 (desktop search field) · Risk: **low** (UI move; no migration in this change)

> Owner decisions (2026-10-20) are recorded in **Resolved decisions** at the end. This spec is written under them.

## 📝 TLDR

Today a signed-in user reaches notifications through a prominent **standalone "Powiadomienia" bell** in the desktop header (from `lg`), while phones/tablets use the quieter pattern the owner prefers: a MENU-drawer row plus a **count** badge on the MENU button (#323). The feed (`/powiadomienia`, E01-S15) is mostly low-frequency failed-share errors ("niedodanie") for the one person who added a link, plus in-progress and ready-recipe items. The bell's weight does not match its value and it competes with the rebuilt desktop search field (#365). **Proposed (future behavior):** remove the standalone desktop bell, signal "something new" with a **small dot** on the MENU button at every width, give notifications a stable home via a **"Powiadomienia" row in Settings** (and keep the MENU-drawer row), and shape the model so a **future "ktoś polubił mój przepis"** notification drops in without redesigning the dot, the page, or the data layer.

## 📝 Problem Statement

- **Prominence ≠ value.** The desktop header gives notifications a full 56 px labelled bell with a numeric badge — the visual weight of "Dodaj przepis" and the search field — although the feed is almost entirely rare "niedodanie" errors. It crowds the navbar the desktop search field (#365) now occupies.
- **Cramped navbar for the target group.** The app is often used on older people's smartphones with the system font enlarged (E01 high-readability rule). An enlarged numeric badge grows and can overflow or clip; a labelled bell is worse. There is very little horizontal room, so the header signal must be as small as possible.
- **Two patterns by breakpoint.** A standalone bell from `lg` and a MENU row + count below `lg` (#323). The owner wants one quiet pattern everywhere.
- **No account home.** Settings (`/settings`, "Mój profil") is where a signed-in user manages their account, yet notifications are only reachable from a header icon older users miss.
- **Only one planned growth: likes.** A future "someone favorited my recipe" notification has no `recipe_shares` row — today's count (`problems + unreadReady`) and feed derive entirely from `recipe_shares`. The signal and model must absorb a new type without a redesign.

## 📝 Proposed Solution

1. **Remove the standalone desktop bell.** Delete `NotificationBell` from the `lg` header (and the component, now unused). At **every** width the **MENU button is the only header affordance** for notifications.
2. **Dot, not a number.** The MENU button carries a **small red dot** (fixed ~12 px, independent of font scaling) when anything is new, replacing the numeric badge below `lg`. Best practice: a dot fits a signal whose exact count is not meaningful, and it is the smallest footprint for a cramped, large-font navbar ([eleken](https://www.eleken.co/blog-posts/badge-ui-design), [uxcel](https://app.uxcel.com/courses/ui-components-best-practices/notification-types-756/badge-9079)). The MENU button's **accessible name carries the text equivalent** ("nowe powiadomienia") so the signal is never colour/shape alone ([WCAG via Lumen](https://lib.lumen.com/chi/6.29.0/components/badge), [Orange DS](https://web.unified-design-system.orange.com/sosh/docs/1.0/components/badges)).
3. **Settings is the home.** `/settings` gains a **"Powiadomienia" row** linking to `/powiadomienia`, with the same dot when something is new. The MENU-drawer "Powiadomienia" row stays and now shows at **all** widths (it was `lg:hidden`), also with a dot instead of the red count pill.
4. **The feed page is unchanged.** `/powiadomienia` keeps its URL, four sections, cards, actions and the no-JS fallbacks (E01-S15). Reached from the MENU drawer and from Settings. The home `AttentionBanner` (problems only, under the greeting) stays — it is the one high-value, loud signal and is separate from the header dot.
5. **Dot rule = today's meaning, rendered as presence.** The dot lights when `notificationBadge(...).count > 0`, i.e. `problems + unreadReady` (owner Q3). Nothing about the rule changes; only number → dot. `loadFailed` keeps its distinct neutral-dot state (the signal must not claim "nothing" when the check failed, #137).
6. **Future likes type — model deferred, path documented.** No migration in this change. The dot is type-agnostic, so adding likes later needs no signal redesign. Phase 2's landing spot (a generalized `notifications` table and a union into the feed/badge) is written down in **Data Model** so the later change is additive only.

**Alternatives considered**
- *Keep a smaller icon-only desktop bell (dot, no label).* Still adds a navbar element competing with the search field at exactly the widths where room is tightest; rejected for the MENU dot, which costs zero extra width.
- *Keep the numeric count.* The number is not meaningful here (one user's rare items) and grows under font scaling; a dot is smaller and sturdier. Rejected per the owner's "small dot" and the cramped-navbar constraint.
- *Fold the feed into a `/settings` section (drop the page).* Loses the stand-alone URL, refresh-safety and the no-JS `openReadyShare` form the page gives for free, and reworks a shipped screen. Rejected (owner Q2: keep the page + a Settings link).
- *Build the `notifications` table now.* Unnecessary for a UI demotion; a dot already future-proofs the signal. Deferred (owner Q4).

## 📝 Architecture

```
AppHeader (app-header.tsx)  — signed-in
  ├─ (removed) desktop <NotificationBell>            ← was lg-only; deleted
  └─ HeaderMenu ─► AppMenu
                     ├─ MENU button: dot when notificationBadge.count > 0   (all widths now)
                     └─ drawer "Powiadomienia" row: dot                      (all widths now; was lg:hidden)

/settings (page.tsx)  — NEW: "Powiadomienia" row → /powiadomienia, dot from notificationBadge

/powiadomienia (unchanged)  — getNotifications() → NotificationsView
Home MemberHome (unchanged) — AttentionBanner (problems only, under greeting)

notificationBadge(getFailedShares()) — unchanged rule (problems + unreadReady); rendered as a dot
```

**Takeaway.** This is a presentation move: the only data-layer call is the existing `getFailedShares` → `notificationBadge`. `app-header.tsx`, `app-menu.tsx` and `/settings/page.tsx` change; `/powiadomienia`, `notifications.ts`, `failed-shares.ts`, `notification-badge.ts` (the rule) do not. `notification-bell.tsx` is deleted.

## 📝 Data Model

**No migration in this change.** The badge keeps deriving from `recipe_shares` via the existing `getFailedShares` (`read_at`/`cleared_at` already live from S15).

**Phase 2 landing spot (documented, not built).** When likes ship, add an additive, owner-gated table:

```sql
-- FUTURE, not part of E01-S15b:
create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,  -- the recipient
  type        text not null,                                              -- 'favorite' (room for more)
  actor_id    uuid references auth.users(id) on delete set null,          -- who favorited
  recipe_id   bigint references public.recipes(id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
-- RLS: recipient-only select/update (owner pattern, as recipe_shares).
-- Insert path: a SECURITY DEFINER trigger on favorites, so an actor can notify an owner
--   whose recipes RLS otherwise hides (favorites of other people's recipes).
-- Dot rule generalizes to: problems + unreadReady + count(notifications where read_at is null).
```

The dot's presence semantics mean the later change adds a term to the count with no UI redesign; a new card type is added to `getNotifications`. `favorite` events are notified to the recipe's first adder ("Moje przepisy" owner), never for self-favorites.

## 📝 API Contracts

No new endpoints, server actions or query functions. `notificationBadge` keeps its `{ count, loadFailed }` shape; callers render `count > 0` as a dot instead of printing `count`.

## 📝 UI/UX

Look stays within E01 tokens (no raw hex), WCAG 2.2 AA, ≥ 48 px targets, high readability.

1. **MENU button dot (`app-menu.tsx`).** When `notifications.count > 0`: a `bg-danger` dot, `h-3 w-3`, `rounded-pill`, `border-2 border-white`, absolutely positioned top-right of the button — no number, no `lg:hidden` (shown at all widths). The button's accessible name gains a visually-hidden ", nowe powiadomienia". When `notifications.loadFailed`: the existing neutral `bg-ink` dot + sr-only ", nie udało się sprawdzić powiadomień" (unchanged but no longer `lg:hidden`). A fixed-size dot does not grow with the system font, so it never clips the "MENU" caption.
2. **MENU-drawer "Powiadomienia" row (`app-menu.tsx`).** Shown at all widths (drop `lg:hidden` on the `<li>`). The red numeric pill becomes a `bg-danger` dot (same size as above) placed where the pill was (`ml-auto`), with sr-only ", masz nowe powiadomienia". `loadFailed` keeps its "Nie udało się sprawdzić" caption.
3. **Settings row (`/settings`).** Below the email `<dl>`, above "Wyloguj": a full-width `Link` to `/powiadomienia`, `min-h-14`, `border-2 border-field rounded-field`, a `Bell` icon + "Powiadomienia" 19 px (label underlined, like the drawer rows), and a `ChevronRight` affordance. **No live dot and no badge query here** — the MENU button's dot is the app-wide live signal and is visible on the Settings screen too, so loading `getFailedShares` on `/settings` would only risk holding up its TTFB (the exact regression #359 removed from the header). The Settings row is the stable *entry point*, the MENU dot is the *signal*.
4. **Desktop header.** The bell area is gone; the row is logo · search field · (Dodaj przepis from `lg`) · MENU. No layout gap — the `lg:flex` bell wrapper is removed, not hidden.

No change to `/powiadomienia`, the `AttentionBanner`, or the brand/header-search elements.

## 📝 Edge Cases & Failure Scenarios

| Case | Behavior |
|---|---|
| Nothing new | No dot anywhere; MENU name is just "MENU"; Settings row has no dot |
| Check failed (`loadFailed`) | Neutral `bg-ink` dot on MENU + sr-only text; Settings row shows no dot (avoids a false red); never a confident "0" (#137) |
| Enlarged system font | Dot is fixed `h-3 w-3`, so it cannot overflow or clip the caption the way a number could |
| Guest | No badge query, no dot (guest has no shares); unchanged |
| Screen reader | Dot is `aria-hidden`; the text equivalent lives in the control's accessible name, control-name-first |
| JS disabled | MENU is a `<button>` opening a `<dialog>` (unchanged); the Settings row and drawer row are plain links that work; `/powiadomienia` keeps its no-JS `openReadyShare` form |
| Future likes added | Dot already covers it once `notificationBadge` sums the new term; no UI redesign |

## 📝 Risks & Impact Review

- **Shared header (S10 #213, S17 #219, #340, #365).** `app-header.tsx` and `app-menu.tsx` are shared. The change only removes the desktop bell block and swaps number→dot; the search field, Dodaj, logo and guest CTAs are untouched. No breakpoint loses access to the page (MENU drawer row now shows at all widths; Settings row added).
- **Discoverability trade-off (product call, owner-approved).** A dot is quieter than a labelled bell. Mitigations: the loud home `AttentionBanner` still fires for the high-value "wymaga uwagi" case, the MENU row names it, and Settings hosts it. Accepted per the owner's direction.
- **Deleting `notification-bell.tsx`.** Only the desktop header imports it; grep before deleting. Its tests (if any) move/retire with it.
- **No migration, no deploy ordering.** Pure front-end; merging to master deploys via Workers Builds with no DB step.
- **Backlog/spec drift.** This supersedes the S15 header-bell decisions (#273, #323) for the header only; the S15 page/feed/banner stay authoritative. Backlog E01-S15 and the S15 spec get a superseding note (Phase 1, step 5).

## 📋 Phasing

- **Phase 1 (this PR) — UI demotion.** Remove the desktop bell, dot on MENU at all widths, drawer row at all widths with a dot, "Powiadomienia" row in Settings, superseding notes. No DB. Independently shippable and complete on its own.
- **Phase 2 (future, with likes, NOT now).** The `notifications` table + favorites trigger + a "ktoś polubił Twój przepis" card in `getNotifications`; `notificationBadge` sums the unread-notifications term. Additive migration, its own spec/PR.

## 📋 Implementation Plan

Phase 1 steps (each leaves the app working and green):

1. **Remove the desktop bell.** In `src/app/components/app-header.tsx`, delete the `HeaderBell` component, the `lg:flex` Suspense wrapper that renders it, and the now-unused imports (`Suspense` stays only if still used elsewhere in the file — it is, for `HeaderMenu`). Delete `src/app/components/notification-bell.tsx` after grepping that nothing else imports `NotificationBell`/`NotificationBellPlaceholder`.
2. **MENU button → dot.** In `src/app/components/app-menu.tsx`, replace the numeric badge span with a fixed-size `bg-danger` dot and keep the sr-only text (change the count-count phrasing to ", nowe powiadomienia"); remove `lg:hidden` from the dot and the `loadFailed` dot so both show at all widths.
3. **Drawer row at all widths + dot.** In `app-menu.tsx`, drop `lg:hidden` from the `NotificationsRow` `<li>`; in `NotificationsRow`, replace the red numeric pill with the dot + sr-only ", masz nowe powiadomienia".
4. **Settings row.** In `src/app/(authenticated)/settings/page.tsx`, render a plain "Powiadomienia" link row to `NOTIFICATIONS_PATH` (`Bell` + underlined label + `ChevronRight`). No `getFailedShares` call here (see UI §3). The shared `NotificationDot` (`src/app/components/notification-dot.tsx`, from step 2) is the one dot MENU and any future live surfaces reuse.
5. **Superseding notes.** Add a dated "Superseded in part (2026-10-20, E01-S15b)" note to `.ai/specs/2026-10-17-e01-s15-notifications.md` and to the E01-S15 backlog entry in `.ai/specs/backlog-przebudowa.md`.

Each step above folds in its own test edits so `pnpm typecheck && pnpm test` passes at the step boundary — step 1 removes `notification-bell.test.ts` and the `NotificationBell` mock in `app-header.test.ts` as it deletes the component; step 2/3 rewrite the `app-menu.test.ts` dot assertions as they change the markup. (The project merges on green tests per CLAUDE.md; the gate below is the final check.)

6. **Gate.** Run `pnpm typecheck && pnpm lint && pnpm test`.
7. **Browser verification** via `/api/dev/login?as=full|free` at 375 px (enlarged font) and desktop: dot on the MENU button (check placement on the inline `lg` button, not only the stacked mobile one), the drawer "Powiadomienia" row, the Settings row, and `/powiadomienia` still reachable from both; no desktop bell; no navbar horizontal scroll.

### Files

- `src/app/components/app-header.tsx` (remove desktop bell)
- `src/app/components/notification-bell.tsx` (**delete**) + any `notification-bell.test.*`
- `src/app/components/app-menu.tsx` (MENU dot + drawer row dot, both all-width)
- `src/app/components/notification-dot.tsx` (**new**, shared dot)
- `src/app/(authenticated)/settings/page.tsx` (Powiadomienia link row, no badge query)
- `.ai/specs/2026-10-17-e01-s15-notifications.md`, `.ai/specs/backlog-przebudowa.md` (superseding notes)
- tests under `src/app/components/`

## Resolved decisions (owner, 2026-10-20)

| # | Question | Decision | Note |
|---|---|---|---|
| Q1 | Desktop bell: keep or drop? | **Drop the standalone desktop bell; MENU dot at all widths** | Owner delegated with "check best practices / cramped large-font navbar"; researched recommendation: a fixed-size dot on the existing MENU button is the smallest footprint and unifies breakpoints |
| Q2 | Where relative to Settings? | **Keep the `/powiadomienia` page + a Settings link** (and the MENU-drawer row) | Keeps URL, refresh-safety, no-JS form |
| Q3 | What lights the dot? | **Problems + unread ready** (today's meaning), rendered as presence | No rule change; number → dot |
| Q4 | Future likes data model? | **Defer the table**; document the Phase-2 `notifications` table | Dot is type-agnostic; later change is additive only |
