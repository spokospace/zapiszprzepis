---
title: Recipe Pipeline Analysis
type: feature-analysis
created: 2026-07-06
---

## ② Przegląd funkcji

### Ślad end-to-end potoku

Potok startuje w jednym z czterech punktów wejścia i zawsze trafia do `runExtractRecipe` przez Inngest:

```
[Web Share Target / ręczne dodanie]
        │
        ▼
POST /share (route.ts:35) lub addRecipeFromUrl (add-recipe-action.ts:9)
        │
        ├─ firstUrl() — wyciąganie URL z url/text/title (route.ts:27)
        ├─ auth check (getUser / requireUser)
        ├─ findExistingRecipeForUrl — dedup check → nowy/pending/completed
        ├─ INSERT recipe_shares (status:'pending')
        └─ inngest.send('recipe/extract')
                │
                ▼
        extractRecipe (functions.ts:6)  [retries:3]
                │
                ▼
        runExtractRecipe (run-extract-recipe.ts:38)
                │
                ├─ [blogspot?] fetchBloggerPost() → JSON feed
                │  └─ fallback: firecrawlScrape()
                ├─ [inne] scrapeWithRetry() (Firecrawl API)
                │  ├─ main-content pass
                │  └─ fullContent retry gdy markdown < 200 znaków
                ├─ [web_blog] buildEmbedScanOptions() — skan iframów (YouTube)
                ├─ youtubeIdFromUrl / findEmbeddedYoutubeId
                ├─ looksUnextractable() — brama wejściowa
                ├─ OpenAI gpt-4o-mini (chat completions)
                ├─ JSON.parse(content) — parsowanie odpowiedzi
                ├─ isExtractedRecipeUsable() — brama wyjściowa
                ├─ [force=true] UPDATE recipes + UPDATE recipe_shares (refreshed)
                ├─ [normal] INSERT recipes (pętla slug, gap-fill przy URL collision)
                ├─ archiveImage() → Supabase Storage
                └─ UPDATE recipe_shares (status:'completed')
```

Równoległy przepływ dla retries i odświeżania:

- `retryShare` (retry-action.ts:17) — reset share do 'pending', ponowne `inngest.send()`
- `refreshRecipe` (refresh-action.ts:13) — nowy share row + `inngest.send()` z `force:true`
- `dismissShare` / `dismissAllFailedShares` (dismiss-action.ts) — usuwa failed shares z dzwonka

### Punkty wejścia

| Plik | Linia | Opis |
|---|---|---|
| `src/app/share/route.ts` | 35 | Web Share Target POST — systemowy "Udostępnij" z Androida |
| `src/app/(authenticated)/recipes/add-recipe-action.ts` | 9 | Ręczne dodanie przez formularz na /recipes |
| `src/app/(authenticated)/recipes/retry-action.ts` | 17 | Ponowienie nieudanej ekstrakcji (dzwonek błędów) |
| `src/app/(authenticated)/recipes/[slug]/refresh-action.ts` | 13 | "Odśwież przepis" dla istniejącego przepisu |
| `src/app/api/inngest/route.ts` | 1 | Webhook Inngest (GET/POST/PUT) |

### Przepływ danych

**Wejście:** URL (string) + opcjonalnie title/text z Web Share Target

**Transformacje:**
1. `normalizeUrl()` — usuwa trailing slash, zachowuje query string (url-normalize.ts:1)
2. `detectSourceType()` — klasyfikacja: `facebook_text` | `web_blog` | `youtube` (detect-source-type.ts:3)
3. Firecrawl scrape → markdown + html (do 20 000 znaków każde — run-extract-recipe.ts:181)
4. OpenAI gpt-4o-mini → JSON `RecipeData` (title, ingredients[], steps[], category, times)
5. `slugify(title)` → unikalny slug z pętlą kolizji (max 10 prób)

**Co jest zapisywane:**

| Tabela | Pola | Moment |
|---|---|---|
| `recipe_shares` | url, status, share_intent, attempts | przed Inngest |
| `recipe_shares` | recipe_id, status:'completed' | po udanej ekstrakcji |
| `recipe_shares` | status:'failed', error_message | przy każdym wyjątku |
| `recipes` | title, slug, ingredients (JSON), steps (JSON), category, source_url, youtube_id, times | po parsowaniu OpenAI |
| `recipe-images` (Storage) | `{userId}/{recipeId}.{ext}` | archiwizacja og:image |

### Kluczowe zależności zewnętrzne

| Serwis | Cel | Timeout | Klucz |
|---|---|---|---|
| Firecrawl API `api.firecrawl.dev/v1/scrape` | Scraping stron WWW/YouTube | 45 s (run-extract-recipe.ts:58) | `FIRECRAWL_API_KEY` |
| OpenAI `api.openai.com/v1/chat/completions` | Ekstrakcja przepisu, gpt-4o-mini | 60 s (run-extract-recipe.ts:186) | `OPENAI_API_KEY` |
| Blogger JSON feed `blogspot.com/feeds/posts/default` | Alternatywa dla Firecrawl na blogspot | 15 s (blogger-feed.ts:45) | — (publiczne) |
| Exa API `api.exa.ai/search` | Odkrywanie przepisów (poza głównym potokiem) | 10 s (search-via-exa-action.ts:44) | `EXA_API_KEY` |
| Supabase Postgres | recipe_shares, recipes | — | service role key |
| Supabase Storage `recipe-images` | Archiwum zdjęć | 15 s (recipe-image-archive.ts:12) | service role key |
| Inngest | Kolejkowanie + retry | — | `INNGEST_SIGNING_KEY` |

---

## ③ Dług techniczny

### Mapa ryzyka

| # | Ryzyko | Lokalizacja | Ważność | Typ |
|---|---|---|---|---|
| R-1 | `inngest.send()` rzuca wyjątek → share ląduje w 'failed', ale `triggerRecipeExtraction()` zwraca sukces użytkownikowi | share/actions.ts:70-84 | Wysoka | [dowód] |
| R-2 | `JSON.parse(content)` bez try/catch — malformed JSON od OpenAI → opaque SyntaxError, 3 niepotrzebne retry | run-extract-recipe.ts:197 | Wysoka | [dowód] |
| R-3 | `refreshRecipe` nie sprawdza błędu INSERT recipe_shares — jeśli insert fail, share=null, kod pomija inngest.send() ale nadal redirectuje z `?refreshing=1` | refresh-action.ts:39-66 | Średnia | [dowód] |
| R-4 | `normalizeUrl()` zachowuje tracking params (`?fbclid=`, `?utm_*`) — ten sam przepis z różnymi UTM-ami nie deduplicuje | url-normalize.ts:1-10 | Średnia | [dowód] |
| R-5 | Wielokrotne wywołania `refreshRecipe` tworzą wiele pending recipe_shares dla tego samego URL — brak guard'u przed duplikatem | refresh-action.ts:39-66 | Niska | [dowód] |
| R-6 | `archiveImage()` failure jest całkowicie cicha: konsola warning + return null → przepis zapisany z zewnętrznym URL → naruszenie gwarancji durability | recipe-image-archive.ts:51-104 | Niska | [dowód] |
| R-7 | Brak testów dla wszystkich Server Actions poza `share/actions.ts` — `add-recipe-action`, `retry-action`, `refresh-action`, `dismiss-action` | src/app/(authenticated)/recipes/*.ts | Średnia | [wnioskowanie] |

### Krytyczne ryzyka

#### R-1: Fałszywe potwierdzenie przy awarii kolejkowania

**Plik:** `src/app/share/actions.ts:58-84` [dowód]

```
await inngest.send(...)   // może rzucić
// ↑ catch: markuje share jako failed, ale...
return { shareId: share.id, message: 'Zapisałem — przepis pojawi się za chwilę' }
// ↑ użytkownik widzi sukces, choć Inngest nigdy nie dostał zdarzenia
```

Konsekwencja: mama klika "Udostępnij", widzi "Zapisałem", wraca do aplikacji — przepis nigdy nie pojawia się na liście. Dysonans między feedbackiem a rzeczywistością. Użytkownik musi aktywnie kliknąć dzwonek, żeby zobaczyć błąd. Ten sam wzorzec istnieje w `add-recipe-action.ts:48-66` — redirect do `/recipes?shared=1` następuje bez względu na wynik send().

**Test dla tego scenariusza:** `share/actions.test.ts:26-57` — test weryfikuje że share jest oznaczony jako failed, ale nie weryfikuje że `message` nie jest zwracane przy awarii.

#### R-2: `JSON.parse` bez obsługi błędu parsowania

**Plik:** `src/inngest/run-extract-recipe.ts:197` [dowód]

```typescript
const recipeJSON = JSON.parse(content) as RecipeData
```

OpenAI gpt-4o-mini czasem zwraca JSON opakowany w markdown code fence (` ```json\n{...}\n``` `), lub JSONa z trailing commą. `JSON.parse` rzuca `SyntaxError`. Błąd propaguje przez catch na lini 366, ustawia share.status='failed' i rethrows — Inngest wykona wszystkie 3 retry z tym samym wynikiem (to samo zapytanie, ten sam model, podobna odpowiedź). Komunikat błędu w `error_message` to niejasne `"Unexpected token ` — mama ani autor nie rozumieją przyczyny.

Brak testu dla tego scenariusza w `run-extract-recipe.test.ts`.

#### R-3: Cicha awaria `refreshRecipe` przy nieudanym INSERT

**Plik:** `src/app/(authenticated)/recipes/[slug]/refresh-action.ts:39-66` [dowód]

```typescript
const { data: share } = await supabase
  .from('recipe_shares')
  .insert({ ... })
  .select()
  .single()
// brak: if (!share) return lub throw

if (share) {
  await inngest.send(...)
}
// jeśli share === null → inngest.send() pominięty
redirect(`/recipes/${slug}?refreshing=1`)  // zawsze
```

Gdy INSERT recipe_shares się nie powiedzie (np. błąd DB, limit połączeń), `share` jest null, kod pomija Inngest, ale redirect do `?refreshing=1` następuje — użytkownik widzi spinner "odświeżam" który nigdy się nie kończy. Brak analogicznego error handling jak w `retry-action.ts:43-54` (compare-and-swap z pełnym error check).

### Luki w pokryciu testami

**Pokryte:**
- `run-extract-recipe.test.ts` — junk gate, output gate, URL collision gap-fill, happy path (4 testy)
- `share/actions.test.ts` — inngest.send() failure (2 testy)
- `lib/*.test.ts` — blogger-feed, content-quality, detect-source-type, env, firecrawl, ingredients, recipe-image-archive, youtube

**Niepokryte przepływy:**
| Plik | Brakujące scenariusze |
|---|---|
| `src/app/share/route.ts` | Cały handler POST — URL z text field, brak URL, auth redirect, błąd serwera |
| `src/app/(authenticated)/recipes/add-recipe-action.ts` | Dedup redirect, invalid URL redirect, share insert failure |
| `src/app/(authenticated)/recipes/[slug]/refresh-action.ts` | Share insert failure (R-3), brak source_url, inngest.send() failure |
| `src/app/(authenticated)/recipes/retry-action.ts` | Compare-and-swap race (dwa równoległe "Ponów"), inngest.send() failure rollback |
| `src/app/(authenticated)/recipes/dismiss-action.ts` | Błąd Supabase delete |
| `src/lib/recipe-dedup.ts` | Race między pending check a insert |
| `src/lib/url-normalize.ts` | Tracking params, fragmenty (#), malformed URL |
| `src/lib/failed-shares.ts` | Auto-resolve logika, dedup by URL |
| `src/inngest/run-extract-recipe.ts` | JSON.parse failure (R-2), archiveImage failure (R-6), force refresh path |

### Promień rażenia

**`src/inngest/run-extract-recipe.ts`** — najkrytyczniejszy plik. Zmiana tego pliku wpływa na każdy przepis w systemie. Używany bezpośrednio przez `functions.ts`. Efekt zmiany: wszystkie nowe ekstrakcje mogą się złamać. Brak izolacji — `runExtractRecipe` jest monolityczną funkcją 376 linii z 5 fazami (scraping, YouTube, jakość, AI, DB).

**`src/inngest/client.ts` + event name `'recipe/extract'`** — cztery pliki wysyłają zdarzenie o tej samej nazwie: `share/actions.ts:59`, `add-recipe-action.ts:49`, `retry-action.ts:57`, `refresh-action.ts:51`. Zmiana nazwy eventu wymaga synchronicznej aktualizacji wszystkich 4 callsitów + `functions.ts:6` — bez testów integracyjnych to błąd czekający na zmianę [wnioskowanie].

**`recipe_shares` jako maszyna stanów** — cały system zależy na tym że: `status` = `'pending'` → `'completed'` | `'failed'`. Dedup check (recipe-dedup.ts:29) szuka `status='pending'`. Dzwonek błędów (failed-shares.ts:33) szuka `status='failed'`. `retryShare` aktualizuje tylko gdy `status='failed'`. Każda niespójność w przejściach stanów (np. failed share bez `recipe_id` przy istniejącym przepisie) psuje UI. Auto-resolve w `failed-shares.ts:44-60` częściowo mityguje to przez cross-join z `recipes.source_url` [dowód].

**`src/lib/url-normalize.ts`** — dedup, recipe_shares.shared_url i recipes.source_url muszą być identyczne (comment w failed-shares.ts:21: "relies on that invariant"). Zmiana logiki normalizacji bez migracji istniejących URL-i w DB złamie dedup i auto-resolve [wnioskowanie].

### Nieznane

1. **[nieznane]** Zachowanie Firecrawl dla prywatnych postów FB (grupy kulinarne, posty "Tylko znajomi") — scraping może zwrócić redirect do logowania. `looksUnextractable()` powinno to złapać, ale nie ma testów potwierdzających.

2. **[nieznane]** Limit długości dla Inngest event payload — `sharedTitle` i `sharedText` z Web Share Target mogą być duże (np. gdy `text` zawiera cały post FB). Brak truncation przed `inngest.send()`.

3. **[nieznane]** Zachowanie przy równoległych extraction jobs dla tego samego URL — `findExistingRecipeForUrl` sprawdza pending PRZED insertem share, ale nie ma locka. Dwa równoległe POST /share z tym samym URL mogą oba przejść dedup check i oba odpalić Inngest. URL_KEY constraint w pętli slug ratuje DB insert, ale dwa Inngest jobs wygenerują dwa OpenAI calle i dwa Firecrawl calle niepotrzebnie.

4. **[nieznane]** Strategia retry Inngest dla błędów 429 (rate limit) OpenAI/Firecrawl — `retries: 3` bez exponential backoff konfiguracji (functions.ts:7). Domyślne zachowanie Inngest dla retries do weryfikacji w dokumentacji.

5. **[nieznane]** Rzeczywiste pokrycie Facebook Reels / Video — `sourceType='facebook_text'` i Firecrawl scrape z domyślnymi opcjami (bez `actions: [wait]`). Dla Reels prawdopodobnie zwróci tylko og:image + tytuł, bez transkrypcji. Open Question #1 z PRD nigdy nie został formalnie zamknięty.
