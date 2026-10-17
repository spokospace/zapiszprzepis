# E01-S12 — OAuth login (Facebook/Google) + first-login gender + vocative greeting

Issue: #205 · Epic: #201 · Backlog: `.ai/specs/backlog-przebudowa.md` (E01-S12) · Depends on: E01-S02 (done), E01-S18 (done) · Risk: **high** (auth)

## 📝 TLDR

Today ZapiszPrzepis only signs people in by email (magic link or password), and new accounts need an invite code on `/signup`. This spec adds **"Zaloguj przez Google"** and **"Zaloguj przez Facebooka"** to `/login` (`supabase.auth.signInWithOAuth` → `/auth/callback?next=…`). The first OAuth login creates the account. After any login, a profile without a gender is sent once to a new screen, **`/witaj`** (design ref 3b), where the user chooses "Kobietą" or "Mężczyzną". The choice is final and stored in a new **owner-only** table. The app can then greet people with the Polish **vocative** ("Dzień dobry, Aniu!") through a pure util, falling back to "Dzień dobry!" when unsure. Email login stays exactly as it is.

## 📝 Problem Statement

- New users have to set up a password or wait for a magic link. Many of the target audience (older people) already have Facebook or Google, so one tap is the lower-friction path (backlog E01-S12, README 3a).
- Polish needs grammatical gender ("Dodała / Dodał") and the vocative ("Aniu", "Piotrze") for natural copy. The app currently has neither, so recipe pages say the neutral "Dodane przez" (`src/app/przepis/[slug]/page.tsx`, comment "Gender-neutral until E01-S12 supplies gender").
- The S18 migration explicitly left private attributes (gender, vocative) out of the anon-readable `profiles` table: "S12 owns the private profile surface".

## 📝 Proposed Solution

1. **OAuth sign-in (server action).** `signInWithOAuthProvider(formData)` validates the provider against an env allowlist. It calls `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` } })` on the SSR server client, which stores the PKCE verifier in a cookie, then `redirect(data.url)`. The existing `/auth/callback` already exchanges the code, so it gains error mapping and the first-login hop.
2. **Feature flag `AUTH_OAUTH_PROVIDERS`** (server env, comma-separated, e.g. `google,facebook`). The page shows a button only for each provider listed, and the action refuses any provider not listed. The default is empty: no buttons, and the code is inert in production until the owner turns it on. **The flag is UI hygiene, not the security control.** Supabase's `/auth/v1/authorize?provider=…` endpoint can be called directly whatever the flag says, so the real switch is the **provider toggle in the Supabase dashboard**. Both the toggle and the flag are turned on together, only after E01-S11 is live. **Why:** an OAuth account is created without an invite code. Until E01-S11 ships the "full access" gate on *adding* recipes, any authenticated user can add recipes (which spends Firecrawl/LLM budget). The owner enables the flag only after S11 is live (see Risks).
3. **Private profile table** `public.profiles_private` (owner-select only) holds `gender`. The only way to write it is the RPC `public.set_gender(p_gender text)` (SECURITY DEFINER), which succeeds **only while gender is null**. A trigger also rejects any change to a non-null gender for every role, including service_role. That makes the field one-time and impossible to edit (CLAUDE.md: "Płeć wybierana raz przy pierwszym logowaniu, nieedytowalna").
4. **First-login hop.** After a successful login (OAuth callback, email-link confirm, password), the shared helper `postLoginPath(supabase, next)` returns `/witaj?next=…` when the user has no gender, otherwise `next`. The helper **fails open**: if the read errors (for example the migration is not applied yet), it returns `next`, so login is never blocked by this feature.
5. **`/witaj` screen (3b).** A radio group ("Jestem…": Kobietą / Mężczyzną) and a primary "Zapisz i przejdź dalej" button. The save calls `set_gender` and redirects to the validated `next`. If gender is already set, the page redirects straight to `next`.
6. **Vocative util** `src/lib/vocative.ts`: `vocative(firstName) → string | null` (a dictionary of common names plus the fallback rules: `-sia/-cia/-zia → -iu`; `-nia → -niu` only for short diminutives of 5 letters or fewer (Ania, Hania), while full names such as Antonia/Stefania take `-o`; a short `-la` name that is not in the dictionary → null; any other `-a → -o`; anything else → null). `greeting(displayName) → "Dzień dobry, {wołacz}!" | "Dzień dobry!"` takes the first token of `profiles.display_name` and ignores the placeholder "Użytkownik". `/witaj` uses it in its heading. E01-S04 (home) consumes it next.

**Alternatives considered**

- *Client-side `signInWithOAuth` (browser client).* Rejected: the server action keeps the provider allowlist and the `next` validation on the server, and it matches the existing `signInWithEmail` action.
- *Gender column on `profiles`.* Rejected: `profiles` is anon-readable (S18 RLS `profiles_public_read`), so gender would leak to every guest.
- *Gender in `auth.users.raw_user_meta_data`.* Rejected: the user can rewrite it at will with `supabase.auth.updateUser({ data })`, so it cannot be one-time.
- *Storing the vocative.* Rejected for now: it is derived from `display_name`, which S13 lets the user edit, so a stored copy would drift. S13 can add an override column if real users need one.
- *Hard-gating every page until gender is set.* Rejected: a global gate in `proxy.ts` adds a DB read to every request and can lock people out if something breaks. The login-time hop covers "first login" with no lock-out risk.

## 📝 Architecture

```mermaid
flowchart LR
  L["/login (existing + NEW OAuth buttons)"] -->|NEW server action signInWithOAuthProvider| P[(Google / Facebook via Supabase Auth)]
  P --> C["/auth/callback (existing; NEW error map + postLoginPath)"]
  E["/auth/confirm + password action (existing)"] -->|NEW postLoginPath| W
  C -->|gender null| W["/witaj (NEW, screen 3b)"]
  C -->|gender set| N["next"]
  W -->|NEW rpc set_gender| T[(NEW profiles_private)]
  W --> N
  H["home S04 (planned)"] -.->|greeting()| V["NEW src/lib/vocative.ts"]
```

Everything stays inside the auth area (`src/app/login`, `src/app/auth/*`, the new `src/app/witaj`) plus two pure libs. No middleware change. `handle_new_user` (S18) is unchanged: it already derives `display_name`/`username` from the `full_name`/`name` metadata that Google and Facebook provide. Planned consumers: S04 (greeting), S07/S14 (gendered "Dodała/Dodał", see Resolved assumptions Q4), S13 (shows the gender read-only).

## 📝 Data Model

New migration `supabase/migrations/20261017130000_profiles_private_gender.sql` (owner-gated, idempotent):

```sql
create table if not exists public.profiles_private (
  id uuid primary key references auth.users(id) on delete cascade,
  gender text check (gender in ('female', 'male')),
  gender_set_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles_private enable row level security;
revoke all on public.profiles_private from anon, authenticated;
grant select on public.profiles_private to authenticated;
-- owner reads own row; NO insert/update/delete policies → writes only via set_gender()
create policy profiles_private_owner_read on public.profiles_private
  for select to authenticated using (id = public.current_user_id());
-- trigger: once gender is non-null it can never change (any role)
-- rpc: set_gender(p_gender text) returns text — security definer, search_path = '' (all names schema-qualified);
--      auth.uid() required; validates value; insert … on conflict (id) do update
--      set gender = excluded.gender where profiles_private.gender is null;
--      returns 'ok' | 'already_set' | 'invalid'. execute granted to authenticated only.
```

- **Sensitive data.** Gender is personal data. It is readable only by its owner and never by anon or other users. It is not joined into `public_recipes`/`profiles` views. There is no backfill: a missing row means "not chosen".
- **Rows are lazy.** The row is created by `set_gender`, so `handle_new_user` is untouched.
- **Rollback.** `drop function public.set_gender(text); drop table public.profiles_private;` loses only the gender choices. This is documented in the migration header.
- **Types.** `src/lib/supabase.types.ts` is stale (it lacks `profiles`/`favorites`) and no client is typed with it, so the implementation uses local row types. Regenerating the types is a separate chore.

## 📝 API Contracts

- **Server action `signInWithOAuthProvider(formData: { provider, next })`** (`src/app/login/actions.ts`)
  - `provider` must be in `parseOAuthProviders(process.env.AUTH_OAUTH_PROVIDERS)`, otherwise redirect `/login?error=oauth_unavailable`.
  - `next` goes through the existing `resolveLoginNext(raw, origin, '/')`.
  - Success → `redirect(data.url)` (the provider). Error → `/login?error=oauth_failed` (keeping `next`).
- **`GET /auth/callback`**: unchanged success path, except the final target becomes `await postLoginPath(supabase, next)`. Inbound errors map with exact matching (no substring checks, per `context/foundation/lessons.md`):
  - `error_code=email_exists` → `oauth_email_exists`
  - `error_code=provider_email_needs_verification` → `oauth_verify_email`
  - `error=server_error` + `error_description="Error getting user email from external provider"` (exact) → `oauth_no_email`
  - `error=access_denied` with **no** `error_code` (the user cancelled at the provider) → `oauth_cancelled`
  - `provider_disabled` / `oauth_provider_not_supported` → `oauth_unavailable`
  - everything else → existing `mapAuthError`
- **Server action `saveGender(formData: { gender, next })`** (`src/app/witaj/actions.ts`) → `rpc('set_gender')`.
  - `'ok'` or `'already_set'` → `redirect(safe next)`.
  - `'invalid'` → `/witaj?error=invalid&next=…`.
  - RPC error → `/witaj?error=unknown&next=…`.
  - Unauthenticated → `/login?next=/witaj…`.
- **`postLoginPath(supabase, next): Promise<string>`** (`src/lib/first-login.ts`): `select gender from profiles_private where id = auth user` (maybeSingle). `null` row or `null` gender → `/witaj?next=${encodeURIComponent(next)}`. Gender set or any error → `next`.
- **Pure libs**: `parseOAuthProviders(raw) → ('google'|'facebook')[]` (trimmed, lowercased, deduped, unknown dropped); `vocative(name) → string | null`; `greeting(displayName) → string`.

## 📝 UI/UX

**`/login` (existing screen, additions only).** Above the existing Link/Hasło tabs, when at least one provider is enabled:

- Full-width buttons, 56 px tall, white background, `border-field` border (3:1), `text-ink`, 19 px label. Each has an inline brand logo (aria-hidden) **and** a text label: "Zaloguj przez Google", "Zaloguj przez Facebooka". Focus: `outline 3px #1d4ed8, offset 2px`.
- A divider "lub emailem" (text, `#374151`, ≥ 16 px), then the unchanged email form.
- Each button is a `<form action={signInWithOAuthProvider}>` with hidden `provider` + `next`. A pending state ("Przekierowuję…") disables the buttons.
- New error copy (`role="alert"`):
  - `oauth_cancelled`: "Logowanie zostało przerwane. Spróbuj ponownie."
  - `oauth_no_email`: "Twoje konto Facebook nie ma adresu email. Zaloguj się przez Google albo linkiem email."
  - `oauth_email_exists`: "Masz już konto z tym adresem email. Zaloguj się linkiem email."
  - `oauth_verify_email`: "Wysłaliśmy email z potwierdzeniem — kliknij link, a potem zaloguj się ponownie."
  - `oauth_unavailable`: "Logowanie przez tę usługę jest chwilowo niedostępne."
  - `oauth_failed`: "Nie udało się rozpocząć logowania. Spróbuj ponownie."

**`/witaj` (new, screen 3b).** Logo; heading `greeting(display_name)`; lead "Jedno pytanie na start."

- `<fieldset>` with `<legend>` "Jestem" and two radio options, "Kobietą" and "Mężczyzną". Each is a full-width label card ≥ 56 px with `border-field`; the selected one gets a 3 px `#1d4ed8` ring plus a ✓ and "wybrane" text, so the state is not signalled by colour alone.
- Helper text (`#374151`, 16 px): "Dzięki temu dobrze odmienimy słowa, np. „Dodała” / „Dodał”. **Tego wyboru nie można później zmienić.**"
- Primary button "Zapisz i przejdź dalej": `bg-action` (`#c2410c`), white text, 56 px, disabled until an option is chosen.
- Errors use `role="alert"`.
- 19 px body text, no horizontal scroll at 320 px, and the visible text is the accessible name of every control.

Prototype: `.ai/specs/assets/oauth-login-gender-vocative/` (static mockups attached to the spec PR).

## 📝 Edge Cases & Failure Scenarios

- **Same email, Google + existing email account.** Supabase links identities with the same verified email to one user automatically, so the user signs into their existing account and recipes and favorites are preserved. This needs no code.
- **Facebook email unverified or colliding.** Supabase returns `provider_email_needs_verification` (and sends a confirmation email) or `email_exists`. The user gets a specific message and the email path still works. Manual identity linking (`linkIdentity`) is out of scope and deferred to S13.
- **Facebook account without email.** Supabase cannot create the user and returns the exact `server_error` description, which maps to `oauth_no_email` with alternatives. No partial account is created.
- **User cancels at the provider** → `oauth_cancelled`.
- **Provider not enabled in Supabase yet but listed in the flag** → `provider_disabled` → `oauth_unavailable`. The email login is unaffected.
- **Migration not applied yet when the code deploys.** `postLoginPath` fails open (no `/witaj` hop). If someone opens `/witaj` directly, the RPC error shows the generic `unknown` error, and every other part of the app works.
- **Double submit / two tabs on `/witaj`.** `set_gender` is first-write-wins (`where gender is null`). The second call returns `already_set` and redirects, and the stored value never changes.
- **Tampered form value** (`gender=other`): the RPC returns `invalid` and the DB `check` constraint is a second guard.
- **Open redirect via `next`.** Every hop (`/login` → provider → `/auth/callback` → `/witaj` → `next`) re-validates with `safeNext` (same origin only). `safeNext` must also reject a resolved path that starts with `//`: `new URL('/.//evil.com', origin)` keeps our origin, but its pathname is the protocol-relative `//evil.com`. This was found in review and is fixed in the implementation.
- **Existing users (email) with no gender** are asked once at their next login. Already-open sessions are not interrupted.
- **Name the util doesn't know** ("Xawery", "Dżesika") → `vocative` returns null → "Dzień dobry!".

## 📝 Risks & Impact Review

- **Account creation without an invite (security, ordering).** OAuth opens self-signup. Today *any* authenticated user can add recipes, so enabling OAuth before E01-S11's full-access gate would let anyone spend extraction budget. **Mitigation:** the providers stay **disabled in the Supabase dashboard**, which is the real control because the authorize endpoint is public, and `AUTH_OAUTH_PROVIDERS` stays unset. The owner turns both on together, only after S11 is live in production. S11 (#244) grants full access only through a redeemed code or the grandfather backfill, so new OAuth accounts start without it. The code itself is safe to merge and deploy before then.
- **Irreversible user choice.** Gender cannot be edited by the user. Correcting a mistake is an owner-only SQL operation (`update … ; -- with the trigger disabled`), documented in the migration header. This is deliberate, per the CLAUDE.md product decision.
- **Personal data.** A new owner-only table. Verify the anon/other-user read denial in the rehearsal (RLS) and with unit tests on the read helper.
- **Supabase redirect allowlist.** `redirectTo` must match the project's allowed redirect URLs, or Supabase falls back to the Site URL and `next` is lost. This is an owner step, listed below.
- **Meta app review.** In Development mode only app testers can log in with Facebook. Public launch needs Meta App Review for `email` + `public_profile`. This is an owner step.
- **Rollback.** Unset `AUTH_OAUTH_PROVIDERS`: the buttons disappear immediately and existing OAuth users can still log in via the email link, because their account has an email. The DB rollback is in the migration header.

### Owner-only steps (not automatable)

1. **Google Cloud Console** → APIs & Services → OAuth consent screen (External, app name "ZapiszPrzepis", support email, authorised domain `zapiszprzepis.pl`, scopes `openid`, `email`, `profile`) → Credentials → *Create OAuth client ID* (Web application). Authorised JavaScript origins: `https://zapiszprzepis.pl`. Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. Copy the Client ID and Client secret.
2. **Meta for Developers** → Create App (use case "Authenticate and request data from users with Facebook Login") → Facebook Login → Settings → Valid OAuth Redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`. Use Cases → Authentication → ensure `email` + `public_profile`. Settings → Basic: App domain `zapiszprzepis.pl`, privacy policy URL, data-deletion URL. Copy the App ID and App secret. Add yourself and testers under App Roles. Submit App Review before the public launch.
3. **Supabase Dashboard** (**only after E01-S11 is live**; this toggle is the real security switch) → Authentication → Sign In / Providers → enable **Google** and **Facebook** with the IDs and secrets above. Authentication → URL Configuration → Redirect URLs: add `https://zapiszprzepis.pl/auth/callback**` (and `http://localhost:3000/auth/callback**` for local dev). Keep "Allow new users to sign up" on (needed for the first OAuth login).
4. **Apply the migration** `20261017130000_profiles_private_gender.sql` (Management API query path, per the project runbook) and register its version in `supabase_migrations.schema_migrations`.
5. **Together with step 3**, set `AUTH_OAUTH_PROVIDERS=google,facebook` on the Cloudflare Worker (Workers → Settings → Variables) and redeploy via Workers Builds. Verify both buttons on production.

## 📋 Phasing

- **Phase 1:** vocative + greeting util (pure, no UI). Shippable alone.
- **Phase 2:** `profiles_private` migration + `set_gender` RPC + types + rolled-back rehearsal (file only, owner applies).
- **Phase 3:** OAuth buttons + server action + flag + callback error mapping. Inert until the flag is set.
- **Phase 4:** `/witaj` screen + `postLoginPath` hop in callback/confirm/password. Fails open until Phase 2 is applied.

## 📋 Implementation Plan

### Phase 1 — Vocative util
1. `src/lib/vocative.ts`: `vocative(name)` (normalise case, dictionary of about 80 common Polish first names including irregulars such as Piotr→Piotrze, Paweł→Pawle, Marek→Marku, Ola→Olu, Ela→Elu; fallback rules `-sia/-nia/-cia/-zia→…iu`, `-a→-o`; else null) and `greeting(displayName)`. Unit tests in `src/lib/vocative.test.ts` cover the dictionary hits, each fallback rule, the uppercase/diacritics input, the "Użytkownik" placeholder, an empty value and an unknown name.

### Phase 2 — Private profile table (owner-gated)
2. Migration `20261017130000_profiles_private_gender.sql` (idempotent: `if not exists` / `create or replace` / guarded policy + trigger creation) with the table, RLS, the immutability trigger and the `set_gender` RPC, plus a rollback note.
3. `.ai/qa/s12-rehearse-profiles-private.sql`: a rolled-back rehearsal that asserts the RPC first-write-wins, `already_set`, `invalid`, the trigger blocking a direct update, and anon having no select. Run it against production with the rollback, and record `REHEARSAL_RESULT` in the PR.
4. Types: none. The implementation uses local row types (see Data Model).

### Phase 3 — OAuth sign-in
5. `src/lib/oauth-providers.ts` (`parseOAuthProviders`) + tests.
6. `signInWithOAuthProvider` server action; `/login` page reads the flag and passes `providers` to `SignInForm`; new `OAuthButtons` component (tokens, 56 px, labelled icons) + error copy.
7. Extend `src/lib/safe-redirect.ts` with `inboundOAuthError(errorCode, error, description)` (exact matches) + tests; wire into `/auth/callback`.

### Phase 4 — First-login gender screen
8. `src/lib/first-login.ts` `postLoginPath` (pure decision fn `firstLoginTarget(gender | null | 'error', next)` unit-tested + thin Supabase wrapper).
9. `/witaj` page + `saveGender` action (+ tests for the action's result mapping via a pure `genderSaveRedirect` helper).
10. Use `postLoginPath` in `/auth/callback`, `/auth/confirm` action and `signInWithPassword`.
11. Local gate (`pnpm typecheck`, `pnpm lint`, `pnpm test`) + UI screenshots of `/login` (flag on, mocked env) and `/witaj`.

## Resolved assumptions (autonomous defaults)

| # | Question | Default chosen | Rationale |
|---|----------|----------------|-----------|
| Q1 | OAuth creates accounts without an invite code, but S11's add-gate isn't live. Ship OAuth enabled? | **No: providers disabled in Supabase (the real control) and `AUTH_OAUTH_PROVIDERS` unset; enable both only after S11 is live** | Never weaken access control; it is fully reversible by an env var. |
| Q2 | Where does gender live? | **New owner-only `profiles_private` table, written only via `set_gender` RPC** | `profiles` is anon-readable (S18); `user_metadata` is user-editable. |
| Q3 | Store the vocative? | **No, compute it from `display_name` at render** | Smallest schema; no drift when S13 edits the name. |
| Q4 | Show gendered "Dodała/Dodał" publicly now? | **Defer to S07/S14** (public pages stay "Dodane przez") | Exposing a derived gender form to guests is a separate privacy/product call that S07/S14 must make explicitly (it would need a public projection of the verb form, never of `gender` itself). |
| Q5 | Hard-gate the whole app until gender is chosen? | **No, a login-time hop to `/witaj` only, fail-open** | No lock-out risk and no per-request DB read. |
| Q6 | Facebook account without email: allow email-less users? | **No, show a clear message and offer Google or the email link** | Supabase requires an email; email-less accounts would break the email-link fallback and dedup by email. |
| Q7 | Email-collision handling? | **Rely on Supabase automatic linking for verified emails; map `email_exists` / `provider_email_needs_verification` to messages; manual `linkIdentity` deferred to S13** | Least new surface; no custom linking code in a risk-high area. |
| Q8 | Keep email login? | **Yes, unchanged (magic link + password + invite `/signup`)** | Task constraint; it is also the fallback for every OAuth failure. |
| Q9 | Split into separate specs (OAuth vs gender vs vocative)? | **One spec, four independently shippable phases** | The backlog bundles them as one story; the phases give the same reversibility. |
