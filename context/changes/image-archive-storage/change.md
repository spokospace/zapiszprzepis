---
change_id: image-archive-storage
title: Archive recipe images into Supabase Storage
status: implemented
created: 2026-06-11
updated: 2026-06-11
archived_at: null
---

## Notes

download recipe images into Supabase Storage at extraction time so they survive when the original blog or social-media post is deleted — the PRD calls this archive-first; today we only persist the external URL and the image breaks the day mecooks rotates a CDN path
