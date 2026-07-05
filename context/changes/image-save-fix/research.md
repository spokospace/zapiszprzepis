---
date: 2026-07-05T00:00:00+02:00
researcher: Claude Sonnet 4.6
git_commit: b54454e327db6b6c9d8d4c64c2d6105df6b65a15
branch: uix-changes
repository: spokospace/zapiszprzepis
topic: "Why does polskiekulinaria.pl produce image_url = null?"
tags: [research, image-pipeline, firecrawl, inngest, recipe-extraction]
status: complete
last_updated: 2026-07-05
last_updated_by: Claude Sonnet 4.6
---

# Research: Why does polskiekulinaria.pl produce image_url = null?

**Date**: 2026-07-05  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: b54454e  
**Branch**: uix-changes  
**Repository**: spokospace/zapiszprzepis

## Research Question

Tiramisu recipe from polskiekulinaria.pl was saved with `image_url = null`. Why does this happen and what needs to change?

## Summary

The image pipeline has **a single point of failure with no fallback**: image comes exclusively from `scraped.metadata?.ogImage` returned by Firecrawl. If Firecrawl doesn't populate that field for a given site, `image_url` stays `null` forever — no fallback to `<img>` tags, schema.org, or LLM extraction. polskiekulinaria.pl has no domain-specific handling and almost certainly doesn't return a usable `ogImage`. The fix is to add a fallback image source.

## Detailed Findings

### Full pipeline: URL → image_url in DB

**Entry point**: `src/app/(authenticated)/recipes/add-recipe-action.ts`
- Validates URL, checks auth/dedup
- Inserts `recipe_shares` row with `status: 'pending'`
- Fires Inngest event `recipe/extract` (async) and redirects

**Inngest function** (`src/inngest/functions.ts`):

**Step A — Scrape**
- `isBlogspotUrl()` → `false` for polskiekulinaria.pl → takes the Firecrawl path
- `scrapeWithRetry()` calls `https://api.firecrawl.dev/v1/scrape` with `formats: ['markdown', 'html']` and `onlyMainContent: true`; retries with `fullContent: true` if markdown < 200 chars
- **Line ~117**: `ogImage = scraped.metadata?.ogImage` — **the one and only image source**

**Step B — LLM extraction**
- `gpt-4o-mini` parses markdown into structured JSON (`title`, `ingredients`, `steps`, `category`, timing fields)
- The LLM prompt does **not** ask for an image URL — image is never extracted by AI

**Step C — DB write**
- `image_url: ogImage ?? null` inserted into `recipes` row (~line 254)
- `archiveImage()` downloads the external URL, validates MIME + size, uploads to Supabase Storage `recipe-images/{userId}/{recipeId}.{ext}`, overwrites `image_url` with Storage public URL
- If `ogImage` was `null` → `archiveImage()` is never called → `image_url` stays `null`

### Image archive logic

**`src/lib/recipe-image-archive.ts`**  
`archiveImage()` skips archiving and returns `null` when:
- HTTP response is non-200
- `Content-Type` is not `image/jpeg`, `image/png`, or `image/webp` (e.g. `avif`, `gif`, `webp;charset=...`)
- Image > 5 MB
- Fetch times out (15 s)
- Supabase upload fails

**This means**: if Firecrawl returns a valid `ogImage` URL but `archiveImage()` rejects it, `image_url` still holds the raw external URL (not `null`). A completely `null` value in DB is therefore a reliable indicator that Firecrawl returned no `ogImage` at all.

### Blogspot exception (only domain-specific logic)

`src/inngest/functions.ts` lines 83–94: if `isBlogspotUrl()` is `true`, uses Blogger JSON feed (`fetchBloggerPost()` from `src/lib/blogger-feed.ts`) which directly provides a `post.image` field. This bypasses Firecrawl for blogspot URLs. polskiekulinaria.pl does **not** benefit from this.

### No domain-specific handling for polskiekulinaria.pl

Full-text search across the codebase returned **zero matches** for `polskiekulinaria`. The site goes through the generic `web_blog` Firecrawl path with no fallbacks.

## Code References

- `src/inngest/functions.ts:117` — `ogImage = scraped.metadata?.ogImage` (single image source)
- `src/inngest/functions.ts:254` — `image_url: ogImage ?? null` (DB insert)
- `src/inngest/functions.ts:277–282` — `archiveImage()` call after insert
- `src/inngest/functions.ts:83–94` — blogspot special-case (model for domain-specific paths)
- `src/lib/firecrawl.ts:30–62` — `buildFirecrawlOptions()` for `web_blog`
- `src/lib/recipe-image-archive.ts:12–60` — `archiveImage()` with MIME/size guards
- `src/lib/blogger-feed.ts` — Blogger JSON feed integration (pattern to follow)

## Architecture Insights

The pipeline is: **single external source → archive**. There is no retry or fallback layer between Firecrawl's metadata and the DB write. Adding a fallback requires intercepting at line 117 and providing an alternative source when `ogImage` is `undefined`.

**Candidate fallbacks in order of reliability**:

1. **schema.org `Recipe` JSON-LD** — standard structured data on recipe sites; Firecrawl returns `html`, so the JSON-LD `<script>` block can be parsed for `image` field. Most modern recipe sites (including polskiekulinaria.pl likely) include this.
2. **First `<img>` from main content HTML** — Firecrawl already returns `html` in the same scrape response; pick the largest/first `<img src>` from the parsed HTML. Noisier but widely applicable.
3. **OpenAI vision on screenshot** — most expensive; not justified when HTML is available.

Option 1 (schema.org JSON-LD) is the highest-signal fallback: it's semantically correct, doesn't require additional Firecrawl calls, and the `html` field is already in the response.

## Open Questions

- Does Firecrawl's `metadata` include any other image-adjacent fields besides `ogImage` (e.g. `twitterImage`)? Worth logging the full `metadata` object for a polskiekulinaria.pl URL to confirm.
- Is `avif` a realistic Content-Type issue for polskiekulinaria.pl images? If the site serves `.avif`, `archiveImage()` would reject it — but since `image_url` is `null` (not an external URL), this is secondary.
- Should the schema.org fallback be applied only when `ogImage` is absent, or always (treating schema.org as higher quality than `og:image`)?
