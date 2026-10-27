# Phase 2 runbook — wire OpenNext's cache on Cloudflare (#445)

Revised 2026-10-27 after the deep analysis and local verification in
`2026-10-26-cache-guest-reads-phase2-plan.md` (Polish; §2 explains every step
below). The previous version of this runbook wired a Durable Object queue and
the bare D1 tag cache; both were wrong for this app (see "What changed").

Phase 1 (PR #532) shipped the code: the user-independent reads run through
`unstable_cache` (120 s TTL + tags) on a cookie-free anon client. Under OpenNext's
**default dummy caches** that is a no-op — every call still reads Supabase.
Phase 2 gives OpenNext a real incremental cache (R2) and tag cache (D1).

**Who runs what:** the owner creates the Cloudflare resources (steps 1–2); the
agent prepares the config PR (step 3) once it has the D1 `database_id`; the owner
merges it while watching the build; both verify (step 5). Deploy stays **Workers
Builds from `master`**.

Versions in repo: `@opennextjs/cloudflare` 1.20.13, `next` 16.4.3, `wrangler` 4.152.

## What changed against the first draft

- **No queue / Durable Object.** `unstable_cache` revalidates a stale entry in
  the background through Next itself (`pendingRevalidates` → `waitUntil`); OpenNext's
  queue only serves ISR pages, which this app has none of (every route reads
  cookies). Verified locally: a stale entry was served at once and refreshed in
  the background with the default (dummy) queue. So: no `NEXT_CACHE_DO_QUEUE`, no
  `migrations`, no `WORKER_SELF_REFERENCE`, no `DOQueueHandler` export in
  `custom-worker.ts`.
- **Soft-tag filter is mandatory.** `revalidatePath('/', 'layout')` (retry,
  dismiss, notification actions) writes the soft tag `_N_T_/layout`, which every
  page's entries are checked against — without the filter each such click purges
  the whole data cache for everyone. Verified locally, and fixed by
  `withFilter({ tagCache: d1NextTagCache, filterFn: softTagFilter })`.
- **The D1 table is created by hand.** `populateCache` picks its D1 step by the
  tag cache's name; the filtered wrapper is named differently, so the
  `revalidations` table is **not** created. Without it reads fail open and
  `revalidateTag` writes are lost silently (verified locally). Step 2.3.
- **Every deploy starts with an empty cache**: the build id is part of every R2,
  Cache API and D1 key. Old builds' R2 objects need a lifecycle rule (step 1.2).
- Smart Placement does not help here (`cf-placement: local-*`, #464 / #545), and
  the Worker size limit is 64 MiB uncompressed on both plans (no 3 MiB limit).
- **Prerequisite in code:** the Inngest extract job purges the caches after it
  writes a recipe (#551). Merge it before step 3.

---

## Step 0 — Before you start (owner)

- Workers Builds → Settings → **Deploy command**: expect
  `pnpm exec opennextjs-cloudflare deploy` (or `npx wrangler deploy`, which
  wrangler 4.152 hands to OpenNext). Either runs `populateCache`, which uploads the
  few build-time entries to R2 — the default Workers Builds token has *Workers R2
  Storage: Edit*, which is enough. D1 permissions are not needed by populate (the
  filtered tag cache skips it).
- The free plan is enough (plan §2.9). Durable Objects are not used.

## Step 1 — R2 bucket for the incremental cache (owner, once)

```bash
# 1.1 — separate from the BACKUPS bucket; EU, close to Supabase and the users
npx wrangler r2 bucket create zapiszprzepis-inc-cache --location weur
```

1.2 — Lifecycle rule so old builds' entries do not pile up: dashboard → R2 →
`zapiszprzepis-inc-cache` → Settings → Object lifecycle rules → prefix
`incremental-cache/`, delete objects 14 days after upload.

## Step 2 — D1 database for the tag cache (owner, once)

```bash
# 2.1 — note the database_id it prints (not a secret; it goes into wrangler.jsonc)
npx wrangler d1 create zapiszprzepis-tag-cache --location weur

# 2.2 — hand the database_id to the agent for step 3

# 2.3 — the table populateCache will NOT create (see "What changed"); idempotent
npx wrangler d1 execute zapiszprzepis-tag-cache --remote --command \
  "CREATE TABLE IF NOT EXISTS revalidations (tag TEXT NOT NULL, revalidatedAt INTEGER NOT NULL, stale INTEGER, expire INTEGER default NULL, UNIQUE(tag) ON CONFLICT REPLACE);"

# 2.4 — check: prints 0
npx wrangler d1 execute zapiszprzepis-tag-cache --remote --command "SELECT count(*) FROM revalidations"
```

The resources must exist **before** step 3 merges (BACKWARD_COMPATIBILITY §6,
CODE_REVIEW.md): wrangler refuses a binding to a missing bucket or database.

## Step 3 — Config PR (agent prepares, owner merges)

`wrangler.jsonc` — add to the existing config (keep `BACKUPS`, `IMAGES`, `ASSETS`,
`ratelimits`, `triggers`, `vars`). Binding names are fixed by OpenNext:

```jsonc
"r2_buckets": [
  { "binding": "BACKUPS", "bucket_name": "zapiszprzepis-backups" },
  { "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "zapiszprzepis-inc-cache" }
],
"d1_databases": [
  { "binding": "NEXT_TAG_CACHE_D1", "database_name": "zapiszprzepis-tag-cache", "database_id": "<from step 2.1>" }
]
```

`open-next.config.ts` (the exact config verified locally):

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache"
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache"
import { softTagFilter, withFilter } from "@opennextjs/cloudflare/overrides/tag-cache/tag-cache-filter"

export default defineCloudflareConfig({
  // A per-location Cache API copy (kept for the entry's 120 s) in front of R2.
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  // Soft tags (_N_T_…) out: revalidatePath('/', 'layout') must not wipe the data cache.
  // Side effect: populateCache no longer creates the D1 table — created by hand (runbook 2.3).
  tagCache: withFilter({ tagCache: d1NextTagCache, filterFn: softTagFilter }),
})
```

No `queue`, no `enableCacheInterception`, no `custom-worker.ts` change.

Before merging:
- validation gate (`pnpm typecheck`, `pnpm lint`, `pnpm test`);
- `pnpm cf-typegen` if the new bindings should appear in `cloudflare-env.d.ts`;
- `pnpm preview` with the table created locally
  (`npx wrangler d1 execute NEXT_TAG_CACHE_D1 --local --command "<2.3 SQL>"`):
  a repeat guest request to `/` makes no Supabase call, `revalidatePath('/', 'layout')`
  leaves the cache warm, `revalidateTag('recipes:list', { expire: 0 })` empties it.

Merge when the owner can watch the Workers Build. If it fails (e.g. populate
lacks a permission), the previous version stays live — fix and **Retry**.

## Step 4 — Deploy

Merging deploys. In the Workers Build log expect "Populating remote R2 incremental
cache … Successfully populated". There is no "Creating D1 table" line — expected.

## Step 5 — Verify on production

1. `pnpm smoke:prod` exits 0 (mandatory after any deploy or binding change, CLAUDE.md).
2. **Hits:** repeat guest requests to `/`, `/przepisy/obiady` and three recipe
   pages, from Poland and from US East: the first is a miss, the repeats are
   faster. Workers Logs: no `[recipe-cache]` errors, no "Failed to revalidate tag".
3. **Invalidation:** the owner refreshes one of their recipes („Odśwież”). The
   new content shows at once, and D1 has a fresh row:
   `npx wrangler d1 execute zapiszprzepis-tag-cache --remote --command "SELECT tag, revalidatedAt FROM revalidations ORDER BY revalidatedAt DESC LIMIT 5"`.
   Never add recipes as a QA account.
4. **TTFB before/after** (median of 10, guest, three page types, Poland + US East),
   posted on #445 and #545.
5. **48 h watch:** R2 and D1 usage in the dashboard against the free limits
   (plan §2.9); errors in Workers Logs.

## Rollback

- Fastest: Cloudflare → Workers & Pages → zapiszprzepis → Deployments → roll back
  to the previous version (no build).
- Durable: revert the step 3 PR — `open-next.config.ts` back to
  `defineCloudflareConfig({})` means the dummy caches, i.e. today's behavior.
- No data to migrate back; the bucket and the database can stay or be deleted.

## Known limits / open checks

- **Cold cache after every deploy** (build id in the keys). Accepted for now; a
  post-deploy warm-up from the sitemap is plan stage F, only if step 5.4 shows
  it matters.
- **Uncached reads remain** on the recipe page (`recipe_category_context`,
  `dish_versions`, similar recipes), `category_descriptions` and the whole
  profile page — plan stage E, for crawler load time outside the EU (#545).
- **D1 calls have no timeout**; a slow D1 slows every cached read. D1 is in
  `weur`; watch step 5.4.
- **Failure mode is fail-open:** an R2/D1 error or a free-plan daily limit never
  500s a page — it costs a cache miss or a lost invalidation (bounded by the TTL).
- `revalidateTag` inside the Inngest step (#551) is expected to have Next's
  request context (it runs inside the `/api/inngest` request); step 5.3 proves it.
  If not, the job logs `[recipe-cache] invalidation failed` and the TTL applies.
- **Extra cost:** none on the free plan at this scale; R2 and D1 usage stays well
  inside the free tiers (plan §2.9).
