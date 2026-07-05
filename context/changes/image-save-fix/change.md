---
change_id: image-save-fix
title: Fix image saving bug
status: implementing
created: 2026-07-05
updated: 2026-07-05
archived_at: null
---

## Notes

WordPress blogs (e.g. polskiekulinaria.pl) often omit `<meta property="og:image">`. Firecrawl returns `metadata.ogImage = null` for these pages, so `archiveImage` is never called and `image_url` stays null even though the page has a clear recipe photo.

Fix: add a fallback in `src/inngest/functions.ts` — when `ogImage` is null after Firecrawl scrape, extract the first `<img src>` from `scraped.html` (same pattern as `blogger-feed.ts:56-58`).
