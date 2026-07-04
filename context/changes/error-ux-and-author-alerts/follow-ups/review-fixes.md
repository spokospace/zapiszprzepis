# Follow-ups from impl-review (S-06)

## F4 — Switch `requireUser()` (and all auth actions) from `getUser()` to `getSession()`

- **Source**: impl-review 2026-07-04, finding F4 (Pattern Consistency).
- **Where**: `src/lib/supabase/server.ts:49` (`requireUser`), plus every action/page that calls `auth.getUser()` downstream of the proxy (`src/app/(authenticated)/recipes/*`, `src/app/page.tsx`, `src/app/share/actions.ts`, …).
- **Why**: `context/foundation/lessons.md` rule #3 — downstream of proxy auth, prefer `auth.getSession()` (cookie read, no network) over `auth.getUser()` (network round-trip). The bell adds two more `getUser()` round-trips per interaction.
- **Scope**: Repo-wide, NOT part of S-06. Deferred deliberately so this change stays focused; doing it here would touch unrelated call sites. Reserve `getUser()` for the trust boundary (proxy) and API routes outside the proxy matcher.
- **Decision**: Plan a separate cleanup change.
