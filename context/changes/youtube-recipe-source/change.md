---
change_id: youtube-recipe-source
title: YouTube recipe source (S-04)
status: implemented
created: 2026-06-07
updated: 2026-06-12
archived_at: null
---

## Notes

third recipe source — capture a YouTube video and embed the player on the recipe detail page (below the recipe). Pivoted away from the original yt-dlp + Whisper plan: that cannot run in the serverless extraction runtime (Inngest on Cloudflare has no way to spawn a yt-dlp binary), which was the "YouTube was a problem" wall. Instead we store just the 11-char video id (`recipes.youtube_id`) and embed a `youtube-nocookie` iframe. Two paths feed it — a directly shared YouTube link (`source_type='youtube'`, recipe text best-effort from the scraped video description) and a blog post that embeds a player (`source_type='web_blog'`, id pulled from a dedicated full-page embed scan). Shipped via PR #75 + #76; verified end-to-end on production (direct link) and locally against a kwestiasmaku blog (embedded player). See [[s-04-youtube-pivot]] and [[local-dev-against-prod]].
