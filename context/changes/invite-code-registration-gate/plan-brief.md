# Invite-code registration gate — Plan brief

> Full plan: `context/changes/invite-code-registration-gate/plan.md`

## What & why

Close open registration on `zapiszprzepis.pl`: creating a new account must require a valid invite code. Registration becomes passwordless magic-link + code (aligned with the PRD's passwordless vision). User-requested (roadmap S-07).

## Starting point

Two paths create accounts today: password `signUp` on `/signup`, and — critically — the magic-link tab on `/login`, which uses `signInWithOtp` with Supabase's default `shouldCreateUser: true` and so silently provisions any brand-new email. A signup-only gate would be bypassable via `/login`.

## Desired end state

`/signup` = email + invite code → valid code sends a magic link that creates the account on click; wrong code is rejected. `/login` magic-link uses `shouldCreateUser: false` — existing users (mama) still get links, new emails create nothing. Password login is untouched.

## Key decisions

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Code mechanism | Single `INVITE_CODE` env | Simplest for 1–2 users; no DB/migration | Plan |
| Registration shape | Passwordless magic-link + code | Matches PRD passwordless; user's steer | Plan |
| Login backdoor | `shouldCreateUser: false` | Otherwise the gate is bypassable via /login | Plan |
| Password login | Unchanged | Existing password users keep working | Plan |
| Env accessor | Lazy `getInviteCode()` | Avoid build-time throw on a secret; matches lib/env.ts | Plan |
| Error mapping | Exact-equality Set of codes | lessons.md rule (no String.includes) | Plan |

## Scope

**In:** invite-code env accessor; code-gated magic-link signup (drop password fields); signup "check email" state; `shouldCreateUser: false` on login + "no account" message.

**Out:** revocable/one-time/per-invitee codes; removing the password login tab; constant-time compare; Supabase-level signup disable (optional note); email-enumeration hardening.

## Architecture / approach

Gate both account-creation points. Signup action validates email + `INVITE_CODE` then `signInWithOtp({ shouldCreateUser: true })`; login action sets `shouldCreateUser: false`. Reuses the `?error=<code>` + `ERROR_MESSAGES` UX and the `lib/env.ts` lazy-getter pattern. No DB changes.

## Phases at a glance

| Phase | Delivers | Key risk |
| --- | --- | --- |
| 1. Registration via magic-link + code | `/signup` = email + code → gated magic link | Reworking signup form/action; email-send edge cases |
| 2. Close login backdoor | `/login` magic-link stops creating users | Mapping the Supabase "no such user" error correctly |

**Prerequisites:** F-01 auth (magic-link, `getSiteUrl`, callback) — present on master. `INVITE_CODE` set locally + as a Cloudflare secret.
**Estimated effort:** ~1 session, 2 small phases, ~5 files, no migration.

## Open risks & assumptions

- Exact Supabase error code/shape for `shouldCreateUser: false` + non-existent user must be confirmed at implementation (map via a Set; fall back to a generic message on the default branch).
- `INVITE_CODE` must be present in every runtime that serves `/signup` (local `.env.local` + Cloudflare secret), else registration is unusable.

## Success criteria (summary)

- New account creation is impossible without a valid invite code, via either signup or the login magic-link tab.
- Existing users (mama) log in unchanged (magic-link without a code, or password).
