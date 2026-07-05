---
change_id: image-save-fix
title: Fix recipe image not being saved/processed
status: implemented
created: 2026-07-05
updated: 2026-07-05
archived_at: null
---

## Notes

Tiramisu recipe was saved without an image (image_url is null in DB). WordPress blogs without og:image meta tag cause Firecrawl to return metadata.ogImage = null, so archiveImage is never called. Fix: add extractFirstImage(html) fallback in the Firecrawl path.
