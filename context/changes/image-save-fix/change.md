---
change_id: image-save-fix
title: Fix recipe image not being saved/processed
status: preparing
created: 2026-07-05
updated: 2026-07-05
archived_at: null
---

## Notes

Tiramisu recipe was saved without an image (image_url is null in DB). Need to investigate why the image extraction/saving pipeline fails for some recipes and fix the logic so images are reliably saved.
