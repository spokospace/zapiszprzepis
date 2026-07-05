# Artifact 2 — Structure Map (dependency graph)

> Generowany: 2026-07-06 | Metoda: grep importów + ręczna analiza plików źródłowych

---

## Summary

Projekt ma czterowarstwową architekturę: UI (RSC + Client Components) → Server Actions / Route Handlers → Inngest (kolejka asynchroniczna) → Supabase (baza + storage). Nie wykryto narzędzi do automatycznej analizy grafów (`dependency-cruiser`, `madge` nieobecne w `package.json`). Pipeline przepisów jest ściśle zhierarchizowany — `run-extract-recipe.ts` jest centralnym „workhorse'em" bez odwrotnych zależności. Jedyne wyraźne naruszenie warstw: `share/actions.ts` jest Server Action, który bezpośrednio importuje `inngest/client.ts` — odbywa się tu miks warstwy Server Action z biblioteką kolejkowania. Jest to celowe (dokumentacja projektu to potwierdza), ale tworzy ścisłe sprzężenie, które utrudni ewentualną wymianę Inngest.

---

## Entry Points

| Plik | Typ | Co obsługuje |
|---|---|---|
| `src/app/share/route.ts` | Route Handler (POST) | Web Share Target API — przeglądarka udostępnia URL z telefonu |
| `src/app/api/inngest/route.ts` | Route Handler (GET/POST/PUT) | Webhook Inngest — rejestracja funkcji i odbiór triggerów |
| `src/app/api/recipes/delete/route.ts` | Route Handler (POST) | Usuwanie przepisu + czyszczenie storage |
| `src/app/auth/callback/route.ts` | Route Handler (GET) | Wymiana kodu PKCE Supabase po mailu z linkiem |
| `src/inngest/functions.ts::extractRecipe` | Inngest Function | Asynchroniczna ekstrakcja przepisu — uruchamiana przez kolejkę |
| `src/app/(authenticated)/recipes/add-recipe-action.ts` | Server Action | Ręczne wklejanie URL przez użytkownika |
| `src/app/(authenticated)/recipes/retry-action.ts` | Server Action | Ponów nieudaną ekstrakcję |
| `src/app/(authenticated)/recipes/[slug]/refresh-action.ts` | Server Action | Force-refresh istniejącego przepisu |
| `src/app/(authenticated)/recipes/search-via-exa-action.ts` | Server Action | Wyszukiwanie przepisów przez Exa API |

---

## Dependency Clusters

### Klaster A — Recipe Pipeline (rdzeń)

```
src/app/share/route.ts
  └─► src/app/share/actions.ts::triggerRecipeExtraction
        ├─► src/inngest/client.ts          (inngest.send)
        ├─► src/lib/supabase/server.ts     (createSupabaseServerClient)
        ├─► src/lib/detect-source-type.ts
        └─► src/lib/recipe-dedup.ts
              └─► src/lib/url-normalize.ts

src/app/(authenticated)/recipes/add-recipe-action.ts
  └─► src/app/share/actions.ts::triggerRecipeExtraction  (re-używa tego samego flow)

src/app/api/inngest/route.ts
  ├─► src/inngest/client.ts
  └─► src/inngest/functions.ts::extractRecipe
        ├─► src/inngest/client.ts
        ├─► src/inngest/run-extract-recipe.ts    (≈ 350 linii, główna logika)
        │     ├─► src/lib/firecrawl.ts
        │     ├─► src/lib/blogger-feed.ts
        │     ├─► src/lib/youtube.ts
        │     ├─► src/lib/content-quality.ts
        │     ├─► src/lib/recipe-image-archive.ts
        │     ├─► src/lib/recipe-categories.ts
        │     └─► src/lib/slugify.ts
        └─► src/lib/env.ts                       (SUPABASE_URL, service role key)
```

### Klaster B — Auth & Middleware

```
src/middleware.ts
  └─► src/lib/supabase/proxy.ts::updateSession

src/lib/supabase/server.ts
  └─► src/lib/env.ts  (SUPABASE_URL, SUPABASE_ANON_KEY)

src/app/login/actions.ts
src/app/signup/actions.ts
src/app/forgot-password/actions.ts
src/app/reset-password/actions.ts
  wszystkie ► src/lib/supabase/server.ts
```

### Klaster C — UI (authenticated recipes)

```
src/app/(authenticated)/recipes/page.tsx
  └─► src/app/(authenticated)/recipes/recipes-content.tsx  (Client Component)
        └─► src/app/components/*  (recipe-card, category-filter, recipe-search, …)

src/app/(authenticated)/layout.tsx
  └─► src/lib/supabase/server.ts (requireUser — guard dostępu)
```

### Klaster D — Shared lib (pure utils)

Pliki bez zależności w górę (liście drzewa):
`url-normalize.ts`, `slugify.ts`, `format-minutes.ts`, `site-url.ts`, `pwa-utils.ts`, `ingredients.ts`

---

## Layer Analysis

```
┌─────────────────────────────────────────────────┐
│  WARSTWA UI                                      │
│  src/app/(authenticated)/**  +  src/app/page.tsx│
│  + src/app/components/*                         │
└─────────────┬───────────────────────────────────┘
              │ Server Actions / Route Handlers
┌─────────────▼───────────────────────────────────┐
│  WARSTWA SERWERA                                 │
│  src/app/share/actions.ts                       │
│  src/app/*/actions.ts  (auth, recipes)          │
│  src/app/api/recipes/delete/route.ts            │
└──────────┬──────────────────┬───────────────────┘
           │ inngest.send()   │ supabase.*
┌──────────▼───────┐  ┌───────▼────────────────────┐
│  INNGEST QUEUE   │  │  SUPABASE (DB + Storage)    │
│  functions.ts    │  │  createSupabaseServerClient │
│  run-extract-    │  │  createClient (service role)│
│  recipe.ts       │  └─────────────────────────────┘
└──────────┬───────┘
           │ zewnętrzne API
┌──────────▼────────────────────────────────────────┐
│  ZEWNĘTRZNE SERWISY                               │
│  Firecrawl (scraping)  |  Claude/OpenAI (LLM?)   │
│  Exa (discovery)       |  Supabase Storage        │
└───────────────────────────────────────────────────┘
```

Uwaga: `run-extract-recipe.ts` wywołuje LLM bezpośrednio przez `fetch` — bez dedykowanej warstwy adaptera. Nie wykryto importu Anthropic SDK ani OpenAI SDK w plikach źródłowych (wywołanie może iść przez Firecrawl's extract endpoint).

---

## Coupling Risks

| Ryzyko | Gdzie | Dlaczego boli |
|---|---|---|
| `share/actions.ts` importuje `inngest/client.ts` | Server Action → kolejka | Server Action zna konkretny broker — wymiana Inngest wymaga edycji Server Action |
| `functions.ts` tworzy `supabase` z service-role key | Inngest → Supabase | Obejście RLS w pipeline; każdy bug w `run-extract-recipe.ts` ma pełny dostęp do bazy |
| `run-extract-recipe.ts` — 350+ linii, wszystkie ścieżki w jednej funkcji | Inngest layer | Fat function: Facebook/YouTube/Blogspot/web — każdy nowy typ źródła rozrasta ten plik |
| Brak adaptera dla LLM/Firecrawl | `run-extract-recipe.ts` | URL endpointów i format odpowiedzi zakodowane inline; zmiana providera = przepisanie środka funkcji |
| `requireUser()` zawiera `redirect()` | `src/lib/supabase/server.ts` | Lib-level side effect — nieoczekiwane dla funkcji pomocniczej, trudno testowalne |
| Brak okrągłych zależności | — | Czyste DAG (zweryfikowano manualnie) |

---

## Unknowns

- Nie ustalono, czy ekstrakcja LLM idzie przez Firecrawl's `/extract` endpoint (z LLM wbudowanym), czy przez osobne wywołanie AI API — `run-extract-recipe.ts` wymaga pełnego odczytu.
- `src/lib/failed-shares.ts` — rola nieustalona (nie analizowano pełnej treści; pojawia się we współzmienności z `(authenticated)`).
- Exa integration (`search-via-exa-action.ts`) — nie analizowano głęboko; osobny cluster z API key w env.
- Brak `dependency-cruiser` — graf oparty na ręcznym grep; mogą istnieć pośrednie zależności przez dynamiczne importy.
