# E01-S06 — Favorites: the heart on cards + `fav=` at login (gap closure)

> Backlog: `.ai/specs/backlog-przebudowa.md` (E01-S06), issue #209. Risk: **medium** (login completion path, a shared card component). Builds on the first favorites spec, `.ai/specs/2026-10-16-favorites.md`, which is live: the `favorites` table + RLS, `addFavorite` / `removeFavorite`, `FavoriteButton` on the recipe page, `/ulubione`, and the menu counter (S09). **No database change.**

## 📝 TLDR
What is live today covers the recipe page only. The backlog story asks for more, so three gaps stay open:
- **The heart on cards.** The acceptance criterion says "na karcie/przepisie", but cards have no heart yet. The first spec deferred it to the card redesign (S04/S05), and S04 has since shipped.
- **`/login?next={url}&fav={id}`, handled at login completion.** Today the recipe ID never reaches login. The heart sends the guest to `/login?next=/przepis/{slug}?fav=1`, and the recipe page adds the favorite in the browser once the guest is back. That works only for a heart on the recipe page. A heart on a card on the home page or a category page has no recipe page to come back to.
- **One heart component.** The same optimistic toggle, toast and guest link serve both the recipe page (full size) and cards (compact).

*Proposed (future behavior):*
- Every recipe card on the guest home, category pages and `/ulubione` has a labelled heart.
  - Off: "Ulubione". On: "W ulubionych".
  - It is a 48 px target, separate from the card's link.
- A guest who taps any heart goes to `/login?next={current page}&fav={recipe id}`.
  - Whichever way they sign in (password, magic link, Google/Facebook), the favorite is saved **on the server as the login completes**.
  - They land back on the page they started from, and see "Dodano do ulubionych · Cofnij".

## 📝 Problem Statement
- Guests browse lists, not only recipe pages. A heart that works only on the recipe page fails the story's main use, "zakładka na dowolny przepis", from the list views.
- The browser-side auto-add after the return needs JavaScript to run on the very page that holds the heart. It cannot cover a card heart, whose page may not list the recipe any more by the time the guest is back (the home page's recent list moves).

## 📝 Proposed Solution
1. **`fav` rides on `/login` and folds into `next`.**
   - The login page reads `fav`. When `fav` is a valid recipe ID, the page appends `add_fav={id}` to the `next` path (a distinct name, so a retired `?fav=1` link can never favorite recipe #1) (`withFavoriteIntent(next, fav)`) before it hands `next` to the forms.
   - Nothing else in the login plumbing changes. The password action, the magic-link `emailRedirectTo` and the OAuth `redirectTo` already carry `next` end to end and re-validate it with `safeNext`.
2. **The one login-completion funnel applies it.**
   - `postLoginPath(supabase, next)` (S12) is the single exit of all three login paths: the password action, `/auth/confirm` for a sign-in link, and `/auth/callback` for OAuth.
   - It first calls `applyFavoriteIntent(supabase, userId, next)`, which:
     - reads `add_fav` from `next`
     - adds the favorite with the existing idempotent `insertFavorite`
     - rewrites `next` as `fav_added={id}` on success, or drops `add_fav` on failure
   - The `/witaj` detour on a first login still works, because the rewritten `next` is what it carries.
3. **A heart that sees `fav_added={its id}` on mount shows the toast once and strips the param.** A module-level claim stops two hearts for the same recipe (say, a card and a list) from both showing a toast.
   - **A landing page with no heart for that recipe.** A guest's heart on the guest home sends them back to `/`, which is the signed-in home once they log in, and it lists no cards. So the signed-in home renders a standalone notice (`FavoriteAddedNotice`) when `fav_added` is present. It shows the same toast with a working "Cofnij" and strips the param the same way.
4. **The recipe page drops its browser-side `?fav=1` auto-add.** It is replaced by steps 1–3. The recipe page's guest link becomes `loginPath(currentPath, recipeId)`.
5. **`FavoriteButton` gains `size: 'full' | 'compact'`.**
   - `full`: the recipe page, unchanged copy ("Dodaj do ulubionych" / "W ulubionych · usuń", 58 px).
   - `compact`: cards ("Ulubione" / "W ulubionych", 48 px).
   - The guest link is built inside the component from the current URL, so pages don't pass it.
6. **`RecipeCard` takes an optional `favorite` prop** (`{ recipeId, favorited, isAuthenticated }`).
   - With the prop, the card renders the heart in a footer.
   - Without it, the card shows no heart. That keeps parallel callers (S05 search, S16 similar recipes) working unchanged until they opt in.
   - The card becomes an `<article>` whose title link is stretched over the whole card (`after:absolute after:inset-0`), so the card stays clickable and the heart is not nested in a link (no interactive element inside `<a>`).

## 📝 Architecture
- `src/lib/favorites.ts` (pure + DB helpers):
  - `withFavoriteIntent(next, rawFav)`
  - `readFavoriteIntent(next)`
  - `applyFavoriteIntent(supabase, userId, next)`
  - `getFavoriteIds(supabase, userId, recipeIds): Promise<Set<number>>`, a single `in` query for a page of cards
- `src/lib/first-login.ts`: `postLoginPath` calls `applyFavoriteIntent` after it reads the user. S12 owns the file. The change is one line plus the import.
- `src/lib/login-redirect.ts`: `loginPath(next, fav?)` builds `/login?next=…&fav=…`. `favoriteReturnPath` is removed.
- `src/app/login/page.tsx`: reads `fav` and passes `withFavoriteIntent(next, fav)` to `OAuthButtons` and `SignInForm`.
- `src/app/components/favorite-button.tsx`: the `size` variant, a self-built guest link, the `fav_added` toast, and a persistent live region.
- `src/app/components/recipe-card.tsx`: the optional `favorite` prop and the stretched-link structure.
- The pages that list cards look up favorite IDs for a signed-in user: `/` (guest home, so guest hearts only), `/przepisy/[kategoria]`, and `/ulubione` (all on). `/recipes` stays with S05, which opts in through the prop.
- The recipe page: `fav` and `autoAddFavorite` are removed, and the guest link comes from the component. The edits stay inside the favorites slot (`recipe-actions.tsx` and the `fav` lines of `page.tsx`).

## 📝 API Contracts
- `GET /login?next=<path>&fav=<positive int>`
  - An invalid `fav` (`0`, `-1`, `abc`, a float) is ignored.
  - An unsafe `next` follows the `safeNext` rule (→ `/`).
- `applyFavoriteIntent(supabase, userId, next) → Promise<string>`
  - It never throws, and login must never fail because of a favorite.
  - No `fav` in `next` → `next` unchanged.
  - The insert succeeds or the row is a duplicate → `fav` is replaced with `fav_added={id}`.
  - Any other error → `fav` is dropped and the error is logged (`code` only).
- `getFavoriteIds(supabase, userId, ids)`
  - An empty `ids` makes no query and returns an empty set.
  - On error it returns an empty set, so the hearts render "off" and a click still works.

## 📝 UI/UX
- **Card footer** (`compact`):
  - A full-width button with min-height 48 px, 16 px bold text, a 2 px border.
  - Off: `border-action`, white, `text-action-text`, outline heart, "Ulubione".
  - On: `bg-action` with white text, filled heart, "W ulubionych".
  - `aria-pressed`, the focus ring from the global token, and `relative z-10` so it sits above the stretched link.
- **Guest card heart:** a link that looks like the off button and points to `/login?next=…&fav=…`.
- **Toast:**
  - A fixed bottom bar, `bg-ink` with white text at 17 px, "Dodano do ulubionych ·" followed by a "Cofnij" button (48 px, underlined).
  - It lives ~5 s.
  - It renders inside an always-mounted `role="status"` region, so screen readers announce it reliably.
  - The recipe page uses the same fixed toast, so both sizes behave alike.
- **Error:** the optimistic state rolls back, plus "Nie udało się zapisać. Spróbuj ponownie." (`role="alert"`). On a card, the message sits under the button.
- Never a star. The heart icon always has its text.

## 📝 Edge Cases & Failure Scenarios
- **A signed-in user opens `/login?next&fav` from a stale guest tab.** The middleware redirects to `next` without the favorite. The page then renders the heart as a button, and the user taps again. This is accepted, because the middleware cannot write data.
- **A `fav` for a deleted or non-existent recipe.** The foreign key fails, `fav` is dropped, and the user still logs in.
- **A crafted link from someone else** (`/login?next=/&fav=123`). Logging in through it favorites recipe 123. The harm is trivial, it shows up as a visible toast with "Cofnij", and no data leaks. All three completions are POSTs or a code exchange bound to PKCE, so a bare GET cannot trigger it.
- **A password-recovery link.** It skips `postLoginPath`, so the intent is ignored.
- **The `/witaj` first-login detour.** The favorite is already saved before the detour, and `fav_added` reaches the final page.
- **Removing a favorite on `/ulubione`.** `revalidatePath('/ulubione')` re-renders the page and the card leaves the list.
- **A `next` whose query holds a `/` (a search phrase, say).** The intent is added and removed as raw `&key=value` text, never by re-serializing the whole query. `URLSearchParams` would turn `/` into `%2F`, which `safeNext` rejects, and the user would land on `/` without their favorite.
- **Old `?fav=1` links mid-flight during the deploy.** They are ignored, and the guest lands on the recipe signed in and taps again.

## 📝 Risks & Impact Review
- **The `RecipeCard` restructure touches every list.** The props stay backward compatible and the visuals are unchanged apart from the heart footer. Parallel sessions (S05, S16) only need to resolve merge conflicts. S05's search cards must use this one heart (`RecipeCard`'s `favorite` prop or `FavoriteButton size="compact"`) and this one `getFavoriteIds`, not a second card heart or a second lookup helper.
- **`first-login.ts` belongs to S12.** The change is additive, and the funnel fails open as before.
- **No migration, no change to RLS or grants.** Favorites need no full access (S11). The existing policy is `user_id = current_user_id()` only.

## Resolved assumptions (autonomous defaults)
| # | Question | Default | Why |
|---|---|---|---|
| Q1 | Where does the `fav` intent get applied? | Server side, in `postLoginPath` (all three login completions) | One funnel; works for card hearts; POST/PKCE-bound, not a GET side effect. Reversible. |
| Q2 | How does `fav` reach the completion? | Folded into `next` by the login page | Zero changes to forms, actions, OAuth and confirm plumbing that already carry `next`. Reversible. |
| Q3 | Card label | "Ulubione" / "W ulubionych" (compact) | Fits a 2-column mobile grid at 16 px; the full "Dodaj do ulubionych" stays on the recipe page. Reversible. |
| Q4 | Which lists get the heart now? | Guest home, `/przepisy/[kategoria]`, `/ulubione` | `/recipes` is S05's search surface, so S05 and S16 opt in via the `favorite` prop. Reversible. |
| Q5 | Toast after the login round-trip? | Yes, via `fav_added={id}`, once per page | Keeps the decided "Dodano do ulubionych · Cofnij" (first spec, Q3). Reversible. |

## 📋 Implementation Plan
1. `src/lib/favorites.ts`: `withFavoriteIntent`, `readFavoriteIntent`, `applyFavoriteIntent` and `getFavoriteIds`, with unit tests for valid and invalid `fav`, duplicates, errors and an empty ID list. `loginPath(next, fav?)` with tests, and `favoriteReturnPath` removed.
2. Wire `applyFavoriteIntent` into `postLoginPath`, with tests for: intent + gender set, intent + first login (`/witaj` carries `fav_added`), and no intent. The login page folds `fav` into `next`.
3. `FavoriteButton`:
   - the `size` variant
   - a self-built guest link from `usePathname` + `window.location.search`
   - the `fav_added` toast with its module-level claim
   - the fixed toast inside a persistent live region
   - `autoAdd` removed
4. `RecipeCard`: the `<article>` + stretched-link structure and the optional `favorite` footer.
5. Wire `getFavoriteIds` into `/`, `/przepisy/[kategoria]` and `/ulubione`, render `FavoriteAddedNotice` on the signed-in home, and update the recipe page's favorites slot.
6. Run the gates (typecheck, lint, test) and check in the browser: card hearts as a guest and signed in, the guest → login → return flow with the toast, and the 48 px target and focus ring.
