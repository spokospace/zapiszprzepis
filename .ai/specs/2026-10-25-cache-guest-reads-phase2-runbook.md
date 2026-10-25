# Phase 2 runbook — wire OpenNext's cache on Cloudflare (#445)

Phase 1 (PR #532) shipped the code: the user-independent reads run through
`unstable_cache` (120 s TTL + tags) on a cookie-free anon client. Under OpenNext's
**default dummy cache** that is a no-op — every call still reads Supabase. Phase 2
gives OpenNext a real incremental cache + tag cache + queue so the reads actually
hit cache and `revalidateTag` works.

**Who runs this:** the owner. Every step needs the Cloudflare account (dashboard or
`wrangler` logged into the zapiszprzepis account); the agent cannot reach it. Deploy
stays **Workers Builds from `master`** (local `wrangler deploy` can't reach the
Worker's account — see CLAUDE.md / memory).

Versions in repo: `@opennextjs/cloudflare` 1.20.13, `wrangler` 4.152. The Worker entry
is the **custom** `custom-worker.ts` (not the default OpenNext worker) — that matters
for step 4.

---

## Step 1 — Create the Cloudflare resources (once)

```bash
# R2 bucket for the incremental cache (separate from the existing BACKUPS bucket)
npx wrangler r2 bucket create zapiszprzepis-inc-cache

# D1 database for the tag cache — note the returned database_id
npx wrangler d1 create zapiszprzepis-tag-cache
```

The queue is a Durable Object defined by code + a migration (step 2/4) — nothing to
create here.

## Step 2 — wrangler.jsonc bindings

Add to the existing `wrangler.jsonc` (keep `BACKUPS`, `IMAGES`, `ASSETS`,
`ratelimits`, `triggers`, `vars`, …). The binding names are fixed by OpenNext —
do not rename them:

```jsonc
"r2_buckets": [
  { "binding": "BACKUPS", "bucket_name": "zapiszprzepis-backups" },
  { "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "zapiszprzepis-inc-cache" }
],
"d1_databases": [
  {
    "binding": "NEXT_TAG_CACHE_D1",
    "database_name": "zapiszprzepis-tag-cache",
    "database_id": "<id from step 1>"
  }
],
"durable_objects": {
  "bindings": [
    { "name": "NEXT_CACHE_DO_QUEUE", "class_name": "DOQueueHandler" }
  ]
},
"migrations": [
  { "tag": "v1", "new_sqlite_classes": ["DOQueueHandler"] }
],
"services": [
  { "binding": "WORKER_SELF_REFERENCE", "service": "zapiszprzepis" }
]
```

- `NEXT_INC_CACHE_R2_BUCKET` — incremental cache store. (Optional
  `NEXT_INC_CACHE_R2_PREFIX`, default `incremental-cache`.)
- `NEXT_TAG_CACHE_D1` — the tag cache.
- `NEXT_CACHE_DO_QUEUE` + the `v1` migration — the revalidation queue (required for
  time-based revalidation).
- `WORKER_SELF_REFERENCE` → the Worker name `zapiszprzepis`: OpenNext's revalidation
  guideline; harmless to include.

## Step 3 — open-next.config.ts

Replace `defineCloudflareConfig({})` with:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache"
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue"
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache"

export default defineCloudflareConfig({
  // withRegionalCache puts the per-colo Cache API in front of R2 so a repeat hit in
  // the same region skips the R2 round trip. Optional — drop it for plain r2IncrementalCache.
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  tagCache: d1NextTagCache,
  queue: doQueue,
})
```

Leave `enableCacheInterception` off: it intercepts whole routes before the Next
server and does not work with PPR; our caching is data-level (`unstable_cache`), which
needs the plain config above.

## Step 4 — custom-worker.ts: export the queue Durable Object

Because `custom-worker.ts` is the Worker `main`, the DO class the binding points at
must be exported from it (the default OpenNext worker does this for you; a custom one
does not). Add beside `export default worker`:

```ts
export { DOQueueHandler } from "@opennextjs/cloudflare/durable-objects/queue"
export default worker
```

Without this, the `NEXT_CACHE_DO_QUEUE` binding has no class and the deploy fails.

## Step 5 — Create + seed the D1 tag table on production

`opennextjs-cloudflare populateCache` creates the tag table
(`CREATE TABLE IF NOT EXISTS revalidations (tag TEXT PRIMARY KEY, revalidatedAt
INTEGER, stale INTEGER, expire INTEGER DEFAULT NULL)`) and seeds any build-time
revalidation tags. It must run against the **production** D1 on every deploy.

Because deploy is Workers Builds, make the Workers Builds **deploy command** run the
full OpenNext deploy (which includes populate):

```
npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy
```

(the repo's `pnpm deploy` script already is this). If Workers Builds only runs
`opennextjs-cloudflare build`, run the populate once with account credentials:

```bash
npx opennextjs-cloudflare populateCache remote
```

It is idempotent (`CREATE TABLE IF NOT EXISTS`), so re-running is safe. Our tags are
created at **runtime**, so the seed is near-empty — the point is that the table
exists before the first `revalidateTag`.

## Step 6 — Local build sanity (before merging the config)

```bash
pnpm preview   # opennextjs-cloudflare build && opennextjs-cloudflare preview
```

Must succeed with no binding errors, and the Worker bundle must stay under the
**3 MiB** limit (memory: a past rename blew it). Run `pnpm cf-typegen` if the new
bindings need to appear in `cloudflare-env.d.ts`.

## Step 7 — Deploy and verify

1. Land PR #532 (Phase 1 code) and this config change on `master`; let Workers Builds
   build `master`.
2. **TTFB before/after** (same method as epic #225 / #464): for a guest category page,
   a recipe page, and the home — measure a cold request (cache miss) then a repeat
   within 120 s. The repeat should be a cache hit with **no Supabase round trip**
   (watch Workers Logs / Supabase). Compare against the pre-cache baseline.
3. `pnpm smoke:prod` — must exit 0 (every `/_next/static` asset the prod HTML
   references returns 200). **Mandatory after any deploy or binding/secret change**
   (CLAUDE.md).
4. **Invalidation check:** delete a recipe → its page and the lists drop near-immediately
   (`revalidateTag(..., { expire: 0 })`); add a recipe (async via the Inngest worker) →
   it appears within the 120 s TTL.

## Rollback

Revert `open-next.config.ts` to `defineCloudflareConfig({})` and drop the new bindings
→ the code falls back to the dummy cache, i.e. exactly Phase 1 / today's behavior. No
data migration to undo; the R2 bucket and D1 database can be kept or deleted.

## Gotchas / open checks

- **revalidateTag ↔ unstable_cache tags (confirm empirically).** Next 16's
  `revalidateTag` docs describe `fetch` `next.tags` and `'use cache'` `cacheTag`, not
  `unstable_cache`'s `tags` option. If a delete does not invalidate immediately on the
  D1 tag cache, the 120 s TTL still bounds staleness (owner-accepted). This is the one
  thing worth verifying in step 7.4; if it does not hold, consider migrating the cached
  reads from `unstable_cache` to the `'use cache'` + `cacheTag` directive (requires
  `cacheComponents`).
- **Smart Placement** (`placement: "smart"`) is already on — it helps the cold
  (miss) request's Supabase round trips, which is complementary to this cache.
- **No user data in the cache.** The R2/D1 entries hold only `public_recipes` rows;
  per-user reads (hearts, owner, menu, gallery) stay dynamic, so the shared store
  carries no cross-user risk.
- **Extra cost:** R2 (storage + class-A/B ops), D1 (rows), and the queue DO add to the
  Cloudflare bill — small at this scale, but not zero.
