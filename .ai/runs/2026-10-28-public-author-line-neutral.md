# Execution plan — public author line neutral, gender optional (#376)

Issue: #376 (E02-S08) · Epic: #368 · Audit: `context/foundation/code-audit-2026-10-20.md` §3f F1, F3, F9

## Goal

What others see about a user matches the privacy policy ("Nigdy nie pokazujemy innym … płci"), and no user is forced to give their gender.

## Owner decision (2026-10-28, in the task conversation)

- Public pages use neutral wording by default: „Dodane przez {nazwa}” on recipe pages and neutral copy on `/u/{username}` (option A).
- "Better something neutral than a pop-up question": the forced `/witaj` gender step after login (and the middleware detour for older accounts) is removed. Gender becomes optional; already stored genders still shape wording the user sees about themselves.

## Scope

- DB: neutralise `public_recipes.author_gender_form` (always null) and revoke `execute` on `profile_gender_form` from `anon` and `authenticated`.
- App: recipe header and `/u/{username}` always neutral; drop the RPC call; remove the post-login and middleware gender detours and the `zp-gender` cookie (expired on sight).
- Copy: privacy policy §2 (gender optional), regulamin §4, effective date; CLAUDE.md rules.

## Non-goals

- Gendered wording a user sees about themselves (vocative greetings, "Dodałaś") — unchanged.
- Deleting `/witaj`, `set_gender` or stored genders — the page stays reachable directly, just not forced.
- Dropping the `author_gender_form` column (kept, nulled, so `select('*')` consumers and column order are unaffected).

## Implementation Plan

### Phase 1: Database
- 1.1 Migration: `author_gender_form` → `null::text`, drop the `profiles_private` join from the view, revoke `profile_gender_form` from anon/authenticated; static migration test.

### Phase 2: App
- 2.1 Recipe header and `/u/{username}` always neutral; stop calling `profile_gender_form`.
- 2.2 Remove the forced gender detour (post-login + middleware) and the `zp-gender` cookie.

### Phase 3: Copy and rules
- 3.1 Privacy policy, regulamin, effective date.
- 3.2 CLAUDE.md rules ("Kto dodał", gender at first login).

## Risks

- The migration must be applied to production by the owner (Management API, repo convention). The app change is safe before it: it no longer reads the form.
- `create or replace view` keeps names/types/order; only the expression of one column changes.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database

- [ ] 1.1 Neutralise author_gender_form and revoke profile_gender_form from guests

### Phase 2: App

- [ ] 2.1 Neutral author wording on public pages
- [ ] 2.2 Remove the forced gender detour and zp-gender cookie

### Phase 3: Copy and rules

- [ ] 3.1 Privacy policy, terms and effective date
- [ ] 3.2 CLAUDE.md rules
