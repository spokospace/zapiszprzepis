import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache"
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache"
import { softTagFilter, withFilter } from "@opennextjs/cloudflare/overrides/tag-cache/tag-cache-filter"

export default defineCloudflareConfig({
  // Phase 2 of the guest-read cache (#445, #545). R2 holds the entries, D1 the tag
  // invalidations, and a per-location Cache API copy sits in front of R2 for the entry's 120 s.
  // Bindings: NEXT_INC_CACHE_R2_BUCKET and NEXT_TAG_CACHE_D1 in wrangler.jsonc.
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  // Soft tags (_N_T_...) out: revalidatePath('/', 'layout') must not wipe the data cache for everyone.
  // Side effect: populateCache no longer creates the D1 table; it is created by hand (runbook 2.3).
  tagCache: withFilter({ tagCache: d1NextTagCache, filterFn: softTagFilter }),
})
