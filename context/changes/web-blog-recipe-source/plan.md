---
change_id: web-blog-recipe-source
title: Drugie źródło: przepisy z blogów WWW
description: Mama udostępnia URL bloga kulinarnego i widzi przepis (ten sam pipeline co S-01, inny scraper)
author: Szymon
status: implemented
dependencies:
  - S-01 (first-shared-recipe-fb-text)
---

# S-02: Web Blog Recipe Source

## Cel

Drugie źródło przepisów — mama udostępnia URL strony WWW (typowo blog kulinarny) i widzi przepis w aplikacji tak samo jak dla FB postu tekstowego. Ten sam pipeline, inny scraper na początku.

## Wymagania wstępne

- S-01: Complete (schema, extraction task, UI, delete endpoint)

## Fazy implementacji

### Faza 1: Extend extraction task (web scraper)
- Update `src/trigger/extract-recipe.ts`:
  - Add logic to detect source type (facebook_text vs web_blog)
  - For web_blog: use Firecrawl with more aggressive settings (javascript_enabled: true for JS-heavy sites)
  - Same OpenAI extraction prompt works for both
- No new schema changes — `source_type` enum already includes 'web_blog'

### Faza 2: Update Web Share Target
- Modify `src/app/share/route.ts`:
  - Detect source type from URL pattern:
    - facebook.com, fb.watch → facebook_text
    - everything else → web_blog (MVP assumes all non-FB are blogs)
  - Pass source_type hint to triggerRecipeExtraction

### Faza 3: Manual testing + edge case handling
- Test with 5-10 real blog URLs
- Log any Firecrawl failures (timeouts, JS rendering issues)
- Document fallback: if extraction fails for web source, mark best-effort

## Checklist testowania

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. ` — <sha>` przy realizacji.
> Implementacja: pipeline przeniesiony z Trigger.dev na Inngest — ekstrakcja
> żyje w `src/inngest/functions.ts`, opcje scrapera w `src/lib/firecrawl.ts`,
> detekcja źródła w `src/lib/detect-source-type.ts`.

- [x] Build/typecheck przechodzi (`npx tsc --noEmit` czysty dla plików S-02) — af31c00
- [x] Ekstrakcja z URL bloga (vs FB) — user-verified na realnych blogach — ade984e
- [x] Recipes z bloga i z FB mają ten sam schemat (wspólny insert w `extractRecipe`) — ade984e
- [x] Missing og:image → `image_url` null, detail nadal działa (insert: `ogImage ?? null`) — ade984e
- [x] Over-strip blogspot/WordPress → retry `onlyMainContent: false` + excludeTags — af31c00
- [x] RLS: web-sourced recipes dziedziczą izolację z S-01 (insert z `user_id`, ten sam path) — ade984e
- [ ] Edge cases nadal otwarte: JS-heavy SPA bez SSR markdown, paywalle (best-effort, S-07 doda retry UI)

## Ryzyka

- **Firecrawl on JS-heavy sites**: Some blogs require heavy JS rendering; Firecrawl may timeout or return incomplete HTML
- **Variety of blog structures**: Unlike FB (og: metadata is standard), blogs have diverse HTML structures; LLM extraction may need tweaking
- **Best-effort**: If Firecrawl fails, mark recipe_shares status=failed with error; S-07 will add retry UI

## Definition of Done

- PR merged to master
- Blog URLs extract successfully
- Same recipe schema as S-01
- RLS verified for web sources
- Documented in README (S-02 section)
