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
