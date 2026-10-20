# E01-S15 — Notifications: fullscreen view + home banner (screen 5)

Issue: #217 · Epic: #201 · Backlog: `.ai/specs/backlog-przebudowa.md` (E01-S15) · **Design authority:** `.ai/design/przebudowa-handoff/README.md` §5 + `designs/Powiadomienia.dc.html` · Depends on: S01 (merged), extends S-06 `notification-bell.tsx` · Related: #226 (bell holds back signed-in pages) · Risk: **medium** (new route, one additive migration, changes to the retry/dismiss path)

> Revised 2026-10-17 against the owner's final handoff (merged to master after the first draft). Where this spec differs from the handoff, the difference is listed under "Deviations from the handoff".

> **Superseded in part (2026-10-19, #323, owner's decision):** the labelled bell below stays only in the desktop header (`lg`, 1024 px, and up). On phones and tablets the header has no bell. The entry point is a „Powiadomienia” row in the MENU drawer's „Moje” section, with a red counter, and the MENU button carries the 22 px badge, with „MENU, N powiadomień” as its name. The page, the count and the home banner are unchanged.
>
> **Superseded in part (2026-10-20, E01-S15b — `.ai/specs/2026-10-20-e01-s15b-notifications-rework.md`):** the standalone desktop bell is removed (`notification-bell.tsx` deleted). At every width the only header signal is a small **dot** (not a number) on the MENU button when something is new; the „Powiadomienia” MENU-drawer row now shows at all widths and carries a dot instead of the count pill, and a „Powiadomienia” row in Settings is a second entry point. The full-screen page `/powiadomienia`, the feed (`getNotifications`), the count rule (problems + unread ready) and the home `AttentionBanner` are unchanged — only the header affordance changes.

## 📝 TLDR

Today notifications are a 320 px dropdown under the header bell that lists only **failed** shares, with 12–14 px text, the raw `error_message` (sometimes English, e.g. `Firecrawl failed: HTTP 403`) and an orange `#f97316` "Ponów" button that fails contrast. **Proposed (handoff screen 5):**

- The header bell becomes **"Powiadomienia"**: bell icon over a 13 px caption, min 100 px wide, 56 px high, a 22 px `#b91c1c` count badge with a 2 px white ring, `aria-label="Powiadomienia (N)"`. It links to a new full-screen page **`/powiadomienia`**.
- The page has four sections: **"Wymaga uwagi"** (Problem cards), **"W trakcie"** (spinner cards), **"Nowe"** (unread Gotowe cards) and **"Wcześniej"** (read Gotowe cards), plus **"Usuń przeczytane"** at the bottom.
- **Count = problems + unread ready recipes**, counted per recipe (as the cards are). Opening a ready recipe marks every unread share of it read.
- The signed-in home shows a red banner **under the greeting**: "1 przepis wymaga uwagi" + "Zobacz".
- One additive migration: `recipe_shares.read_at` and `cleared_at` (owner-gated, not applied).

## 📝 Problem Statement

- The dropdown is too small for the target group (older users): 14/12 px text, 24 px buttons, a truncated URL, a raw technical error string. It breaks the E01 rules (19 px body, ≥ 48 px targets, `#c2410c` for white-on-orange).
- It only knows about failures. A user who just added a link cannot see that it is being processed, or that it finished.
- Nothing on the home page says that something needs attention; the handoff notes that older users often miss the badge alone.
- `error_message` is written by the pipeline for two audiences: the Facebook strings are Polish and actionable, the rest are developer messages (`Firecrawl failed: HTTP 429`, `OpenAI failed: …`, `Database insert failed: …`).

## 📝 Proposed Solution

1. **Route `/powiadomienia`** (server component under `src/app/(authenticated)/powiadomienia/`, so `AppShell` and the owner-only redirect apply). A page, not an overlay: it has a URL, survives a refresh, works without JS, and the browser back button closes it.
2. **Bell → labelled link** (`NotificationBell`). Icon 24 px over "Powiadomienia" 13 px bold, `min-w-[100px] h-14`, badge 22 px `bg-danger` white 13 px bold with a 2 px white border, `aria-current="page"` on `/powiadomienia`. Accessible name: "Powiadomienia (N)", "Powiadomienia (nie udało się sprawdzić)" in the error state (amber dot), "Powiadomienia" at zero. Props stay `failedShares: FailedSharesResult`; the `ok` variant gains `unreadReady: number`, so `AppHeader` (shared with S10/S17) needs no change.
3. **Read state (migration).** `recipe_shares.read_at timestamptz` (a ready recipe was opened) and `cleared_at timestamptz` ("Usuń przeczytane" hid it). Existing completed rows are backfilled as read, so nobody gets a burst of old "Nowe" items on deploy. Completed rows are never deleted (the S03a merge rollback restores from them).
4. **Summary for every page: `getFailedShares()`** keeps its rules (auto-resolve, dedupe, plus: a URL re-added and still `pending` is not a problem) and additionally returns `unreadReady`, the number of distinct recipes among the user's `completed` shares with a recipe, `read_at is null and cleared_at is null`, in the last 14 days (only `recipe_id` is fetched, capped at 100 rows). Per recipe, because the page shows one card per recipe: a link shared twice or repointed by an S03a merge must not leave a badge number no card can clear. It runs in parallel with the failed-rows query. If it fails (e.g. migration not applied yet), it counts 0 and logs — the badge never fails because of it.
5. **Feed for the page: `src/lib/notifications.ts`** `getNotifications(supabase, userId)`:
   - **problems** = `getFailedShares()` rows (one rule for page, badge and banner), with `domain`, plain-language `reason` and `created_at`.
   - **inProgress** = own `pending` shares, newest first, limit 20, deduped by URL; `slow` when older than 15 minutes.
   - **ready** = own `completed` shares with a recipe, `cleared_at is null`, last 14 days, limit 20, deduped by recipe; titles and slugs from `public_recipes` (a link someone else added first lands in Ulubione and its row is not the user's). Split into **unread** ("Nowe") and **read** ("Wcześniej"). A recipe that is gone is skipped.
   - `{ status: 'error' }` when a shares query fails (never a confident empty state, #137).
6. **Plain-language reasons: `src/lib/share-error.ts`** `explainShareError(message)`: reader-facing Polish passes through; technical strings map to the handoff sentences — "Na tej stronie nie znaleźliśmy przepisu." (no recipe / unreadable page), "Strona nie odpowiada. Spróbuj za chwilę." (Firecrawl 429/5xx, timeouts, fetch failures), "Strona nie pozwoliła nam pobrać przepisu." (Firecrawl 4xx), anything else "Nie udało się dodać przepisu. Spróbuj ponownie.". The raw message is never rendered.
7. **Time line** (`notificationTime(iso, now)`, Europe/Warsaw): "przed chwilą" (< 2 min), "dziś o 9:40", "wczoraj o 18:12", else "14 października".
8. **Actions** (server, `src/app/(authenticated)/powiadomienia/actions.ts` + existing ones):
   - `retryShare` / `dismissShare` (existing; labels "Spróbuj ponownie" / "Usuń"); `revalidatePath('/', 'layout')` so badge, banner and page agree.
   - `openReadyShare(formData)` — sets `read_at = now()` on every unread `completed` share of the user for that share's recipe and redirects to `/przepis/{slug}`. A `<form>` post, so it works without JS.
   - `clearReadShares()` — sets `cleared_at = now()` on the user's completed shares with `read_at is not null`.
9. **Home banner** (`AttentionBanner`) **under the greeting** in `MemberHome` (handoff C1), from the result the page already loads for the header: the whole strip is one link to `/powiadomienia` — min 64 px, `border-2 border-danger`, `bg-danger-bg` (`#fef2f2`), circle-alert icon 28 px in `danger`, text 18 px bold `ink` "1 przepis wymaga uwagi" / "2 przepisy wymagają uwagi" / "5 przepisów wymaga uwagi", "Zobacz" 17 px bold underlined. Shown only when there is ≥ 1 problem.

**Alternatives considered**

- *A full-screen `<dialog>` from the bell* (the prototype's in-page panel). No URL, lost on refresh, revalidation re-renders under it, and the banner would need to open a dialog living in the header. A route gives the same full-screen look more robustly.
- *Deleting read completed shares for "Usuń przeczytane".* Loses the share history the S03a merge rollback restores from. A `cleared_at` flag is reversible.
- *Read state in `localStorage`.* Per device; the badge on a phone and on a laptop would disagree. Rejected.
- *Translating messages at write time in the pipeline.* Leaves existing rows unreadable and couples the pipeline to UI copy.

## 📝 Architecture

```
AppShell / HomePage (existing call site)
  └─ getFailedShares(supabase, uid)   failed rows  ∥ unreadReady count
        ├─► NotificationBell  (link, caption, badge = problems + unreadReady)
        └─► AttentionBanner   (home, under the greeting; problems only)

/powiadomienia  (server page)
  └─ getNotifications(supabase, uid)              src/lib/notifications.ts
        ├─ getFailedShares()                      problems
        ├─ recipe_shares status=pending           inProgress
        └─ recipe_shares status=completed         ready ─► public_recipes (id, slug, title)
  └─ <NotificationsView> (client: focus, transitions)
        Wymaga uwagi · W trakcie · Nowe · Wcześniej · "Usuń przeczytane"
        actions: retryShare, dismissShare, openReadyShare (form), clearReadShares
```

**#226:** not addressed; impact kept minimal. Shared pages keep one awaited call; it gains one parallel, index-backed query returning a few recipe ids (no extra round trip on the critical path). The banner reuses the result. Streaming the bell behind Suspense (#226) applies unchanged later.

## 📝 Data Model

Migration `supabase/migrations/20261017190000_recipe_shares_read_state.sql` (idempotent; **not applied** — owner-gated):

```sql
alter table public.recipe_shares
  add column if not exists read_at timestamptz,
  add column if not exists cleared_at timestamptz;

-- Old completed shares count as read: no burst of "Nowe" on deploy.
update public.recipe_shares set read_at = coalesce(updated_at, created_at)
 where status = 'completed' and read_at is null;

create index if not exists idx_recipe_shares_user_unread
  on public.recipe_shares (user_id, created_at desc)
  where status = 'completed' and read_at is null and cleared_at is null;
```

- RLS: the existing `recipe_shares_owner_update` / `recipe_shares_owner_select` (owner only, split by 20261017140000_full_access_gate) already let the owner set and read both columns; no new policy.
- The pipeline needs no change: `completed` rows start with `read_at = null` (unread). A retry resets the row to `pending`; when it completes it is unread again.
- Rollback (in the header): drop the index and both columns.
- Rehearsal: `.ai/qa/s15-rehearse-recipe-shares-read-state.sql`, a `do` block ending in `raise exception 'REHEARSAL_RESULT …'` (rolled back), asserting: columns exist, the backfill left no unread completed row, the owner can set `read_at` on their own share, another user's update touches 0 rows, anon touches 0 rows, and the unread index is used.

```ts
type ProblemItem    = { id: number; url: string; domain: string; reason: string; at: string }
type InProgressItem = { id: number; url: string; domain: string; at: string; slow: boolean }
type ReadyItem      = { id: number; url: string; domain: string; slug: string; title: string; at: string; read: boolean }
type NotificationsResult =
  | { status: 'ok'; problems: ProblemItem[]; inProgress: InProgressItem[]; ready: ReadyItem[] }
  | { status: 'error' }
```

## 📝 API Contracts

No new endpoints. Server actions:

| Action | Input | Effect |
|---|---|---|
| `retryShare(shareId)` | positive int | existing; revalidates `/` layout |
| `dismissShare(shareId)` / `dismissAllFailedShares()` | positive int / — | existing; revalidates `/` layout |
| `openReadyShare(formData)` | `shareId` (positive int) | `read_at = now()` where own, `completed`, same `recipe_id` as the share, `read_at is null`; redirect to `recipePath(slug)` (slug looked up via the share's `recipe_id` in `public_recipes`; missing → back to `/powiadomienia`) |
| `clearReadShares()` | — | `cleared_at = now()` on own `completed` rows with `read_at is not null and cleared_at is null` |

## 📝 UI/UX

Look reference: `designs/Powiadomienia.dc.html` (screen 5a). Single column, `max-w-2xl`.

1. **"← Wróć"** (18 px bold, 56 px target; `router.back()`, `/` without history) and **H1 "Powiadomienia"** 28 px bold, `tabIndex={-1}`.
2. **Focus management.** The H1 takes focus on arrival. After "Spróbuj ponownie" / "Usuń" / "Usuń przeczytane" focus moves to the first section heading still on the page, or the H1; a visible `role="status"` line confirms ("Ponawiamy dodawanie przepisu.", "Usunięto."). A removed node is never focused.
3. **Section titles** "Wymaga uwagi", "W trakcie", "Nowe", "Wcześniej": H2 17 px bold `ink-soft`. Empty sections are omitted.
4. **Card** (all types): `border-2`, radius 16, padding 16, white; icon 24 px left of a column: title 19 px bold, line 17 px `ink`, reason 17 px `ink-soft`, time 16 px `ink-soft`.
   - **Problem**: border `danger`, circle-alert icon `danger`, title "Nie udało się dodać przepisu", line = domain, reason, time; under it, stacked full width: **"Spróbuj ponownie"** 56 px primary with rotate-cw icon, **"Usuń"** 48 px outline. "Otwórz stronę" link (underlined, new tab) only for http(s) URLs. "Usuń wszystkie" (48 px outline) in the section header at ≥ 2 problems.
   - **W trakcie**: border `border-card`, a spinner in `action` color (`motion-reduce` shows a static clock), title "Spisujemy przepis", line = domain, "Zwykle trwa to 1–3 minuty. Możesz korzystać z aplikacji." (after 15 min: "Trwa to dłużej niż zwykle. Jeśli przepis się nie pojawi, dodaj link jeszcze raz."), time. No buttons; "Odśwież" (48 px outline) in the section header.
   - **Gotowe**: circle-check `success`, title "Przepis gotowy", line = recipe title (bold 19 px in the line slot), time. Unread: border `success` and **"Otwórz przepis"** 56 px primary; read: border `border-card` and the button outline. The button submits `openReadyShare`.
5. **"Usuń przeczytane"** under the list (17 px bold underlined text button, 52 px) when any read item exists.
6. **Empty state**: 64 px grey circle with a bell, "Nie ma nowych powiadomień" 22 px bold, "Tu napiszemy, kiedy przepis będzie gotowy albo gdy coś pójdzie nie tak przy dodawaniu." 18 px `ink-soft`.
7. **Error state**: `role="alert"` "Nie udało się sprawdzić powiadomień." + "Spróbuj ponownie" (48 px outline, `router.refresh()`).
8. **Bell** and **home banner** as in Proposed Solution 2 and 9.

WCAG 2.2 AA: text ≥ 4.5:1 (`ink` on `#fef2f2` 16:1, white on `#c2410c` 5.2:1, `success` on white 5.0:1), borders ≥ 3:1 for the meaningful ones (danger, success, field), targets ≥ 48 px, global 3 px `#1d4ed8` focus, links underlined, every icon has a text label, no horizontal scroll at 320 px (domains wrap with `break-all`).

## 📝 Edge Cases & Failure Scenarios

| Case | Behavior |
|---|---|
| Failed URL re-added and now `pending` | Shown once, under "W trakcie"; not counted |
| Failed URL already a recipe / in Ulubione | Auto-resolved as today |
| Several failed rows for one URL | One card |
| Retry dispatch fails | Existing: back to `failed` with a Polish message; reappears under "Wymaga uwagi" |
| Pending > 15 min | "dłużej niż zwykle" copy; never claims success |
| Completed share whose recipe is gone | Skipped; `openReadyShare` on it redirects back to `/powiadomienia` |
| Completed older than 14 days | Not shown, not counted |
| Migration not applied | Badge: `unreadReady` = 0 (logged), problems still counted. Page: error state (its query selects the new columns). Hence deploy order below |
| Shares query fails | Page error state; bell amber state; banner hidden (never claims "0") |
| `public_recipes` lookup fails | Ready sections omitted; others shown |
| Guest opens `/powiadomienia` | Middleware → `/login?next=/powiadomienia` |
| JS disabled | Links and "Otwórz przepis" (form) work; retry/dismiss/clear need JS |

## 📝 Risks & Impact Review

- **Deploy order: migration first, then the code** (merging to master deploys via Workers Builds). The migration is additive and the backfill only marks old rows read, so the live code is unaffected by it; the new code without it shows the page's error state.
- **Shared header (S10 #213, S17 #219).** Only `notification-bell.tsx` changes; its props are unchanged. S10/S17 own the rest of the header row; the bell's 100 px minimum width is the handoff's.
- **Home (S04).** The banner moves from the S04 top-of-main slot to under the greeting, as the handoff places it; the guest home is untouched.
- **Mapping drift.** A new technical error string falls to the generic sentence, never raw text; tests pin every current pipeline string.
- **#226.** One parallel small query added to the shared summary; noted on the PR.

## Deviations from the handoff

| Handoff | This spec | Why |
|---|---|---|
| Panel opened in place (prototype is one page) | Route `/powiadomienia` | URL, refresh and back button; same full-screen look |
| Problem card `role="alert"` | No live role on cards | Every alert would be announced on page load; the page heading and status line carry the context |
| "Film jest prywatny albo został usunięty." | Not emitted | The pipeline cannot tell a private video from one without a description; the generic "no recipe" sentence is used |
| Green "Przepis gotowy: {tytuł}" home banner (prototype only, not in README) | Not built | README §5 specifies only the problem banner; follow-up if wanted |

## 📋 Phasing

Single implementation PR (separate from this design-only PR):

1. Migration + rolled-back rehearsal (owner-gated) + types.
2. Pure libs: `share-error.ts` (`explainShareError`, `shareDomain`, `attentionLabel`, `notificationTime`) with tests.
3. `getFailedShares` (`unreadReady`, pending-wins) and `getNotifications` with tests.
4. Actions: revalidation, `openReadyShare`, `clearReadShares` with tests.
5. Page + view + cards; bell; home banner under the greeting.
6. Local gate + dev-server check (375 px and desktop; QA accounts, no real shares created).

## 📋 Implementation Plan

- `supabase/migrations/20261017190000_recipe_shares_read_state.sql`, `.ai/qa/s15-rehearse-recipe-shares-read-state.sql`, `src/lib/supabase.types.ts`
- `src/lib/share-error.ts` (+ test), `src/lib/notifications.ts` (+ test), `src/lib/failed-shares.ts` (+ test)
- `src/app/(authenticated)/recipes/{retry-action.ts, dismiss-action.ts}`, `src/app/(authenticated)/powiadomienia/{page.tsx, notifications-view.tsx, actions.ts (+ test)}`
- `src/app/components/notification-bell.tsx`, `src/app/components/home/attention-banner.tsx`, `src/app/page.tsx` (MemberHome), `src/lib/routes.ts` (`NOTIFICATIONS_PATH`)

## Resolved assumptions (autonomous defaults)

| # | Question | Default taken | Why |
|---|---|---|---|
| A1 | Full-screen panel: overlay or route? | Route `/powiadomienia` | Back button, refresh-safe, no-JS; banner "Zobacz" is a plain link |
| A2 | Banner for guests? | Signed-in only | A guest has no shares |
| A3 | Read state storage | `recipe_shares.read_at` / `cleared_at` (migration) | Handoff count = problems + unread ready; must agree across devices |
| A4 | How far back do ready items reach? | 14 days, max 20 | Recent enough to matter; bounded list |
| A5 | What marks a ready item read? | Opening it via "Otwórz przepis" | The prototype's only read trigger |
| A6 | Live updates of "W trakcie" | None; "Odśwież" button | No realtime infra; keeps the page cheap |
| A7 | #226 | Not addressed; one parallel count added | Separate story |
