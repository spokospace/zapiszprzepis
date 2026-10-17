# E01-S15 — Notifications: fullscreen view + home banner (screen 5)

Issue: #217 · Epic: #201 · Backlog: `.ai/specs/backlog-przebudowa.md` (E01-S15) · Depends on: S01 (merged), extends S-06 `notification-bell.tsx` · Related: #226 (bell holds back signed-in pages) · Risk: **medium** (new route + changes to the retry/dismiss path; no migration)

## 📝 TLDR

Today notifications are a 320 px dropdown under the header bell that lists only **failed** shares, with small grey text, the raw `error_message` (sometimes English, e.g. `Firecrawl failed: 403`) and an orange `#f97316` "Ponów" button that fails contrast. **Proposed:** the bell becomes a link to a new full-screen page **`/powiadomienia`** with three sections: **"Wymaga uwagi"** (Problem cards: the domain, a plain-Polish reason, "Spróbuj ponownie" / "Usuń"), **"W trakcie"** (shares still being processed) and **"Wcześniej"** (Gotowe cards: recipes saved in the last 14 days, linking to the recipe). The signed-in home gets a red banner "N przepisów wymaga uwagi" + "Zobacz" in the slot S04 left for it. No migration: the three states already exist in `recipe_shares.status` (`failed` / `pending` / `completed`).

## 📝 Problem Statement

- The dropdown is too small for the target group (older users): 14/12 px text, 24 px buttons, a truncated URL, and a raw technical error string. It breaks the E01 rules (19 px body, ≥ 48 px targets, `#c2410c` for white-on-orange).
- It only knows about failures. A user who just added a link has no place to see that it is still being processed, or that it finished. The backlog asks for "W trakcie" and "Gotowe" states.
- Nothing on the home page says that something needs attention: the only signal is a 16 px red badge on the bell.
- `error_message` is written by the extraction pipeline for two audiences. The Facebook-specific strings are already Polish and actionable; the rest are developer messages (`Firecrawl failed: 429`, `OpenAI failed: …`, `Database insert failed: …`, `No recipe title extracted — …`). Showing them raw is confusing.

## 📝 Proposed Solution

1. **Route `/powiadomienia`** (server component, under `src/app/(authenticated)/powiadomienia/`, so the existing `AppShell` header and the owner-only redirect apply). It loads one `NotificationsFeed` (below) and renders the three sections. It is a page, not an overlay: it works without JS, has its own URL, and the browser back button closes it.
2. **Bell → link.** `NotificationBell` stops being a dropdown: it renders a `<Link href="/powiadomienia">` with the bell icon, the count badge and the same accessible name as today ("Powiadomienia (3)", "Powiadomienia (nie udało się sprawdzić)"). The 48 px target replaces the 36 px button. `aria-current="page"` when on `/powiadomienia`. Its props (`failedShares: FailedSharesResult`) do not change, so `AppHeader`/`AppShell`/the home page do not change for it.
3. **Data: `src/lib/notifications.ts`** (new, server-only), `getNotifications(supabase, userId): Promise<NotificationsResult>`:
   - **problems** = exactly `getFailedShares()` (reused, not duplicated: same auto-resolve and dedupe rules, so the page, the bell badge and the banner always agree).
   - **inProgress** = own `recipe_shares` with `status = 'pending'`, newest first, limit 20, deduped by URL. A URL is shown only once, and **in progress wins** over a failure: when the user re-adds a link that failed before, the new row is `pending`, and the older failed row for the same URL must not keep claiming a problem. The bell/banner count uses the same rule through `getFailedShares`, which gets one extra filter: drop failed URLs that also have a `pending` row (see Edge Cases).
   - **done** = own `recipe_shares` with `status = 'completed'` and `recipe_id is not null`, `created_at` within the last **14 days**, newest first, limit 10, deduped by `recipe_id`. Titles and slugs come from **`public_recipes`** (`id in (...)`), because a link someone else added first lands in the user's Ulubione and the recipe row is not theirs (owner-only RLS on `recipes`). A recipe that is gone (deleted, merged away) is skipped.
   - `{ status: 'error' }` when the shares query fails, as `FailedSharesResult` does today (never a confident empty state while we do not know, #137).
4. **Plain-language reasons: `src/lib/share-error.ts`** (pure, unit-tested), `explainShareError(message: string | null): string`:
   - A message that is already user-facing Polish (the `FB_*`, `LLM_UNREADABLE`, `UNREADABLE_PAGE` strings, and the retry-dispatch message) is shown as written.
   - Known technical prefixes map to fixed Polish sentences: `Firecrawl failed: 4xx/403` → "Strona nie pozwoliła nam pobrać przepisu."; `Firecrawl failed` 429/5xx, `OpenAI failed`, timeouts, `fetch failed` → "Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę."; `No recipe title extracted` / `Extracted content has no usable recipe` → "Na tej stronie nie znaleźliśmy przepisu (składników i kroków)."; `Database insert failed` / `Share update failed` / anything else, or `null` → "Nie udało się zapisać przepisu. Spróbuj ponownie."
   - The mapping is a table of `{ test: RegExp, text }` rows, first match wins; a "looks Polish" check (contains a Polish diacritic or starts with "Nie ", "Ten ", "Opis ", "Facebook ") lets future Polish strings through without a code change.
   - The raw message is never rendered (it can contain upstream detail); it stays in the DB for support.
5. **Domain: `shareDomain(url)`** — the hostname without `www.`, e.g. `aniagotuje.pl`, `facebook.com`; a non-http or unparseable URL shows "nieznana strona" and is never linked (same rule as today's `startsWith('http')`).
6. **Actions.** Reuse `retryShare` and `dismissShare` from `src/app/(authenticated)/recipes/`. Two changes:
   - Both revalidate the whole tree (`revalidatePath('/', 'layout')`) instead of only `/recipes`, so the page, the bell badge and the home banner update together wherever the action ran.
   - Labels change on the new page: "Spróbuj ponownie" (retry) and "Usuń" (dismiss), per the AC. `dismissAllFailedShares` stays (a "Usuń wszystkie" button in the "Wymaga uwagi" header when there are 2 or more problems).
7. **Home banner** in the S04 slot of `src/app/page.tsx`: `<AttentionBanner failedShares={failedShares} />` from the result the page **already** loads for the header. It renders only for `status: 'ok'` with ≥ 1 share: background `#fef2f2`, text `#b91c1c` (`text-danger`; 6.5:1), a warning icon with the text, "{N} {przepis/przepisy/przepisów} {wymaga/wymagają} uwagi" (Polish plural via a pure `pluralizeAttention(n)`), and an underlined **"Zobacz"** link to `/powiadomienia` (48 px target). Guests have no shares, so they never see it (see A2).

**Alternatives considered**

- *A full-screen `<dialog>` opened from the bell.* Same look, but no URL, it does not survive a refresh, the retry's revalidation re-renders under it, and the home banner's "Zobacz" would need to open a dialog that lives in the header. A route is simpler and more robust for this audience. Rejected.
- *Keep the dropdown and add the sections.* The AC explicitly says not a 320 px dropdown. Rejected.
- *New `processing` / `done_seen` share states (migration).* The backlog allowed new states, but `pending` already means "in progress", and `completed` + `created_at` covers "Wcześniej". A read/unread state is not asked for. No migration needed.
- *Translating messages at write time in the pipeline.* Would leave all existing rows unreadable and couple the pipeline to UI copy. The read-time mapping covers old and new rows.

## 📝 Architecture

```
AppShell / HomePage (existing, unchanged query)
  └─ getFailedShares(supabase, uid) ──► NotificationBell (link + badge)
                                    └─► AttentionBanner (home slot only)

/powiadomienia  (src/app/(authenticated)/powiadomienia/page.tsx, server)
  └─ getNotifications(supabase, uid)          src/lib/notifications.ts
        ├─ getFailedShares()                   problems   (existing, reused)
        ├─ recipe_shares status=pending        inProgress
        └─ recipe_shares status=completed      done ─► public_recipes (id,slug,title)
  └─ <NotificationsView> (client: focus + action transitions)
        ├─ section "Wymaga uwagi"  <ProblemCard>  domain · explainShareError() · [Spróbuj ponownie] [Usuń]
        ├─ section "W trakcie"     <InProgressCard> domain · "Zapisujemy przepis…"
        └─ section "Wcześniej"     <DoneCard> title · domain · [Otwórz przepis] → /przepis/{slug}
              actions: retryShare / dismissShare / dismissAllFailedShares (existing server actions)
```

The page query runs only on `/powiadomienia`; every other page keeps exactly today's single `getFailedShares` call. #226 is **not made worse**: the banner reuses the result the home page already awaits, and no new query is added to the shared header. #226 itself (streaming the bell behind Suspense) stays a separate change; it applies unchanged to the banner because both read the same `FailedSharesResult`.

## 📝 Data Model

No migration. Reads only, all scoped by the existing `recipe_shares_user_isolation` RLS policy plus an explicit `user_id` filter (defense in depth, as in `failed-shares.ts`). Indexes: `idx_recipe_shares_user_status (user_id, status)` covers all three queries.

```ts
type ProblemItem    = { kind: 'problem'; id: number; url: string; domain: string; reason: string }
type InProgressItem = { kind: 'in_progress'; id: number; url: string; domain: string; since: string }
type DoneItem       = { kind: 'done'; id: number; url: string; domain: string; recipeId: number; slug: string; title: string; at: string }
type NotificationsResult =
  | { status: 'ok'; problems: ProblemItem[]; inProgress: InProgressItem[]; done: DoneItem[] }
  | { status: 'error' }
```

## 📝 API Contracts

No new endpoints. Existing server actions, changed only in what they revalidate:

| Action | Input | Change |
|---|---|---|
| `retryShare(shareId)` | positive int | `revalidatePath('/', 'layout')` |
| `dismissShare(shareId)` | positive int | `revalidatePath('/', 'layout')` |
| `dismissAllFailedShares()` | — | `revalidatePath('/', 'layout')` |

## 📝 UI/UX

Mockup: `.ai/specs/assets/e01-s15-notifications/mockup.html` (look reference). `PageContainer narrow`, single column.

1. **"← Wróć"** link (underlined, 48 px) to the previous page (`router.back()` with `/` as the no-history fallback), then **H1 "Powiadomienia"** (30 px bold `text-ink`, `tabIndex={-1}`).
2. **Focus management.** On arrival the H1 receives focus (client effect on mount), so keyboard and screen-reader users start at the top of the new view instead of on the stale bell. After "Usuń" or "Spróbuj ponownie" the card leaves its section; focus moves to that section's H2 (or to the H1 when the section is gone) and a `role="status"` line says "Usunięto." / "Ponawiamy zapis przepisu.". Nothing is ever focused that is then removed.
3. **"Wymaga uwagi"** (H2 22 px, count in text: "Wymaga uwagi (2)"). Problem card: `border-2 border-danger`, surface `#fef2f2`, a label "Problem" with a warning icon (text + icon, not color alone), **the domain** (19 px bold), the reason (19 px `text-ink`), the link "Otwórz stronę źródłową" (underlined, new tab, only for http(s)), then two 56 px buttons side by side (stacked below 360 px): **"Spróbuj ponownie"** (primary, `bg-action`) and **"Usuń"** (outline, `border-field`). Both disabled with "Ponawiamy…" / "Usuwamy…" while pending. "Usuń wszystkie" (outline, 48 px) in the section header when there are ≥ 2 problems.
4. **"W trakcie"** (H2). Card: `border-2 border-border-card`, label "W trakcie" with a clock icon, the domain, "Zapisujemy przepis. To zwykle trwa do minuty." (16 px `ink-soft`). A pending share older than 15 minutes instead says "Trwa to dłużej niż zwykle. Jeśli przepis się nie pojawi, dodaj link jeszcze raz." No buttons (the pipeline owns it). A "Odśwież" button (48 px, `router.refresh()`) sits in the section header; no polling.
5. **"Wcześniej"** (H2). Card: label "Gotowe" with a check icon (green-700 `#15803d` text on white, 5.0:1), the recipe title (19 px bold), the domain, and **"Otwórz przepis"** (underlined link, 48 px) to `/przepis/{slug}`.
6. **Empty / error states.** All three empty → one block "Wszystko gotowe. Nic nie wymaga uwagi." and a link "Wróć do strony głównej". A single empty section is omitted. `status: 'error'` → `role="alert"` "Nie udało się sprawdzić powiadomień. Odśwież stronę." and no sections.
7. **Bell.** Link, 48×48 px, `aria-label` as today, red badge with the count (decorative; the number is in the name), amber dot for the error state.
8. **Home banner.** Full-width strip at the top of `<main>` (inside `PageContainer`), `bg-[#fef2f2] text-danger border-2 border-danger rounded-card`, 19 px semibold text, icon + text, "Zobacz" link at the end. It is a `<section aria-label="Powiadomienia">`, not an alert (it is static content on load, not a change).

WCAG 2.2 AA: text ≥ 4.5:1 (danger on `#fef2f2` 5.9:1, white on `#c2410c` 5.2:1), borders ≥ 3:1, targets ≥ 48 px (primary 56 px), focus is the global 3 px `#1d4ed8` outline, links underlined, every icon has a text label, no horizontal scroll at 320 px (the domain wraps with `break-all`; the URL itself is not printed).

## 📝 Edge Cases & Failure Scenarios

| Case | Behavior |
|---|---|
| Failed share whose URL also has a newer `pending` row (user re-added the link) | Not a problem any more: shown once, under "W trakcie"; badge/banner do not count it |
| Failed share whose URL already has a recipe / is in Ulubione | Auto-resolved as today (not shown, not counted) |
| Several failed rows for one URL | One card (dedupe by URL, as today) |
| Retry dispatch fails (`inngest.send` throws) | Existing behavior: row goes back to `failed` with "Nie udało się ponowić przetwarzania. Spróbuj ponownie."; it reappears under "Wymaga uwagi" with that sentence |
| Pending share stuck > 15 min | Stays in "W trakcie" with the "dłużej niż zwykle" copy; never claims success |
| Completed share whose recipe was deleted/merged | Skipped in "Wcześniej" (no dead link) |
| Completed shares older than 14 days | Not shown |
| Shares query fails | Error state on the page; bell shows its amber state; banner hidden (it never claims "0") |
| `public_recipes` lookup fails | "Wcześniej" omitted; problems and in-progress still shown |
| Guest opens `/powiadomienia` | Redirect to `/login?next=/powiadomienia` (same guard as other owner pages) |
| JS disabled | Page and links work; the action buttons need JS (as today's bell) |

## 📝 Risks & Impact Review

- **Shared header coordination (S17 #219, S10 #213).** The bell keeps its props and position; only its inner element changes (button → link). S17 can restyle around it. The home edit stays inside the S04 slot comment.
- **Revalidation scope.** `revalidatePath('/', 'layout')` purges the router cache for every page after an action. The actions are rare (a few per user per week), so the cost is negligible, and it fixes a stale badge on non-`/recipes` pages.
- **Plain-language mapping drift.** A new technical error string in the pipeline falls to the generic sentence, never to raw text. Unit tests pin every current string from `run-extract-recipe.ts`.
- **#226.** Not addressed here and not made worse (no extra query on any shared page). Noted on the PR.

## 📋 Phasing

Single implementation PR (separate from this design-only PR). Steps:

1. Pure libs: `share-error.ts` (`explainShareError`, `shareDomain`), `pluralizeAttention` with unit tests.
2. `notifications.ts` (`getNotifications`) + the pending-wins filter in `getFailedShares`, with unit tests on a mocked Supabase client.
3. Actions: revalidation change.
4. Route `/powiadomienia` + `NotificationsView` and cards.
5. Bell → link.
6. Home banner in the S04 slot.
7. Local gate + dev-server check (375 px and desktop; QA accounts, no real shares created).

## 📋 Implementation Plan

- `src/lib/share-error.ts` (+ `share-error.test.ts`)
- `src/lib/notifications.ts` (+ `notifications.test.ts`); `src/lib/failed-shares.ts` (pending-wins filter, + test)
- `src/app/(authenticated)/recipes/{retry-action.ts, dismiss-action.ts}` (revalidation)
- `src/app/(authenticated)/powiadomienia/{page.tsx, notifications-view.tsx}`
- `src/app/components/notification-bell.tsx` (link)
- `src/app/components/home/attention-banner.tsx`; `src/app/page.tsx` (S04 slot only)

## Resolved assumptions (autonomous defaults)

| # | Question | Default taken | Why |
|---|---|---|---|
| A1 | Full-screen panel: overlay or route? | Route `/powiadomienia` | Back button, refresh-safe, no-JS, and "Zobacz" on home is a plain link. |
| A2 | AC says the banner shows for "gość/zalogowany" | Signed-in only in practice | A guest has no shares, so there is never anything to report. |
| A3 | New share states (migration)? | None; `pending` = W trakcie, `completed` (14 days) = Gotowe | The enum already has them; no read/unread state was asked for. |
| A4 | How far back is "Wcześniej"? | 14 days, at most 10 cards | Enough to find "the one I added last week" without an endless list. |
| A5 | Badge/banner count | Problems only (not in-progress) | "Wymaga uwagi" is what needs the user; in-progress needs nothing from them. |
| A6 | Button labels | "Spróbuj ponownie" / "Usuń" (was "Ponów" / "Odrzuć") | Backlog AC wording; plainer for older users. |
| A7 | Visible caption under the bell icon ("ikony z podpisem") | Deferred to S17's header layout; the link keeps its accessible name | S17 (#219) is reworking the header in parallel; a caption that fits 320 px belongs to that layout. |
| A8 | Live updates of "W trakcie" | None; an "Odśwież" button | No polling/realtime infra exists; keeps the page cheap. |
| A9 | #226 | Not addressed, not worsened | Separate story; banner reuses the already-awaited result. |
