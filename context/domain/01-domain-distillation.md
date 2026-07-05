---
created: 2026-07-06
source_prd: context/foundation/prd.md (v1)
source_roadmap: context/foundation/roadmap.md (v3)
codebase_snapshot: 2026-07-05
---

# Destylacja domeny — ZapiszPrzepis

## 1. Język Wszechobecny (Ubiquitous Language)

| Termin | Definicja domenowa | Gdzie w PRD | Gdzie w kodzie |
|--------|-------------------|-------------|----------------|
| **Przepis** (Recipe) | Trwała, polskojęzyczna kopia treści kulinarnej — tytuł, składniki jako lista, kroki, zdjęcie archiwalne, etykieta źródła | US-01, FR-006, Business Logic | `src/lib/supabase.types.ts:89` (tabela `recipes`) |
| **Udostępnienie** (Share / RecipeShare) | Akcja przekazania URL do aplikacji przez systemowy gest lub formularz; punkt wejścia każdego żądania zapisu | FR-002, FR-003 | `src/lib/supabase.types.ts:42` (tabela `recipe_shares`) |
| **Ekstrakcja** | Automatyczne wyciągnięcie struktury przepisu ze zescrapowanej strony przez LLM (gpt-4o-mini) | Business Logic §4 | `src/inngest/run-extract-recipe.ts:38` |
| **Archiwizacja** | Zapisanie kopii obrazu w Supabase Storage zamiast zewnętrznego URL — klucz zasady *archive-first* | FR-006, Guardrail "Trwałość kopii" | `src/lib/recipe-image-archive.ts` |
| **Pipeline** | Cały łańcuch: intake → dedup → scrape → LLM → persist → archiwum obrazu | Business Logic | `src/app/share/actions.ts` → `src/inngest/functions.ts` → `src/inngest/run-extract-recipe.ts` |
| **Dedup** | Mechanizm wykrywania duplikatów: ten sam znormalizowany URL nie może trafić do ekstrakcji dwa razy dla tego samego użytkownika | FR-003 (implicit) | `src/lib/recipe-dedup.ts:11` |
| **Normalizacja URL** | Ujednolicenie URL (usunięcie trailing slash, zachowanie query string) przed zapisem | — | `src/lib/url-normalize.ts:1` + SQL `normalize_url()` w `supabase.types.ts:158` |
| **Kategoria** | Klasyfikacja przepisu z fixed taxonomy (8 wartości); przypisywana przez LLM z listy w prompcie | FR-008 | `src/lib/recipe-categories.ts:5`, enum `recipe_category` w `supabase.types.ts:163` |
| **Źródło** (Source) | Platforma/typ skąd pochodzi przepis; decyduje o ścieżce scrapowania | FR-004 | `src/lib/detect-source-type.ts:3`, enum `recipe_source` w `supabase.types.ts:173` |
| **Slug** | Unikalny identyfikator URL przepisu w obrębie konta użytkownika; generowany z tytułu | — | `src/inngest/run-extract-recipe.ts:251`, constraint `recipes_user_id_slug_key` |
| **Składnik** (Ingredient) | Pozycja listy składników: name + amount + unit + opcjonalnie section (nagłówek grupy) | FR-006, FR-009 | `src/lib/ingredients.ts:9` (type `Ingredient`) |
| **Brama jakości** (Usability gate) | Reguła blokująca zapis przepisów bez treści (title OK, ale puste ingredients lub steps) | PRD Business Logic (implicit) | `src/lib/content-quality.ts:37` (`isExtractedRecipeUsable`) |
| **Ponowienie** (Retry) | Ręczne lub automatyczne (Inngest: 3 próby) ponowienie ekstrakcji po niepowodzeniu | FR-012 | `src/inngest/functions.ts:7` (retries: 3), `src/app/(authenticated)/recipes/retry-action.ts` |

---

## 2. Klasyfikacja subdomen

| Subdomena | Klasa | Uzasadnienie |
|-----------|-------|--------------|
| **Ekstrakcja i archiwizacja przepisu** | Core | To jest wyróżnik produktu — "archive-first". Nikt inny nie robi tego gestem udostępnij→kopia. Bezpośrednio realizuje PRD Business Logic. |
| **Przeglądanie i wyszukiwanie kolekcji** | Core | Drugi wymiar wartości — bez wyszukiwania kolekcja jest bezużyteczna w czasie (Gwiazda Północna roadmapy). |
| **Obsługa błędów i retry** | Supporting | Utwardza pipeline, ale nie odróżnia produktu. Każda aplikacja async potrzebuje mechanizmu retry i powiadomień. |
| **Uwierzytelnianie (magic-link + RLS)** | Generic | Standard Supabase auth; brak logiki domenowej poza izolacją per-użytkownik. Realizuje FR-001, Access Control. |
| **Brama rejestracji (invite code)** | Generic | Prosta guard przed nieautoryzowaną rejestracją; czysta infrastruktura. |
| **PWA / Web Share Target** | Generic | Standardowy mechanizm platformowy (manifest.json); zero logiki domenowej. |

---

## 3. Kandydaci na Agregaty

### Agregat A: `Przepis` (Recipe)

**Granica:** wiersz `recipes` + powiązane `recipe_images` w Supabase Storage.

**Inwarianty (muszą być zawsze prawdziwe):**

| # | Inwariant | Skąd | Czy egzekwowany? |
|---|-----------|------|-----------------|
| A1 | Przepis należy do dokładnie jednego użytkownika | PRD Access Control | Tak — RLS `auth.uid()` + kolumna `user_id NOT NULL` |
| A2 | Przepis jest identyfikowany unikalnym slugiem per użytkownik | — | Tak — DB constraint `recipes_user_id_slug_key` |
| A3 | Jeden URL źródłowy daje jeden przepis per użytkownik (dedup) | FR-003 implicit | Częściowo — DB constraint `recipes_user_source_url_uniq` + `findExistingRecipeForUrl`; ale constraint jest obchodzone przez gap-fill path (`run-extract-recipe.ts:303`) |
| A4 | Przepis **musi** zawierać tytuł + składniki (≥1) + kroki (≥1) | Business Logic | Częściowo — `isExtractedRecipeUsable` w `content-quality.ts:37`; jednak walidacja nie chroni `force refresh` path (brak jej w `run-extract-recipe.ts:214`) — **luka** |
| A5 | Kategoria pochodzi z fixed taxonomy (8 wartości) | FR-008 | Tak — DB enum `recipe_category`; ale wartość pochodzi z LLM i nie jest walidowana przed insertem w kodzie TS |
| A6 | Zdjęcie powinno być archiwalne (Storage URL), nie zewnętrznym linkiem | FR-006, Guardrail | Nie — archiwizacja best-effort; `image_url` może wskazywać na zewnętrzny URL gdy `archiveImage` zawiedzie (`run-extract-recipe.ts:288-293`) |

### Agregat B: `Udostępnienie` (RecipeShare)

**Granica:** wiersz `recipe_shares`.

**Inwarianty:**

| # | Inwariant | Skąd | Czy egzekwowany? |
|---|-----------|------|-----------------|
| B1 | Status przechodzi tylko przez `pending → completed` lub `pending → failed` | FR-003, FR-012 | Częściowo — check `status !== 'failed'` w `retry-action.ts:30`; brak state-machine jako obiektu |
| B2 | Po zakończeniu ekstrakcji `recipe_id` musi być ustawiony (jeśli status = completed) | — | Nie — brak constraint NOT NULL na `recipe_id` gdy `status = 'completed'`; możliwy stan `completed` z `recipe_id = null` |
| B3 | Liczba prób (`attempts`) jest ograniczona do 3 | FR-012 | Częściowo — Inngest `retries: 3` kontroluje liczbę automatycznych prób; `attempts` w tabeli **nie jest inkrementowany** przez retry-action (`retry-action.ts` nie aktualizuje pola `attempts`) |

---

## 4. Rozbieżności Model-Kod (5 najważniejszych)

### D1 — Kategoria "Wegetariańskie" zastąpiona "Sałatki"
**PRD mówi:** FR-008 wymienia 8 kategorii: `Obiady, Zupy, Desery, Śniadania, Przekąski, **Wegetariańskie**, Napoje, Inne`  
**Kod robi:** enum `recipe_category` ma `salatki` (sałatki) zamiast `wegetarianskie` (wegetariańskie) — `supabase.types.ts:163-171`  
**Impakt:** przepisy wegetariańskie nie mają dedykowanej kategorii; LLM może je klasyfikować jako `inne` lub `przekaski`.

### D2 — Pole `attempts` nie jest aktualizowane przy ręcznym retry
**PRD mówi:** FR-012 — bounded retry max 3  
**Kod robi:** `retry-action.ts` resetuje `status = 'pending'` ale nie inkrementuje `attempts`; pole `attempts` ma wartość `0` po `attempts: 0` przy insercie (`share/actions.ts:49`) i nigdy nie rośnie w wyniku ręcznego ponowienia  
**Impakt:** niemożliwe egzekwowanie reguły "max 3 próby" przez `attempts`; ochrona leży wyłącznie w Inngest `retries: 3` (automatyczne), a ręczne ponowienie jest nieograniczone.

### D3 — `facebook_reel` w schemacie, ale niedostępne przez UI
**PRD mówi:** Facebook Reels jest zarchiwizowane do V2 (parked w roadmapie)  
**Kod robi:** enum `recipe_source` ma wartość `facebook_reel` (`supabase.types.ts:177`); `detectSourceType` nigdy jej nie zwraca (`detect-source-type.ts:3-17` — tylko `facebook_text | web_blog | youtube`); `ExtractRecipeEvent.sourceType` (`run-extract-recipe.ts:16`) nie obejmuje `facebook_reel`  
**Impakt:** martwy kod w schemacie; ryzyko nieoczekiwanego przyszłego użycia bez odpowiedniej logiki.

### D4 — Inwariant "usable recipe" nie chroni ścieżki force refresh
**PRD mówi:** Business Logic — przepis musi mieć tytuł, składniki, kroki  
**Kod robi:** `isExtractedRecipeUsable` (`content-quality.ts:37`) jest wywoływany po normalnej ekstrakcji (`run-extract-recipe.ts:206`); przy `forceRefresh = true` sprawdzenie jest POMINIĘTE (`run-extract-recipe.ts:214` — blok `if (forceRefresh)` zaczyna się przed sprawdzeniem usability) — **wniosek** (ścieżka `force refresh` może nadpisać dobry przepis przepisem bez składników)

### D5 — Wyszukiwanie składników w JS, nie w SQL
**PRD mówi:** FR-013 — filtrowanie po tytule i składniku  
**Kod robi:** `matchesQuery` w `recipes/page.tsx:27` filtruje po stronie serwera w TypeScript na pobranych wierszach; komentarz (`page.tsx:25`) tłumaczy: "PostgREST cannot ILIKE a jsonb column"  
**Impakt:** wyszukiwanie nie skaluje powyżej ~100-200 przepisów; roadmapa (S-05) opisuje problem i planuje GIN index + SQL, ale nie jest jeszcze wdrożone.

---

## 5. Ranking refaktoryzacji

Scoring: wartość domenowa (1-3) × luka egzekwowania (1-3) = priorytet.

| # | Kandydat | Wartość domenowa | Luka egzekwowania | Score | Uzasadnienie |
|---|----------|-----------------|-------------------|-------|--------------|
| **1** | **Egzekwowanie inwariantu A4 (przepis musi mieć treść) na wszystkich ścieżkach** | 3 — core business rule "archive-first" | 3 — brak ochrony na force refresh + brak DB-level constraint | **9** | Aktywna luka: `force refresh` może nadpisać dobry przepis pustym. Naprawia D4. |
| **2** | **Izolacja typów Supabase od warstwy UI/aplikacji (ACL)** | 2 — nie niszczy funkcji, ale wiąże UI ze schematem DB | 3 — `Database` importowane bezpośrednio w 4+ plikach UI (`page.tsx`, `recipes-content.tsx`, `[slug]/page.tsx`, `recipe-categories.ts`) | **6** | Każda migracja schematu wymaga zmian w komponentach UI; brak możliwości ewolucji niezależnej. |
| **3** | **State machine dla RecipeShare z wymuszonym invariantem B2** | 2 — ważne dla spójności danych (NFR "żadne żądanie nie ginie cicho") | 2 — brak DB constraint na `recipe_id NOT NULL` gdy `completed`; `attempts` nie odzwierciedla rzeczywistości | **4** | `recipe_shares` może mieć `status = 'completed'` z `recipe_id = null`. Wymaga migracji schematu. |
