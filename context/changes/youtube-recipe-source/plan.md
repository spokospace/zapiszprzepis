---
change_id: youtube-recipe-source
title: Trzecie źródło: przepisy z YouTube
description: Mama udostępnia URL YouTube (lub blog z osadzonym filmem) i widzi przepis z odtwarzaczem wideo (iframe)
author: Szymon
status: implemented
dependencies:
  - S-01 (first-shared-recipe-fb-text)
  - S-02 (web-blog-recipe-source)
---

# S-04: YouTube Recipe Source

## Cel

Trzecie źródło przepisów — film z YouTube trafia do aplikacji i mama widzi
przepis z **osadzonym odtwarzaczem wideo** pod treścią przepisu.

## Pivot względem pierwotnego planu

Pierwotny plan (poniżej, w sekcji „Plan archiwalny") zakładał `yt-dlp` (pobranie
audio) + Whisper (transkrypcja). **To ślepa uliczka w tym stacku:** pipeline
ekstrakcji żyje w runtime serverless (Inngest na Cloudflare), gdzie nie ma jak
uruchomić binarki/subprocesu `yt-dlp`. To była ściana „z YouTube był problem".

Zamiast tego zapisujemy **sam 11-znakowy video ID** (`recipes.youtube_id`) i
osadzamy `youtube-nocookie` iframe na detalu. Dwie ścieżki:

- **Opcja 1 — udostępniony link YouTube** (`source_type='youtube'`): ID z URL-a
  (`youtubeIdFromUrl`); tekst przepisu best-effort z tytułu + opisu wideo
  (Firecrawl scrapuje stronę YT).
- **Opcja 2 — wpis blogowy z osadzonym filmem** (`source_type='web_blog'`): tekst
  z bloga (S-02), a ID z dedykowanego full-page embed-scanu HTML
  (`findEmbeddedYoutubeId`).

## Co weszło

- Migracja `recipes.youtube_id` (nullable, 11 znaków) — `20260612100000` — d6a81ba
- `src/lib/youtube.ts` — `youtubeIdFromUrl` (watch/youtu.be/shorts/embed/live),
  `findEmbeddedYoutubeId` (skan HTML), współdzielone `normalizeHost`/`isYoutubeHost` — d6a81ba
- `detect-source-type` — hosty YT → `source_type='youtube'` (reużywa host-helperów) — d6a81ba
- `firecrawl` — opcje scrapera YT; `buildEmbedScanOptions` (full-page, bez excludeTags) — d6a81ba, ddd0a6c
- `inngest/functions` — `youtubeId = youtubeIdFromUrl(sharedUrl) ?? findEmbeddedYoutubeId(embedHtml || html)`;
  insert + gap-fill; embed-scan równolegle (`Promise.all`) dla `web_blog` — d6a81ba, ddd0a6c
- Detal — responsywny 16:9 `youtube-nocookie` iframe w sekcji „Wideo" pod przepisem — d6a81ba

## Checklist testowania

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. ` — <sha>` przy realizacji.

- [x] Build/typecheck/lint przechodzi dla plików S-04 — ddd0a6c
- [x] `youtubeIdFromUrl` / `findEmbeddedYoutubeId` / `detectSourceType` — 18/18 przypadków (watch/youtu.be/shorts/embed/live/m., iframe/anchor, malformed) — d6a81ba
- [x] Opcja 1 end-to-end: link YT → `source_type=youtube`, `youtube_id` z URL, iframe na detalu — zweryfikowane na produkcji (zapiszprzepis.pl) — 21cef04
- [x] Opcja 2 end-to-end: blog z osadzonym YT (kwestiasmaku paella) → `source_type=web_blog`, `youtube_id=ycttbMHPISM`, tekst przepisu OK — zweryfikowane lokalnie — 35ff8c5
- [x] Tekst best-effort z opisu wideo (Opcja 1) — 15 składników/4 kroki z filmu Smaczny.TV — 21cef04
- [x] RLS: dziedziczona z S-01 (insert z `user_id`, ten sam path) — d6a81ba

## Ryzyka / znane ograniczenia

- **Firecrawl bywa wolny na stronach YT** — intermittentny `Request Timeout`; pokrywa `retries: 3` Inngesta.
- **Opcja 2 robi drugi scrape dla każdego `web_blog`** (też bez wideo) — latencja schowana przez `Promise.all`, koszt ~1 kredyt Firecrawl. Świadomy MVP-tradeoff; pre-check `og:video`/JSON-LD mógłby go pominąć, ale gubiłby zwykłe `<iframe>`.
- **Facade/JS-only embedy** (np. AniaGotuje) nie wychodzą w scrapie — wideo wtedy się nie złapie. Akceptowalne best-effort.

## Definition of Done

- [x] PR zmergowany do master (#75 + #76)
- [x] Filmy YouTube i blogi z osadzonym filmem dają `youtube_id` + iframe
- [x] Ten sam schemat przepisu co S-01/S-02
- [x] RLS dla źródeł YouTube

---

## Plan archiwalny (yt-dlp + Whisper — PORZUCONY)

> Zachowane dla kontekstu. Nie zaimplementowane — patrz „Pivot" wyżej.

### Faza 1: Add yt-dlp to pipeline
- Install package: `pnpm add yt-dlp-exec` or use native `yt-dlp` via subprocess
- Detect YouTube URL, download video metadata + audio, pipe to Whisper

### Faza 2: Integrate Whisper API
- POST audio to OpenAI `/v1/audio/transcriptions`, pass transcript to the LLM extraction

### Faza 3: Error handling + testing
- yt-dlp failures (age-restricted, deleted, geo-blocked), Whisper failures, metadata fallback

**Powód porzucenia:** brak możliwości uruchomienia binarki `yt-dlp` w serverless (Inngest/Cloudflare).
