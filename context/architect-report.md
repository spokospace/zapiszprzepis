---
title: Raport Architektoniczny — Moduł 4 (10xArchitect)
project: zapiszprzepis
created: 2026-07-06
---

# Raport Architektoniczny — Moduł 4

## 1. Opisane projekty

| Artefakt | Projekt | Stack | Skala |
|---|---|---|---|
| L2 Mapa repo | zapiszprzepis | Next.js 15, Supabase, Inngest, Cloudflare Pages, TypeScript | ~3 mies., 1 autor, 218 commitów |
| L3 Research ficzera | zapiszprzepis | j.w. | pipeline dodawania przepisu |
| L4 Plan refaktoryzacji | zapiszprzepis | j.w. | error handling + JSON.parse |
| L5 Analiza DDD | zapiszprzepis | j.w. | agregaty Recipe + RecipeShare, ACL Supabase |

---

## 2. Mapa projektu (L2)

Wg `repo-map.md`, projekt ma cztery wyraźne warstwy: Next.js App Router (UI + Server Actions) → Inngest (kolejka async) → `src/lib/` (biblioteka ekstrakcji) → Supabase (DB + Storage). Centrum grawitacji to `src/inngest/run-extract-recipe.ts` — najczęściej zmieniany, najkrytyczniejszy, 350+ linii bez izolacji między fazami (scraping, YouTube, AI, persist).

**Kluczowe powiązania:** `share/actions.ts` importuje bezpośrednio `inngest/client` (celowe sprzężenie, ale wymiana brokera = edycja pliku biznesowego). `lib/supabase/server.ts` zawiera `redirect()` (efekt uboczny w warstwie lib — trudna do testowania jednostkowego). `functions.ts` używa service-role key, co daje Inngest pełny dostęp do DB z pominięciem RLS.

**Strefy ryzyka:** (1) fat function pipeline — każdy nowy typ źródła rozrasta `run-extract-recipe.ts`; (2) brak adaptera LLM/Firecrawl — URL i logika retry zakodowane inline; (3) brak abstrakcji event bus — cztery callsity wysyłają event `'recipe/extract'` bez warstwy pośredniej.

**Nieznane:** zachowanie Firecrawl dla prywatnych postów FB, limit payload Inngest dla dużych Web Share Target `text`, ryzyko race condition przy równoległych POST /share z tym samym URL.

---

## 3. Analiza ficzera (L3)

**Badany przepływ:** pipeline dodawania przepisu (URL → Inngest → Supabase)

**Feature overview:** Użytkownik udostępnia URL (z przeglądarki lub systemowego "Udostępnij") do czterech możliwych punktów wejścia (`share/route.ts`, `add-recipe-action.ts`, `retry-action.ts`, `refresh-action.ts`). Każdy punkt wejścia zapisuje `recipe_shares` (status: `pending`), wysyła zdarzenie `recipe/extract` do Inngest, który uruchamia `runExtractRecipe` z retries: 3. Funkcja scrapuje stronę (Firecrawl lub Blogger feed), wysyła markdown do OpenAI gpt-4o-mini, parsuje wynik, zapisuje `recipes`, archiwizuje zdjęcie w Supabase Storage i aktualizuje share na `completed`. Przy błędzie ustawia `status: failed` i rethrows dla Inngest retry.

**Technical debt — top 3 ryzyka:**

| Ryzyko | Plik:linia | Ważność | Potwierdzenie |
|--------|-----------|---------|--------------|
| R-1: `inngest.send()` rzuca → share `failed`, ale użytkownik widzi "Zapisałem" | `share/actions.ts:70-84`, `add-recipe-action.ts:48-66` | Wysoka | [dowód] — istniejący test `share/actions.test.ts:26-57` nie weryfikuje że `message` nie jest zwracane przy awarii |
| R-2: `JSON.parse(content)` bez try/catch — malformed JSON od OpenAI → 3 niepotrzebne retry | `run-extract-recipe.ts:197` | Wysoka | [dowód] — brak testu dla code fence w `run-extract-recipe.test.ts` |
| R-3: `refreshRecipe` nie sprawdza błędu INSERT `recipe_shares` — spinner `?refreshing=1` nieskończony | `refresh-action.ts:39-66` | Średnia | [dowód] — brak analogicznego error check jak w `retry-action.ts:43-54` |

---

## 4. Plan refaktoryzacji (L4)

**Co refaktoryzujemy:** dwa aktywne błędy error handling w pipeline — fałszywy sukces przy awarii Inngest (R-1) i niegracious SyntaxError przy malformed JSON od OpenAI (R-2). Cel: minimalne, odwracalne guardy, każdy w osobnym commicie.

**Czego NIE robimy:** pełna przebudowa `run-extract-recipe.ts`, wprowadzenie Value Object `ValidatedRecipeContent`, ACL Supabase, naprawa dedup tracking params, testy integracyjne całego pipeline — wszystko to w osobnych change-id lub backlogu.

**Fazy:**

| Faza | Co | Weryfikacja |
|------|-----|------------|
| 1 — false-success guard | Naprawić `share/actions.ts:70-84` + `add-recipe-action.ts:48-66`: error → użytkownik widzi błąd, nie sukces | Unit test (characterization first), manualny test z wyłączonym Inngest |
| 2 — JSON.parse guard | `run-extract-recipe.ts:197`: try/catch + strip code fence przed parsowaniem | Unit test z mock OpenAI zwracającym JSON w code fence; brak 3 retry dla deterministycznego błędu formatu |
| 3 (opcjonalna) — wydzielenie faz | `detectSource()`, `extractContent()`, `normalizeRecipe()` z `runExtractRecipe`; Branch by Abstraction | Te same testy przed i po; każda funkcja niezależnie testowalna |

---

## 5. Domena wg DDD (L5)

**Ubiquitous Language — kluczowe rozbieżności (wg `01-domain-distillation.md`):**

- **D1 — Kategoria "Wegetariańskie" → "Sałatki":** PRD FR-008 wymienia `Wegetariańskie`; DB enum ma `salatki`. LLM może klasyfikować dania wegetariańskie jako `inne`.
- **D2 — `attempts` nie rośnie przy ręcznym retry:** `retry-action.ts` resetuje status, ale nie inkrementuje `attempts`; reguła "max 3 próby" egzekwowana tylko przez Inngest auto-retry, nie przez pole.
- **D3 — `facebook_reel` w schemacie, ale martwy:** enum DB ma wartość, `detectSourceType` jej nie zwraca, `ExtractRecipeEvent.sourceType` jej nie obejmuje.
- **D4 — Inwariant A4 nie chroni force refresh:** `isExtractedRecipeUsable` wywołane przy normalnej ekstrakcji, ale pominięte w bloku `if (forceRefresh)` — force refresh może nadpisać dobry przepis pustym.
- **D5 — Wyszukiwanie składników w JS, nie SQL:** filtrowanie po składniku w `recipes/page.tsx:27` działa na pobranych wierszach w TypeScript; nie skaluje powyżej ~100-200 przepisów (roadmapa S-05 to adresuje).

**Niezmiennik #1 (A4):** każdy zapisany przepis musi mieć tytuł + składniki (≥1) + kroki (≥1). Dzisiaj egzekwowany przez `isExtractedRecipeUsable` (`content-quality.ts:37`) tylko na ścieżce normalnej ekstrakcji — brak go w bloku `if (forceRefresh)` (`run-extract-recipe.ts:214`) i brak DB-level `CHECK` constraint. Propozycja wg `02-invariant-aggregate-refactor.md`: Value Object `ValidatedRecipeContent.create()` jako jedyna brama do `persistRecipe()` — niemożliwe skonstruowanie nieprawidłowego przepisu.

**Anti-Corruption Layer (wg `03-anti-corruption-layer.md`):** typ `Database` z `supabase.types.ts` (plik generowany przez `supabase gen types`) wyciekł do czterech plików warstwy UI/domenowej: `recipes/page.tsx`, `recipes-content.tsx`, `[slug]/page.tsx`, `recipe-categories.ts`. Grep kryterium: `grep -rn "from.*supabase.types" src/` — aktualnie zwraca 4 hity w warstwie UI; po refaktoryzacji powinien zwracać tylko pliki w `src/lib/supabase/` i `src/adapters/`. Każda migracja schematu Supabase dziś propaguje się do komponentów UI.

---

## 6. Decyzje, które należą do mnie

Pipeline ma 3 miesiące. Zdecydowałem się na guardy (Fazy 1–2) zamiast przebudowy, bo R-1 i R-2 to aktywne błędy widoczne przez użytkownika — mama widzi "Zapisałem" i przepis nie pojawia się. To trzeba naprawić teraz, nie za miesiąc przy okazji większego refaktoru.

Wydzielenie faz `run-extract-recipe.ts` (Faza 3) zostawiam jako opcjonalne. Plik rośnie, ale na razie mamy jeden typ źródła aktywnie dodawany (S-04 YouTube to jedyna otwarta karta). Wydzielenie ma sens gdy dojdzie drugi nowy typ, nie wcześniej — Branch by Abstraction pozwoli to zrobić wtedy bez ryzyka.

ACL dla typów Supabase odkładam świadomie. Jeden użytkownik, ~100 przepisów, żadnej zaplanowanej migracji schematu w najbliższym sprincie. Koszt refaktoru adaptera (2–4h wg `03-anti-corruption-layer.md`) jest uzasadniony dopiero przed pierwszą migracją kolumny lub przed drugim użytkownikiem — nie teraz.

Inwariant A4 na ścieżce force refresh (`02-invariant-aggregate-refactor.md`) to prawdziwy bug — force refresh może nadpisać dobry przepis pustym. To wchodzi do backlogu zaraz po Fazach 1–2 z tego planu, bo dotyczy tej samej funkcji.
