---
date: 2026-07-05T00:00:00+02:00
researcher: Claude (sonnet-4-6)
git_commit: 0dd268b65d77a487c10172175f75754f73b5324a
branch: worktree-roadmap-v3-mvp-scope
repository: zapiszprzepis
topic: "Discovery via Exa — jak zintegrować wyszukiwanie przepisów w sieci z istniejącym pipeline"
tags: [research, exa, discovery, pipeline, inngest, recipes]
status: complete
last_updated: 2026-07-05
last_updated_by: Claude (sonnet-4-6)
---

# Research: Discovery via Exa

**Date**: 2026-07-05
**Researcher**: Claude (sonnet-4-6)
**Git Commit**: `0dd268b`
**Branch**: worktree-roadmap-v3-mvp-scope
**Repository**: zapiszprzepis

## Research Question

Jak zintegrować Exa Search z projektem, żeby user mógł wpisać hasło (np. "tiramisu"),
dostać listę przepisów z internetu i zapisać wybrany — zamiast wklejać URL ręcznie?

## Summary

Architektura jest prosta: Exa to **czysto upstream discovery layer** — nowy sposób
dostarczenia URL-a do istniejącego pipeline. Żadna linia `inngest/functions.ts` nie musi
się zmienić. Decyzje architektoniczne są już udokumentowane w
`context/foundation/future-recipe-web-search.md` (2026-07-04).

**Punkt integracji:** między UI a `addRecipeFromUrl`. Dziś user wkleja URL, po zmianie
może też wpisać zapytanie → Exa zwraca listę → user klika Zapisz przy wybranym wyniku →
ten URL przechodzi przez identyczny pipeline.

**Kluczowe ograniczenia techniczne:**
- Exa REST API (nie MCP) — klucz API po stronie serwera, wywołanie z server action
- Brak kategorii "recipe" w Exa → konieczne `includeDomains`
- Nie debounce'ować (każdy znak = 1 request = spalony darmowy limit 1000/mies)
- Oznaczyć wyniki już istniejące w bazie usera (dedup)

## Detailed Findings

### 1. Istniejący flow dodawania przepisu

**UI entry point:** `src/app/(authenticated)/recipes/recipes-content.tsx:31-89`
— komponent `AddRecipeForm`, zawsze widoczny nad listą przepisów (nie modal).
Zawiera `<input type="url">` z placeholderem "Wklej link do przepisu (blog, Facebook, …)"
i przycisk "Dodaj przepis".

**Server action:** `src/app/(authenticated)/recipes/add-recipe-action.ts:9-63`
```
FormData.url
  → validateURL + auth check
  → findExistingRecipeForUrl (dedup po source_url)
  → detectSourceType(url)        // src/lib/detect-source-type.ts:3
  → INSERT recipe_shares (status: 'pending')
  → inngest.send('recipe/extract', { shareId, sharedUrl, userId, sourceType, sharedTitle? })
  → redirect /recipes?shared=1
```

Dwa dodatkowe entry points (ten sam `recipe/extract` event):
- `src/app/share/route.ts:35-89` — Android Web Share Target (PWA)
- `src/app/(authenticated)/recipes/retry-action.ts:17-83` — "Ponów" z dzwonka

### 2. Source detection i dedup

**Detekcja źródła:** `src/lib/detect-source-type.ts:3-16`
```ts
detectSourceType(url: string): 'facebook_text' | 'web_blog' | 'youtube'
```
URL od Exa → `'web_blog'` lub `'youtube'` (w zależności od domeny).
Blogspot jest obsługiwany osobną ścieżką wewnątrz Inngest (linie 82-88 w `functions.ts`).

**Dedup:** `findExistingRecipeForUrl` sprawdza `recipes.source_url` (unique per user).
Wyniki Exa, które user już zapisał, można oznaczyć już na etapie UI (przed kliknięciem Zapisz).

### 3. Inngest pipeline — co się NIE zmienia

`src/inngest/functions.ts:34-363` — monolityczna async function, kroki w kolejności:

| # | Linie | Co robi |
|---|-------|---------|
| 1 | 82-88 | Blogspot fast path → Blogger JSON feed |
| 2 | 99-118 | Firecrawl scrape (+ embed scan dla web_blog) |
| 3 | 123 | YouTube ID extraction |
| 4 | 128-130 | Quality gate (`looksUnextractable`) |
| 5 | 132-178 | LLM extraction (gpt-4o-mini, do 20k chars) |
| 6-9 | 184-350 | JSON parse → insert recipes → finalize share |
| 10 | 352-361 | Error handler → status: 'failed' |

**Payload Inngest już obsługuje `sharedTitle`** (`src/inngest/functions.ts:14`),
który trafia jako `Title hint` do LLM promptu (linia 172). Exa zwraca tytuł przy każdym
wyniku — można go przekazać bez żadnych zmian w functions.ts.

### 4. Exa REST API vs. Exa MCP

**Exa MCP** (`mcp__exa__*`) dostępne w tej sesji Claude Code — trzy narzędzia:
- `mcp__exa__web_search_exa` — simple search, brak domain filtering
- `mcp__exa__web_search_advanced_exa` — pełny zestaw parametrów (rekomendowany dla dev/testów)
- `mcp__exa__web_fetch_exa` — fetch URL → markdown

**WAŻNE:** MCP to narzędzie deweloperskie. Aplikacja musi używać **Exa REST API**:
```
POST https://api.exa.ai/search
x-api-key: EXA_API_KEY (env var, serwer only)
```
Wzorzec call'a: tak jak `fetch` do Firecrawl/OpenAI w `src/inngest/functions.ts:44-59`.
Cloudflare Workers: zwykły `fetch`, bez Node.js — działa out-of-the-box.

### 5. Parametry wyszukiwania Exa dla przepisów

Na podstawie schemy `mcp__exa__web_search_advanced_exa` (reprezentatywna dla REST API):

```json
{
  "query": "przepis na tiramisu",
  "numResults": 8,
  "type": "auto",
  "includeDomains": ["kwestiasmaku.com", "mojewypieki.com", "..."],
  "enableHighlights": true,
  "highlightsQuery": "składniki, sposób przygotowania"
}
```

**Brak kategorii "recipe"** — Exa ma: `company`, `research paper`, `news`, `pdf`,
`github`, `personal site`, `people`, `financial report`. Bez `includeDomains` wyniki
będą zawierać sklepy i fora.

**Parametr `contents` = wyłączony** — pipeline i tak scrape'uje pełną treść przez Firecrawl.

### 6. Cztery pułapki (z future-recipe-web-search.md)

1. **Nie debounce'ować** — szukanie na submit/Enter, nie on-change. 1000 req/mies darmowych.
2. **Dedup w wynikach** — `findExistingRecipeForUrl` po każdym URL z Exa → oznacz już zapisane.
3. **`type: 'auto'`, bez `contents`** — treść wyciąga pipeline post-save.
4. **`includeDomains`** — lista serwisów kompatybilnych z ekstraktorem (blogi przepisów, YT).

## Code References

- `src/app/(authenticated)/recipes/recipes-content.tsx:31-89` — `AddRecipeForm` (UI entry point)
- `src/app/(authenticated)/recipes/add-recipe-action.ts:9-63` — `addRecipeFromUrl` server action
- `src/lib/detect-source-type.ts:3-16` — `detectSourceType`
- `src/lib/supabase.types.ts:43-88` — `recipe_shares` tabela
- `src/lib/supabase.types.ts:89-151` — `recipes` tabela
- `src/inngest/functions.ts:11-21` — `ExtractRecipeEvent` typ (w tym `sharedTitle?`)
- `src/inngest/functions.ts:128-130` — quality gate (`looksUnextractable`)
- `src/inngest/functions.ts:172` — Title hint w LLM promptie
- `src/inngest/client.ts:3` — Inngest client (`id: 'zapiszprzepis'`)
- `src/app/api/inngest/route.ts:1-8` — Inngest serve handler

## Architecture Insights

**Seam architecturalny jest czysty.** Między "user ma URL" a "pipeline zaczyna działać"
nie ma żadnej logiki biznesowej, którą discovery musiałoby duplikować. Exa discovery
to wyłącznie nowy **sposób uzyskania URL-a** — reszta idzie istniejącą ścieżką.

**Nowe elementy do zbudowania:**
1. Server action `searchRecipesViaExa(query)` → Exa REST API → lista `{url, title, thumbnail?}`
2. UI state w `recipes-content.tsx`: tryb "Szukaj" obok trybu "Wklej URL" (lub tab/toggle)
3. Komponent listy wyników z przyciskiem Zapisz przy każdym → wywołuje `addRecipeFromUrl(url, title)`
4. Oznaczenie wyników już w bazie (query `findExistingRecipeForUrl` dla każdego URL z listy)
5. Env var `EXA_API_KEY` w `.env.local` i Cloudflare secrets

**Nie zmienia się:**
- `inngest/functions.ts` — całkowicie bez modyfikacji
- `add-recipe-action.ts` — bez modyfikacji (może opcjonalnie przyjmować `sharedTitle`)
- `detect-source-type.ts` — bez modyfikacji
- Supabase schema — bez modyfikacji

## Historical Context

- `context/foundation/future-recipe-web-search.md` (2026-07-04) — pełna notatka kierunkowa:
  rekomenduje Exa REST API, dokumentuje 4 pułapki, porównuje z podejściem crawler-silnik.
  **To jest źródło prawdy dla decyzji architektonicznych tej zmiany.**
- `context/archive/2026-06-15-test-pure-pipeline-units/` — Phase 1 testów, zarchiwizowane
- `context/changes/recipe-url-dedup/` — dedup URL, powiązany z krokiem dedup w discovery
- `context/changes/web-blog-recipe-source/` — ekstraktory blogów (powiązane z `includeDomains`)

## Open Questions

1. **Lista `includeDomains`** — które polskie serwisy przepisów warto wstępnie zakodować?
   (kwestiasmaku.com, mojewypieki.com, smaker.pl, aniagotuje.pl, pyszne.pl, …)
   Czy lista ma być hardcoded, czy konfigurowalna?

2. **UI toggle** — jeden input z przełącznikiem "URL / Szukaj", czy osobna sekcja/zakładka?

3. **Liczba wyników** — 5 czy 8? Więcej = lepszy wybór, ale drożej i wolniej.

4. **Fallback gdy Exa zawiedzie** — cicha degradacja do "wklej URL ręcznie", czy komunikat?

5. **EXA_API_KEY secret** — czy jest już w Cloudflare Dashboard, czy dopiero do dodania?
