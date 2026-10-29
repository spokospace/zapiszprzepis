# Backward compatibility

The surfaces below are protected contracts: something outside the current diff (installed PWAs, emails already in inboxes, queued jobs, bookmarks, the production database) depends on them. Review skills check every change against this file; implementation skills warn when a change breaks one. Merging to `master` deploys to production through Cloudflare Workers Builds, so there is no staging buffer: plan the transition before merging.

There is no public API and no versioned package; the contracts are URLs, payloads, data and deploy configuration.

## 1. User-facing URLs

**Surface:** `/`, `/recipes`, `/recipes/[slug]`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/confirm`, `/auth/callback`, `/share`, plus the query params links and bookmarks carry (`/recipes?category=…&tag=…&q=…`) and the flags the UI reads (`?add_error=empty|invalid_url|server`, `?duplicate=1|pending`, `?shared=1`, `/login?error=…`).

**Admin panel (staff only, never indexed, 404 for anyone without a role):** `/admin`, `/admin/uzytkownicy`, `/admin/importy`, `/admin/dostep`, `/admin/role`, `/admin/dziennik`, `/admin/przepisy` and `/admin/przepisy/<id>`, `/admin/tokeny` and their `?ok=` / `?error=` result keys. Staff bookmark these.

**Breaking:** renaming or removing a path; changing how a recipe slug is derived for existing recipes (slugs are unique per user and stored); removing a query-param code the UI renders.

**Required path:** keep the old path working with a redirect (in middleware or a route) for at least one release; never rewrite stored slugs without a migration that keeps old slugs resolvable.

## 2. Auth email links

**Surface:** `supabase/templates/{confirmation,magic_link,recovery}.html` (local) and the same bodies in the Supabase Dashboard (production), linking to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=…`; the `redirectTo` values the auth actions build (`/auth/confirm?next=/`, `/auth/confirm?next=/reset-password`); the `/auth/confirm` and `/auth/callback` handlers.

**Breaking:** dropping `?next=` from `redirectTo` (the template's `&` would produce a broken URL); changing the param names `token_hash` / `type` / `code` / `next`; removing either handler. Links already sent remain valid for their lifetime and must still work.

**Required path:** keep `/auth/confirm` and `/auth/callback` accepting both old and new link shapes until old links have expired; update the Dashboard templates manually and say so in the PR.

## 3. PWA install and share target

**Surface:** `public/manifest.json` (`start_url`, `scope`, `share_target` → POST `/share`, multipart fields `title` / `text` / `url`); `public/sw.js` and its cache names; the `/share` POST handler.

**Breaking:** changing the share-target action, method, encoding or field names (installed PWAs keep the old manifest until they refresh); changing caching so stale HTML or POST responses are served.

**Required path:** `/share` keeps accepting the old fields; every deploy registers `/sw.js?v=<build>`, so the new worker gets fresh cache names and purges every older cache on activate — a `sw.js` change needs no manual version bump, but must keep that versioning intact.

## 4. Inngest events

**Surface:** client id `zapiszprzepis`, function `extract-recipe`, event `recipe/extract` and its payload (sent by add-recipe, retry, refresh and share actions); the `/api/inngest` endpoint.

**Breaking:** renaming the event or function id, or changing the payload shape. Events in flight or being retried (3 retries) carry the old payload.

**Required path:** the function accepts both payload shapes until in-flight runs have drained; rename by adding the new trigger alongside the old one, then removing the old one in a later PR.

## 5. Database schema and data

**Surface:** `supabase/migrations/*` (applied to production), tables `public.recipes` (unique `(user_id, slug)`) and `public.recipe_shares`, enums `recipe_source`, `recipe_category`, `recipe_share_status`, RLS policies `recipes_user_isolation` / `recipe_shares_user_isolation`, `public.current_user_id()`, the closed tag list in `src/lib/recipe-tags.ts` (stored in `recipes.tags text[]`, not an enum), the public storage bucket `recipe-images` with object paths `<user_id>/<recipe_id>/<n>.<ext>` referenced from `recipes.image_url` / `recipes.image_urls` and the `recipe_images_owner_delete` policy, and `src/lib/supabase.types.ts`.

**Breaking:** dropping or renaming a column, table, enum value or tag value that existing rows hold; tightening a constraint existing rows violate; weakening or dropping an RLS policy; moving or deleting stored image objects that recipes reference.

**Required path:** a new forward migration (never edit an applied one) that migrates existing rows in the same migration — the `wegetarianskie` → `salatki` rename (`20260705000000_rename_category_salatki.sql`) and the move into `ciasteczka` (`20261015200100_move_cookies_to_ciasteczka.sql`) are the precedent; regenerate `supabase.types.ts` in the same PR; describe the rollback in the PR body; label `risk-high`. Local development runs against the production database, so applying a migration locally is applying it to production.

**Admin panel additions (Phase 1):** the private tables `staff_roles`, `staff_role_permissions`, `user_roles` and `staff_audit_log`, the composite types `admin_*_row`, the functions `staff_can`, `has_permission`, `my_permissions`, `staff_audit` and every `admin_*` / `admin_*_as` function (names, argument names, error codes such as `forbidden` and `last_admin`), the permission strings (`users.read`, `imports.retry`, …), the policy `recipe_shares_staff_select`, and the `'staff'` value of `user_full_access.source`. Roles never go on `profiles` (anon-readable, owner-updatable). The `_as` functions are `service_role` only and the wrappers `authenticated` only; widening a grant is a breaking change reviewed as a privilege escalation.

**Admin panel additions (Phase 4):** the private table `staff_tokens` (`token_hash` is the SHA-256 hex of the raw `zpm_` + 64 hex token, which is shown once), the type `admin_token_row`, and the functions `admin_create_token[_as]`, `admin_list_tokens[_as]`, `admin_revoke_token[_as]` and `staff_resolve_token` (service_role only; it returns `token_id`, `actor_id`, `permissions`, and no row for a revoked, expired, blocked or role-less account). The error code `too_many_tokens`. A token never carries a role: permissions are read at every call.

## 6. Worker configuration, cron and bindings

**Surface:** `wrangler.jsonc` (`main: ./custom-worker.ts`, vars, `compatibility_date`, flags `nodejs_compat` and `global_fetch_strictly_public`), cron triggers `30 3 * * *` (backup to R2) and `0 4 * * *` (keep the database awake) matched as exact strings in `custom-worker.ts`, bindings `BACKUPS` (R2 bucket `zapiszprzepis-backups`) and `ASSETS`, the `ratelimits` bindings (`EXA_SEARCH_LIMIT`, `EXTRACTION_LIMIT`, `MCP_LIMIT`, namespace ids `1001`–`1003`), and `src/middleware.ts` (its `/api/mcp` pass-through, see §9).

**Breaking:** a cron string changed in only one of the two places; a removed or renamed binding; a new binding whose resource does not exist yet; renaming `src/middleware.ts` to `proxy.ts` (pushes the bundle past the 3 MiB free-tier limit, and the deploy fails).

**Required path:** change cron strings in both files in the same commit; create Cloudflare resources before merging; confirm the Workers Build for the merge commit succeeded.

## 7. Environment variables and secrets

**Surface:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (wrangler vars); `SUPABASE_SERVICE_ROLE_KEY`, `INVITE_CODE`, `EXA_API_KEY`, `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` (secrets); `INNGEST_EVENT_KEY_2` (optional secret — the secondary Inngest account's event key; without it there is no failover, see `src/inngest/send.ts`); `JINA_API_KEY` (optional secret — the Jina Reader fallback works without it, but rate-limited to 429 from Workers).

**Breaking:** renaming or adding a required variable without setting it in the Worker; production then fails at runtime, not at build.

**Required path:** set the new secret in Cloudflare before merge, keep reading the old name as a fallback for one release when renaming, and update `.env.local.example`.

## 8. Stored user-visible messages

**Surface:** `recipe_shares.error_message`, displayed verbatim in the notification bell.

**Breaking:** none for old rows, since they keep their text. A new message must be Polish and readable on its own; don't make the UI depend on parsing message text.

**Admin panel additions (Phase 2 — recipe moderation):** `recipes.hidden_at` / `hidden_by` / `hidden_reason` (staff-only; `public_recipes` must never expose them and both public views keep `where hidden_at is null`, enforced by `assert_public_view_boundary()`), `dish_versions` filtering hidden recipes, the archive table `recipes_deleted_by_staff` (service-only), the policy `recipes_staff_select`, `recipe_hidden_for_viewer(text)`, and the functions `admin_{list,get}_recipe(s)`, `admin_{hide,unhide,delete,restore}_recipe`, `admin_list_deleted_recipes`, `admin_merge_recipes`, `admin_unmerge`, `admin_list_merges`, `admin_set_taxonomy` (+ `_as`), with the error codes `invalid_redirect`, `canonical_hidden`, `slug_taken`, `restore_conflict`. A URL of a recipe staff deleted with a redirect answers 301 to the target; a hidden recipe's URL answers 404 to guests and a 200 "niedostępny" page (noindex) to its owner and favoriters.

## 9. Staff MCP endpoint

**Surface:** `POST /api/mcp` (MCP Streamable HTTP, JSON-RPC 2.0 subset: `initialize`, `ping`, `notifications/*`, `tools/list`, `tools/call`; one message per request, JSON responses, no sessions; `GET` and `DELETE` answer 405), authenticated by `Authorization: Bearer zpm_…`. Clients (Claude Code, `claude mcp add --transport http …`) are configured against it. Status codes: 401 for any bad token (unknown, revoked, expired, blocked account, no role; one identical body), 413 over 16 KiB, 429 over the per-address or per-token cap, 503 when the token cannot be checked. Tool failures are ordinary results with `isError: true`, in English. Also the `ratelimits` binding `MCP_LIMIT` and the `/api/mcp` entry in the `src/middleware.ts` allow-list.

**Tool names and argument names** (generated from `src/lib/staff/registry.ts`; a tool is `<resource>_list`, `<resource>_get` or `<resource>_<operation>`; every change also takes `dry_run`, destructive ones `confirm: "<operation>"`):

| Tool | Arguments (* = required) |
|------|--------------------------|
| `users_list` | `query`, `limit`, `after_created`, `after_id` |
| `users_get` | `user_id`* |
| `users_block` (destructive) | `user_id`*, `reason` |
| `users_unblock` | `user_id`* |
| `users_delete` (destructive) | `user_id`* |
| `imports_list` | `status` (`problem`, `failed`, `pending`, `completed`, `all`), `limit`, `before_id` |
| `imports_retry` | `share_id`* |
| `access_list` | `limit` |
| `access_create_code` | `note`, `max_uses`, `expires_at` |
| `access_set_full_access` (destructive) | `user_id`*, `on`* |
| `roles_list` | none |
| `roles_set_role` (destructive) | `user_id`*, `role`*, `on`* |
| `audit_list` | `resource`, `actor_id`, `from`, `to`, `limit`, `before_id` |

Recipe moderation (`/admin/przepisy`) is panel-only for now: its registry entry has no `mcp` blocks, so no `recipes_*` tool exists yet. They join this table when those blocks are added (the `admin_*_as` functions they would call already exist).

**Breaking:** renaming or removing a tool or an argument, making an optional argument required, changing what a destructive tool's `confirm` must equal, changing the 401/429 semantics, accepting a token without re-reading the owner's roles and ban state, or shipping the code that declares `MCP_LIMIT` before the namespace exists in Cloudflare (wrangler refuses a binding to a missing resource, as in §6).

**Required path:** add new tools and optional arguments only; keep the old tool as an alias for one release when renaming; create the rate-limit namespace in Cloudflare before merging.
