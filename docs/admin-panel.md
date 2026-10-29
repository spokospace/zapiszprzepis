# Admin panel — owner runbook (Phase 1)

`/admin` is the staff panel: users, the import queue, access codes, roles and the audit log. Spec:
`.ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md`. Recipe moderation (Phase 2), editing (Phase 3) and
the MCP server (Phase 4) come later.

## Who can do what

| Role | Sees | Can do |
|------|------|--------|
| `admin` | everything below | everything, including roles, access codes, deleting accounts, e-mail addresses and the audit log |
| `moderator` | users (no e-mail), import queue | retry an import; read-only on users |

Roles and their permissions are data (`staff_roles`, `staff_role_permissions`), not code. A new role is two
inserts; the panel shows only the screens a role has a permission for, and the database refuses the rest either way.
A user without any role gets a 404 on every `/admin` path, as if the panel did not exist.

## Deploying Phase 1 (order matters)

The migrations are files only. None has been applied to any database. Local development points at the
**production** database, so applying one locally is applying it to production.

1. Apply the migrations in order, one at a time, from the Supabase SQL editor:
   `20261028100000_staff_roles_permissions`, `…110000_staff_audit_log`, `…120000_admin_users`,
   `…130000_admin_imports`, `…140000_admin_access`, `…150000_admin_roles`. Each ends with an assertion call that
   fails the migration if a grant is wrong.
2. Make the first admin (there is no way to do this from the app, on purpose):

   ```sql
   insert into public.user_roles (user_id, role, granted_by)
   values ('<your auth.users id>', 'admin', '<the same id>');
   ```

3. Deploy the app (merge to `master`; Cloudflare builds it). Deployed before step 1, the app is harmless: it
   cannot read `my_permissions()`, fails closed and answers 404 on every `/admin` path.
4. Open `/admin/role` and add the other people from their account page (`/admin/uzytkownicy/<id>`).

Optional, on a scratch database or a Supabase branch only, never production:
`psql "$SCRATCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/admin_staff_guards.sql` checks the guards
(own role, last admin, moderator limits, no e-mail or code in the audit log). It rolls back and has not been run yet.

After the migrations are applied, regenerate `src/lib/supabase.types.ts` (the panel calls the new functions untyped
until then).

## Things to know

- **Blocking an account** sets `banned_until` and deletes the account's sessions, so it cannot refresh its
  token. An access token already issued works until it expires (default one hour). Verify once against your
  Supabase project: block a test account, then check that it cannot sign in and that a refresh fails.
- **Deleting an account** runs the existing hand-over (recipes others favorited go to the oldest favoriter).
  Storage objects are **not** deleted by the panel; follow `docs/account-deletion.md` for the avatar and
  recipe-image folders.
- **Nobody blocks or deletes themselves or another staff member.** Take the role away first (admin only).
- **Access codes** are generated in the database, shown once on the screen and stored only as a hash. Copy the
  code at once; the list never shows it again.
- **Audit log** (admins): every panel action writes a row in the same transaction as the change, with the actor,
  the target id and ids/flags before and after. No e-mail, name, code or token is ever written to it.

## Worker size

The Worker upload must stay under 3 MiB gzipped (free plan). `pnpm measure:worker` reads the figure after
`pnpm exec opennextjs-cloudflare build`; the OpenNext build needs Linux or WSL (Windows fails creating symlinks).
Baseline before the panel: 2320 KiB gzipped (see the script header for the figure after each phase).

## MCP: run the panel's operations from Claude Code (Phase 4)

`POST https://zapiszprzepis.pl/api/mcp` exposes the same operations as the panel as MCP tools, under **your own account
and role**. A moderator's token lists and runs only moderator tools; an admin's lists everything the panel offers. The
tools are generated from `src/lib/staff/registry.ts`, so a resource added there (recipes in Phases 2 and 3) appears
without MCP code. The tool and argument names are a contract: see `BACKWARD_COMPATIBILITY.md` §9.

### Connect

1. In the panel open **Moje tokeny** (`/admin/tokeny`), name the token ("laptop") and pick how long it lives (default 90
   days). The token is shown **once**. Only its SHA-256 is stored; there is no way to read it again.
2. Run the command the screen prints (it has your token filled in):

   ```bash
   claude mcp add --transport http zapiszprzepis https://zapiszprzepis.pl/api/mcp --header "Authorization: Bearer <token>"
   ```

   The token is a password: keep it out of git, chat and screenshots. `claude mcp add` stores it in your Claude Code
   config; use `--scope user` so it does not land in a project's `.mcp.json`.
3. A lost or leaked token: **Unieważnij** it on the same screen (works at once) and make a new one. At most 10 tokens
   can be active per account.

### What a token can and cannot do

- It carries no role. Every call reads your roles and ban state from the database, so removing your role or blocking
  your account disables all your tokens immediately, with no cache to wait out. Deleting the account deletes the tokens.
- A token cannot create or revoke tokens; only a signed-in panel session can.
- **Destructive tools** (`users_block`, `users_delete`, `access_set_full_access`, `roles_set_role`) refuse to run unless
  called with `confirm: "<operation>"` (`"block"`, `"delete"`, `"set_full_access"`, `"set_role"`). Every change also
  takes `dry_run: true`: it checks the arguments and your permission, shows the record as it is now and writes
  nothing. Database rules such as "last admin" are checked only on a real run.
- Errors come back as ordinary tool results (`isError`), in English.
- **Audit:** every call is recorded with `via = 'mcp'` and the token id. Changes are written inside the same
  transaction as the change; reads, previews and refused calls (a moderator forcing an admin tool) are recorded by the
  endpoint with `after.outcome` = `read`, `dry_run` or `denied`. A read that cannot be recorded is not served.
  Calls rejected for bad arguments or a missing `confirm` run nothing and are not recorded.
- `access_create_code` returns the new code in the tool result, which lands in the Claude Code transcript. Treat that
  transcript like the code itself.

### Limits

16 KiB per request, one JSON-RPC message per request, results cut at 60,000 characters, 60 calls a minute per token
and per client address (the `MCP_LIMIT` Workers rate-limit binding, which **must exist in Cloudflare before the code
that declares it is deployed**, like `EXA_SEARCH_LIMIT`). The limiter fails open if the binding is missing, so check
that it is there.

### Deploying Phase 4

1. Create the `MCP_LIMIT` rate-limit namespace (id `1003`, 60 per 60 s) in Cloudflare.
2. Apply `supabase/migrations/20261030100000_staff_tokens.sql` from the SQL editor (it needs the Phase 1 migrations).
   It ends with an assertion call that fails the migration if a grant is wrong.
3. Merge to `master`. Deployed before step 2 the endpoint answers 503 (it cannot check tokens) and the tokens page
   shows an error; nothing else changes.

Optional, on a scratch database only, never production: `supabase/tests/staff_tokens_guards.sql` (rolls back; run it
with `psql -v ON_ERROR_STOP=1 -f`). It was also run in pglite with `auth` stubbed.

After applying, regenerate `src/lib/supabase.types.ts`; the token screen calls its functions untyped until then.
