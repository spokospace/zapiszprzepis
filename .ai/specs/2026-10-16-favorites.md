# E01-S06 — Favorites (heart with a label) + login `next`

> Backlog: `.ai/specs/backlog-przebudowa.md` (E01-S06). Risk: **medium** (new table + RLS, a login flow change). Prerequisite for S03a (#199). Builds on S01 (tokens), S02 (guest pages) and the views, all live.

## 📝 TLDR
Today nobody can bookmark a recipe, and every login lands on `/` or `/recipes` whatever page you came from. *Proposed (future behavior):*
- A signed-in user marks any recipe, their own or someone else's, with a **labelled heart** on the recipe page. It updates optimistically and shows "Dodano do ulubionych · Cofnij".
- Their favorites are listed at **`/ulubione`** (also in MENU).
- A guest who taps the heart logs in and **comes back to the same recipe with the favorite already added**.
- Login (password and magic link) and the middleware's redirect to `/login` carry a validated `next`.

## ✅ Decisions (Open Questions gate, 2026-10-16)
- **Q1:** the heart is **only on the recipe page**; the card bar comes with the S04/S05 card redesign.
- **Q2:** a minimal **`/ulubione`** page (a grid of the existing cards) + "Ulubione" in MENU. Full integration in S05 (the search scope) and S09 (menu counters).
- **Q3:** after login the guest's favorite is **added automatically** (a POST from the page, never a GET), with the "Cofnij" toast.
- **Own recipes can be favorited** (handoff: "zakładki na dowolne przepisy"). **S03a (#199) follow-up:** its collapse must *keep* a favorite whose user owns the canonical recipe, not delete it.

## 📝 Data Model
Migration `…_favorites`:
- `favorites(user_id uuid → auth.users on delete cascade, recipe_id bigint → recipes on delete cascade, created_at timestamptz default now(), primary key (user_id, recipe_id))`, plus an index on `recipe_id` (S03a's delete guard counts by recipe).
- **RLS** on. A single policy for `authenticated`: `user_id = public.current_user_id()` for select / insert / delete. `anon` gets nothing.
- **Grants:** Supabase's default `ALL` is narrowed to `select, insert, delete` for `authenticated`; nothing for `anon`. There's no `update` path, since a favorite is a pair.
- **Foreign key vs RLS:** the FK check runs as the table owner, so a user can favorite any recipe id even though `recipes` is owner-only, which is what we want. Those ids are public through `public_recipes` anyway.

## 📝 Contracts
- **`addFavorite(recipeId)`, `removeFavorite(recipeId)`** (server actions, `src/app/favorites/actions.ts`):
  - validate a positive integer id
  - require a session
  - add is an upsert with `ignoreDuplicates`, so it's idempotent
  - return `{ ok: true } | { ok: false, error }`
  - `revalidatePath('/ulubione')`
- **Login `next`:**
  - `/login?next=<path>`: the page passes it as a hidden field in **both** forms.
  - **The actions resolve it with the existing `safeNext`** against the site origin; an invalid `next` becomes the default.
    - password → `redirect(next ?? '/recipes')` (today's default kept)
    - magic link → `emailRedirectTo …/auth/confirm?next=<encoded safe path>` (`/auth/confirm` already honours `next`)
    - error redirects keep `next`, so a typo doesn't lose the destination
  - **middleware:** a guest on a gated route → `/login?next=<pathname+search>`; a signed-in user on `/login` → their safe `next` (or `/`).
- **Guest heart:** a link to `/login?next=/recipes/{slug}?fav=1`. On return, the recipe page sees `fav=1` + a session + not yet favorited → the client calls `addFavorite` once, shows the toast, and strips `fav` from the URL with `router.replace`.

## 📝 UI/UX (handoff, recipe page)
- **The button, 58 px:**
  - inactive: a 2.5 px `#c2410c` border (`border-action`), `text-action-text` "Dodaj do ulubionych"
  - active: `bg-action`, white, "W ulubionych · usuń"
  - an outline / filled heart icon, `aria-pressed`
- **The toast after adding:** "Dodano do ulubionych · **Cofnij**" (`role="status"`, ~5 s); "Cofnij" removes the favorite.
- **On error:** the optimistic state is rolled back + an inline `role="alert"` message "Nie udało się zapisać. Spróbuj ponownie."
- **`/ulubione`:** the heading "Ulubione", a grid of `RecipeCard`s (newest favorite first), and the empty state "Nie masz jeszcze ulubionych przepisów. Otwórz przepis i kliknij „Dodaj do ulubionych”."

## 📝 Edge Cases
- **A double click / a retried POST:** the upsert is idempotent, and a remove of a missing row is a no-op.
- **`fav=1` when it's already favorited:** no second add, no toast; the param is stripped.
- **`fav=1` without a session** (a stale link): the page shows the guest heart; nothing happens.
- **Open redirect through `next`:** blocked by `safeNext` (unit-tested already, reused unchanged).
- **The magic link opened in another browser:** `next` travels inside the email link, so the user still lands on the recipe there.
- **The recipe is deleted:** the cascade removes the favorites (S03a adds the guard that blocks deleting shared recipes).

## 📋 Implementation Plan
1. Migration `favorites` + RLS + grants. Checked against production in a rolled-back transaction: anon is denied; a user sees, inserts and deletes only their own rows.
2. `src/lib/favorites.ts`: a pure `parseRecipeId` + unit tests. Server actions `addFavorite` / `removeFavorite` + unit tests with a mocked client (session required, idempotent upsert).
3. Login `next`:
   - `src/lib/login-redirect.ts` (pure): `loginPath(next)` and `resolveLoginNext(raw, origin, fallback)` (wrapping `safeNext`) + unit tests
   - page, form and actions wiring
   - middleware: `next` on the redirect, and a signed-in user on `/login` → `next`
4. A `FavoriteButton` client component (optimistic, toast, auto-add on `fav=1`) and its wiring on the recipe page.
5. `/ulubione` page + the MENU item.
6. Gates (typecheck, lint, test) + a browser check of the guest → login → return flow and the heart states.
