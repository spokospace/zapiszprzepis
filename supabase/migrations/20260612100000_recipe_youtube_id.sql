-- S-04: YouTube recipe source
-- Store an optional YouTube video id (11 chars) per recipe so the detail
-- page can embed the clip below the recipe. Two sources feed it:
--   1. The shared URL itself is a YouTube link (source_type = 'youtube').
--   2. A shared blog post (source_type = 'web_blog') embeds a YouTube iframe.
-- yt-dlp + Whisper transcription was abandoned: the extraction pipeline runs
-- in a serverless runtime (Inngest on Cloudflare) where a yt-dlp binary /
-- subprocess cannot run. Embedding the player sidesteps that entirely.

alter table public.recipes
  add column youtube_id text;

comment on column public.recipes.youtube_id is
  'Optional YouTube video id (11 chars) for embedding. From a shared YouTube URL or a YouTube iframe embedded in a scraped blog page.';
