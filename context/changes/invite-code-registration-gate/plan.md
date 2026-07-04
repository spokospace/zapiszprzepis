---
change_id: invite-code-registration-gate
title: Invite-code registration gate
description: New account creation requires a valid invite code; registration becomes passwordless magic-link + code, and the login magic-link backdoor is closed
author: Szymon
status: planned
dependencies:
  - S-01 (first-shared-recipe-fb-text) — auth (magic-link, requireUser) present on master
---

# Invite-code registration gate — Implementation Plan

## Overview

Close open registration on the public domain `zapiszprzepis.pl`. New account creation must require a valid invite code. Registration is reshaped to passwordless magic-link + invite code (consistent with the PRD's passwordless vision), and the second, implicit account-creation path — the magic-link tab on `/login`, which today provisions any brand-new email — is closed. Existing users (mama) are unaffected.

## Current State Analysis

Two paths create accounts today:

1. **Password signup** — `signUp({ email, password })` in `src/app/signup/actions.ts:28`, driven by `src/app/signup/signup-form.tsx` (email + password + passwordConfirm).
2. **Magic-link login** — `signInWithOtp({ email })` in `src/app/login/actions.ts:20`. Supabase defaults `shouldCreateUser: true` and the code never overrides it, so **an email that has never registered gets provisioned on click** — a backdoor around any signup-only gate.

`signInWithPassword` (`src/app/login/actions.ts:53`) never creates users, so existing-user password login is unaffected by a gate. Errors are surfaced via `?error=<code>` searchParam mapped to Polish in an `ERROR_MESSAGES` record in the client form. Env is read through `src/lib/env.ts` (`server-only`): `requireEnv(name)` throws at module load for hard-required vars; lazy getters (e.g. `getSuabaseServiceRoleKey()`) call `requireEnv` only at runtime to avoid build-time throws for secrets.

## Desired End State

- `/signup` collects **email + invite code** (no password). A valid code → a magic link is sent (`shouldCreateUser: true`); clicking it creates the account and logs in. A wrong/missing code → a clear error, no link sent.
- `/login` magic-link tab uses `shouldCreateUser: false` → existing users get their link as before; a brand-new email creates nothing and sees a neutral "no account — register with a code" message.
- Password login (`signInWithPassword`) unchanged; existing password users keep working.
- `INVITE_CODE` is read via a lazy getter in `lib/env.ts`.

Verified by: registering with a valid code sends a link and creates an account on click; wrong code is rejected; an existing user still logs in via magic-link without a code; a new email on the login tab creates no account.

## What We're NOT Doing

- **One-time / revocable codes, per-invitee codes, expiry, audit table** — single shared env code is enough for 1–2 users (chosen mechanism). A codes table is a future change if invites scale.
- **Ripping out the password login tab** — existing password users keep it; only *signup* becomes passwordless.
- **Constant-time code comparison** — plain equality is acceptable for a personal app; not a high-value timing target.
- **Disabling signups at the Supabase project level** — app-level gate is the deliverable; flipping the Supabase dashboard "allow new users" is optional defense-in-depth noted in Migration.
- **Email-enumeration hardening** on the login "no account" message — acceptable for this audience.

## Implementation Approach

Gate at both creation points. Phase 1 turns signup into code-gated magic-link. Phase 2 closes the login backdoor with `shouldCreateUser: false`. Both reuse the existing `?error=<code>` + `ERROR_MESSAGES` UX and the `lib/env.ts` lazy-getter pattern.

## Critical Implementation Details

**Sequencing / correctness (do not skip Phase 2):** the invite gate is only real if BOTH creation paths are covered. Gating `signUp` alone leaves the `/login` magic-link tab as a bypass, because Supabase's `signInWithOtp` defaults `shouldCreateUser: true`. Phase 2 (`shouldCreateUser: false` on login) is load-bearing, not optional polish.

**Supabase error mapping:** with `shouldCreateUser: false`, `signInWithOtp` for a non-existent user returns an error (e.g. code around `otp_disabled` / "Signups not allowed"). Map it via an exact-equality `Set` of known codes to the friendly "no account" message — do NOT use `String.includes` (see `context/foundation/lessons.md` — exact-equality Set match for error-code mapping).

## Phase 1: Registration via magic-link + invite code

### Overview

`/signup` becomes email + invite code → code-gated magic link.

### Changes Required:

#### 1. Invite code env accessor

**File**: `src/lib/env.ts`

**Purpose**: Expose the shared invite code to server code without throwing at build time (the value is a deployment secret).

**Contract**: Add `export function getInviteCode(): string` that returns `requireEnv('INVITE_CODE')`. Lazy getter, mirroring `getSuabaseServiceRoleKey()` — called at runtime in the signup action, not at module load.

#### 2. Code-gated magic-link signup action

**File**: `src/app/signup/actions.ts`

**Purpose**: Replace password `signUp` with a code-gated magic-link send. Validate email and the invite code, then send an OTP that is allowed to create the user.

**Contract**: `signUp(formData)` reads `email` + `inviteCode`. Validate email (reuse existing regex) → on failure `redirect('/signup?error=invalid_email&email=...')`. Compare `inviteCode` against `getInviteCode()` → on mismatch/empty `redirect('/signup?error=invalid_code&email=...')` (do not reveal the code). On valid: `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: \`${siteUrl}/auth/callback\` } })` (use the same `getSiteUrl()` helper login uses). On success `redirect('/signup?sent=1&email=...')`; on Supabase error map to `?error=server`. Remove all password / passwordConfirm logic.

#### 3. Signup form: email + code, sent state

**File**: `src/app/signup/signup-form.tsx`

**Purpose**: Collect email + invite code instead of passwords, and show a "check your email" confirmation after a link is sent.

**Contract**: Replace the `password` and `passwordConfirm` inputs with a single `inviteCode` text input (name `inviteCode`, label "Kod zaproszenia"). Keep the email input + prefill. Add `invalid_code` (and `invalid_email`) to the `ERROR_MESSAGES` record. Add a `sent` prop-driven confirmation state ("Sprawdź email — wysłaliśmy link do rejestracji") mirroring the login form's magic-link sent state. Keep the `role="alert"` error rendering.

#### 4. Signup page: pass `sent`

**File**: `src/app/signup/page.tsx`

**Purpose**: Forward the new `sent` searchParam to the form.

**Contract**: Read `sent` from `searchParams` alongside `error`/`email` and pass to `<SignUpForm>`.

### Success Criteria:

#### Automated Verification:
- [ ] Typecheck passes: `pnpm typecheck`
- [ ] Lint passes (0 errors): `pnpm lint`
- [ ] Build compiles: `pnpm build`

#### Manual Verification:
- [ ] Signup with a valid code + email → "sprawdź email" state; a magic link arrives; clicking it creates the account and lands logged in on `/recipes`.
- [ ] Signup with a wrong or empty code → "nieprawidłowy kod" error, no email sent, no account created.
- [ ] Signup form no longer shows password fields.

## Phase 2: Close the login magic-link backdoor

### Overview

The `/login` magic-link tab stops creating new users.

### Changes Required:

#### 1. shouldCreateUser:false on login OTP

**File**: `src/app/login/actions.ts`

**Purpose**: Prevent the login magic-link from provisioning brand-new accounts, while existing users keep getting links.

**Contract**: In `signInWithEmail`, pass `options: { shouldCreateUser: false, emailRedirectTo }` to `signInWithOtp`. Map the "no such user" error (exact-equality `Set` of Supabase codes) to a new `no_account` error code → friendly message "Nie znaleziono konta. Zarejestruj się z kodem zaproszenia." Existing success path (`?sent=1`) unchanged.

#### 2. Login form: `no_account` message

**File**: `src/app/login/signin-form.tsx`

**Purpose**: Render the new neutral message.

**Contract**: Add `no_account` to the `ERROR_MESSAGES` record with the friendly Polish copy (optionally linking to `/signup`).

### Success Criteria:

#### Automated Verification:
- [ ] Typecheck passes: `pnpm typecheck`
- [ ] Lint passes (0 errors): `pnpm lint`
- [ ] Build compiles: `pnpm build`

#### Manual Verification:
- [ ] Existing user requests a magic link on `/login` (no code) → link arrives, login works.
- [ ] Brand-new email on the `/login` magic-link tab → no account created; sees the "no account — register" message.
- [ ] Existing password user logs in via the password tab → unaffected.

## Testing Strategy

### Manual test steps:
1. Set `INVITE_CODE` locally; open `/signup`, enter a new email + valid code → expect "sprawdź email"; complete via the emailed link → logged in.
2. `/signup` with a bad code → rejected, no email.
3. `/login` magic-link with the email from step 1 (now existing), no code → link works.
4. `/login` magic-link with a fresh never-registered email → "no account" message, no user created (verify in Supabase auth users).
5. `/login` password tab with an existing password user → works.

## Migration Notes

- Add `INVITE_CODE` to local `.env.local` (local dev targets prod Supabase — see [[local-dev-against-prod]]) and as a Cloudflare Worker secret for production (`wrangler secret put INVITE_CODE`, or `vars`/secret per `wrangler.jsonc`).
- Optional defense-in-depth: in the Supabase dashboard, disabling "Allow new users to sign up" would also block the OTP-create path at the provider level; not required once `shouldCreateUser: false` ships.
- No DB migration (env-based mechanism).

## References

- Change identity: `context/changes/invite-code-registration-gate/change.md`
- Signup: `src/app/signup/actions.ts:28`, `src/app/signup/signup-form.tsx`
- Login: `src/app/login/actions.ts:20` (OTP), `:53` (password)
- Env pattern: `src/lib/env.ts`
- Error-code mapping rule: `context/foundation/lessons.md` (exact-equality Set match)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Don't rename step titles.

### Phase 1: Registration via magic-link + invite code

#### Automated
- [x] 1.1 Typecheck passes: `pnpm typecheck`
- [x] 1.2 Lint passes (0 errors): `pnpm lint`
- [x] 1.3 Build compiles: `pnpm build`

#### Manual
- [ ] 1.4 Valid code + email → "sprawdź email" → link creates account, lands on /recipes
- [ ] 1.5 Wrong/empty code → error, no email, no account
- [ ] 1.6 Signup form has no password fields

### Phase 2: Close the login magic-link backdoor

#### Automated
- [ ] 2.1 Typecheck passes: `pnpm typecheck`
- [ ] 2.2 Lint passes (0 errors): `pnpm lint`
- [ ] 2.3 Build compiles: `pnpm build`

#### Manual
- [ ] 2.4 Existing user magic-link login (no code) works
- [ ] 2.5 Brand-new email on login → no account created, "no account" message
- [ ] 2.6 Existing password login unaffected
