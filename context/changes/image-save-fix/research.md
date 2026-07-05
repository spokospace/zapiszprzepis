---
date: 2026-07-05T00:00:00+02:00
researcher: Claude (Sonnet 4.6)
git_commit: f9c50a3e8500b1d2ad75641408db908dcd8b9979
branch: master
repository: spokospace/zapiszprzepis
topic: "image-save-fix — image saving flow in recipe extraction"
tags: [research, codebase, images, supabase-storage, inngest, recipe-extraction]
status: complete
last_updated: 2026-07-05
last_updated_by: Claude (Sonnet 4.6)
last_updated_note: "Added follow-up: root cause confirmed via live browser check on polskiekulinaria.pl"
---

# Research: Image Save Flow (image-save-fix)

**Date**: 2026-07-05  
**Researcher**: Claude (Sonnet 4.6)  
**Git Commit**: `f9c50a3e8500b1d2ad75641408db908dcd8b9979`  
**Branch**: master  
**Repository**: spokospace/zapiszprzepis

## Research Question

Understand the complete image-saving flow in the recipe extraction pipeline so a targeted fix can be planned.

## Summary

Images are saved in two steps during recipe extraction (Inngest `extractRecipe` function):
1. The raw `og:image` URL is written to `recipes.image_url` at insert time as a fallback.
2. `archiveImage()` fetches the URL, validates MIME/size, uploads to Supabase Storage bucket `recipe-images`, then overwrites `image_url` with the CDN URL.

All three Inngest code paths (new insert, force-refresh, URL-collision gap-fill) call `archiveImage` independently. Failure is silent — on any error the external URL (or null) is kept. There is no UI for image upload; every image flows through og:image scraping.

## Detailed Findings

### A. Database

- **`supabase/migrations/20260607000000_recipe_schema.sql:39`** — `image_url text` (nullable) on `recipes`. Stores either an external `og:image` URL or a Supabase Storage CDN URL (`/storage/v1/object/public/recipe-images/…`).
- **`src/lib/supabase.types.ts:97,112,132`** — TypeScript type: `image_url: string | null`.

### B. Storage Bucket

- **`supabase/migrations/20260611160000_image_archive_storage.sql`** — bucket `recipe-images`, public, 5 MB, MIME: `image/jpeg | image/png | image/webp`, path scheme `<user_id>/<recipe_id>.<ext>`.
- Writes use the **service role** (bypasses RLS); reads are public.

### C. `archiveImage()` — core helper

**`src/lib/recipe-image-archive.ts:12-60`**

```
archiveImage(supabase, userId, recipeId, externalUrl) → Promise<string | null>
```

Flow:
1. `fetch(externalUrl, { signal: AbortSignal.timeout(15_000) })` → 404/non-2xx → `null`
2. `content-type` header → split on `;` → check against `ALLOWED_MIME` → unsupported → `null`
3. `content-length` header (optional) → > 5 MB → `null`
4. `response.arrayBuffer()` → byte-level size check → > 5 MB → `null`
5. `supabase.storage.from('recipe-images').upload(path, bytes, { upsert: true })`
6. `supabase.storage.from('recipe-images').getPublicUrl(path)` → returns CDN URL

Any exception → `console.warn` → returns `null`. **No error is surfaced to callers.**

`extractStoragePath(imageUrl)` — regex `/\/storage\/v1\/object\/public\/recipe-images\/(.+)$/` used by delete route to clean up Storage.

### D. Inngest — three code paths

**`src/inngest/functions.ts`**

#### D1. `ogImage` acquisition (lines 75–118)

| Source | Code |
|---|---|
| Blogspot | `bloggerPost.image ?? undefined` (line 93) |
| Web/YouTube via Firecrawl | `scraped.metadata?.ogImage` (line 116) |

`ogImage` type: `string | undefined`. The `!= null` guard on every call site means `undefined` is treated the same as `null`.

#### D2. New insert path (lines 246–282)

1. Insert with `image_url: ogImage ?? null` (external URL as initial value).
2. If `ogImage != null`: call `archiveImage`; if it returns a CDN URL, overwrite `image_url`.
3. If archive fails: external URL remains (inserted in step 1). **No second update call.**

#### D3. Force-refresh path (lines 198–233)

1. Update recipe fields (does **not** touch `image_url` in the `update` call).
2. If `ogImage != null`: call `archiveImage`; write `image_url: archivedUrl ?? ogImage`.
3. **Always writes to `image_url`** — even if archive fails, the external URL is written.
4. Note: if `ogImage` is null/undefined, `image_url` is **not touched** — the existing value is preserved.

#### D4. URL-collision / gap-fill path (lines 289–332)

1. Fetches existing recipe row.
2. Archives image and adds to `gapFill` only if archive succeeds (`archivedUrl != null`).
3. If archive fails and `existing.image_url == null`, stores external URL as fallback.
4. If archive fails and `existing.image_url != null`, **does nothing** (existing value preserved).

### E. Recipe delete — Storage cleanup

**`src/app/api/recipes/delete/route.ts:39–48`**

Uses `extractStoragePath(recipe.image_url)` to check if the URL is a Storage URL, then calls `supabase.storage.from('recipe-images').remove([storagePath])`. Storage errors are `console.warn`'d but don't abort the DB delete.

### F. Image display

- **`src/app/components/recipe-card.tsx:17–24`** — `<Image src={imageUrl} fill />` or orange-gradient placeholder when null.
- **`src/app/(authenticated)/recipes/[slug]/page.tsx:103–113`** — full-width `<Image fill priority />` when `image_url` is not null.
- **`next.config.ts:9`** — `remotePatterns: [{ protocol: 'https', hostname: '**' }]` — any HTTPS image allowed.

### G. Backfill script

**`scripts/archive-recipe-images.ts`** — queries recipes without a Storage URL in `image_url` and fires `recipe/extract` Inngest events to re-run extraction and trigger archiving via the gap-fill path.

## Code References

- `src/lib/recipe-image-archive.ts:12` — `archiveImage()` definition
- `src/lib/recipe-image-archive.ts:62` — `extractStoragePath()` definition
- `src/inngest/functions.ts:75` — `ogImage` variable declaration
- `src/inngest/functions.ts:93` — Blogger og:image assignment
- `src/inngest/functions.ts:116` — Firecrawl og:image assignment
- `src/inngest/functions.ts:246-282` — new insert + archive flow
- `src/inngest/functions.ts:198-233` — force-refresh + archive flow
- `src/inngest/functions.ts:289-332` — URL-collision gap-fill + archive flow
- `src/app/api/recipes/delete/route.ts:39-48` — Storage cleanup on delete
- `supabase/migrations/20260611160000_image_archive_storage.sql` — bucket definition

## Architecture Insights

1. **Single `image_url` column** — stores both external URLs and Supabase Storage URLs in the same field. Distinguishing them relies on the `/storage/v1/object/public/recipe-images/` URL prefix.

2. **Best-effort, silent archiving** — `archiveImage` returns `null` on every failure type (HTTP error, wrong MIME, too large, upload error). Callers never see exceptions from image archiving. This means image-related bugs can go unnoticed — the recipe saves but `image_url` stays as an external URL or null.

3. **`upsert: true`** on Storage upload — idempotent re-runs. Re-archiving a recipe overwrites the existing Storage file at the same path.

4. **Three independent call sites** for `archiveImage` — the three Inngest code paths each call it separately with no shared state. A bug in one path doesn't affect others.

5. **`ogImage` from Firecrawl** — `scraped.metadata?.ogImage` (line 116) is typed as `any` from the Firecrawl API response. If Firecrawl returns an array (some OG specs allow multiple `og:image` tags), this would pass an array to `fetch()` inside `archiveImage`, which would fail with a fetch error and return null silently.

6. **Force-refresh does not preserve existing archived image** — when refreshing, if the new `ogImage` comes back null (e.g. source page removed the og:image tag), the existing `image_url` is kept (code path skips the update entirely when `ogImage == null`). This is correct behavior per the current code.

## Potential Bug Areas to Investigate

These are candidate areas where an image-save bug could exist, ordered by likelihood:

| # | Area | Risk | Location |
|---|---|---|---|
| 1 | `ogImage` from Firecrawl is an array | `fetch(array)` silently fails → null | `functions.ts:116` |
| 2 | Two manual checks never completed | Untested: delete cleanup, >5MB fallback | `image-archive-storage` plan.md items 1.7 & 1.8 |
| 3 | Force-refresh clears archived URL with external | If source still has og:image, re-archives but upserts same file; if source removed og:image, keeps old value — probably OK | `functions.ts:222-225` |
| 4 | `content-type` with extra params | `image/avif` or `image/gif` silently rejected (not in ALLOWED_MIME) | `recipe-image-archive.ts:26-29` |
| 5 | `extractStoragePath` regex mismatch | URL with query params (`?t=xxx` cache-busting) would fail to match | `recipe-image-archive.ts:63` |

## Historical Context

- `context/changes/image-archive-storage/` — the full prior implementation. Both phases done (commits `2fdd663`, `fd5d876`). Two manual verification steps (1.7 delete cleanup, 1.8 >5MB fallback) were never checked off.
- `context/changes/web-blog-recipe-source/plan.md:52` — pre-archive era: `ogImage ?? null` stored directly.
- `context/foundation/infrastructure.md:62` — no persistent disk; storage must be Supabase Storage.

## Related Research

- `context/changes/image-archive-storage/plan.md` — full implementation plan including archive helper contract

## Follow-up Research — Root Cause (2026-07-05)

Live browser check on `https://polskiekulinaria.pl/tiramisu-przepis-na-klasyczny-wloski-deser/` confirmed:

- `document.querySelector('meta[property="og:image"]')` → **null** (tag does not exist)
- `document.querySelector('meta[name="twitter:image"]')` → **null**
- First article `<img>` src → `https://polskiekulinaria.pl/wp-content/uploads/2026/05/tiramisu-przepis-na-klasyczny-wloski-deser.jpg` ✓

**Root cause**: Firecrawl returns `metadata.ogImage = null` for WordPress blogs that don't set `<meta property="og:image">`. Because `ogImage == null`, `archiveImage` is never called and `image_url` stays null.

**Fix**: Add a fallback in `src/inngest/functions.ts` after `ogImage = scraped.metadata?.ogImage` (line 116): when `ogImage` is null/undefined, extract the first `<img src>` from the scraped `html` — identical to the pattern already used in `src/lib/blogger-feed.ts:56-58`:

```ts
// blogger-feed.ts:56-58 (existing pattern to reuse)
const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i)
image: imgMatch ? imgMatch[1] : null
```

Apply the same regex to `scraped.html` as a fallback when `scraped.metadata?.ogImage` is absent. This covers WordPress blogs, recipe aggregators, and any other site that has a content image but no OG meta tag.

**Scope of change**: 2–3 lines in `src/inngest/functions.ts` (non-Blogspot path, after Firecrawl scrape). Existing `archiveImage` + Storage flow is unchanged — fallback URL goes through the same pipeline.

**Affected sites**: Any `web_blog` source that omits `og:image`. Blogspot is already handled separately via the Blogger feed (`functions.ts:82-97`). YouTube has no image issue (thumbnail via `youtube_id`). Only the Firecrawl web-blog path needs this fix.

## Open Questions

1. **Is the Firecrawl `ogImage` response always a string?** If Firecrawl returns `string[]`, the current code passes an array to `fetch()` and silently gets null on every call. Low risk now that root cause is identified differently, but worth a type-guard.
2. **Should the first-image fallback filter out small icons?** The regex picks the first `<img>` in the full HTML. Could match a logo or icon before the recipe photo. May want to skip Gravatar-style URLs or add `width`/`height` attribute heuristics.
