# Wiele przepisów z jednego wpisu blogowego

> Status: **propozycja** (do akceptacji przed implementacją). Ryzyko: **wysokie** (zmiana schematu unikalności na produkcji, ekstrakcja, deduplikacja, odświeżanie). Zależy od `supabase/migrations/20261017110000_recipes_global_unique.sql` (globalna unikalność `source_url`, już na produkcji).

## 📝 TLDR

Wpis blogowy często zawiera kilka odrębnych przepisów (np. świąteczne menu, zestaw śniadaniowy, „5 szybkich obiadów”). Dziś pipeline zakłada jeden przepis na link, więc taki wpis trafia albo jako sklejony jeden przepis, albo z pominięciem reszty. Proponujemy: po wykryciu wielu przepisów na stronie zapisać każdy osobno; w pozostałych przypadkach zachować obecne zachowanie.

Przykład, który to uzasadnia: `https://slushna.by/belaruskaya-kuxnya-recepty-i-sakrety/` zawiera sałatkę z rzodkwi i smażaniki (z dwoma wariantami) oraz sekcję porad o gotowaniu ziemniaków. Porady nie są przepisem.

## ✅ Decyzje

- **D1 — Warianty jednego dania zostają w jednym wpisie.** Smażaniki z bulwą i z kiełbasą to jeden przepis z opisem wariantu (istniejąca obsługa `VariantNoteSibling` i notatek o wariantach). Osobny wpis powstaje dopiero dla innego dania.
- **D2 — Limit: 10 wpisów z jednego linku.** Strony-katalogi z większą liczbą odrzucamy z komunikatem, a z pierwszych 10 zapisujemy kompletne przepisy.
- **D3 — Każdy zapisany przepis liczy się do limitu przepisów użytkownika.** (Do potwierdzenia przez właściciela; przyjęte jako domyślne, bo jest konserwatywne.)
- **D4 — Brak sygnału strukturalnego nie wyklucza wielu przepisów.** Liczba bloków JSON-LD `Recipe` jest sygnałem pomocniczym. Decyzję podejmuje LLM na podstawie treści; JSON-LD ją tylko potwierdza.

## 📝 Problem

1. **Ekstrakcja zwraca jeden obiekt.** [src/inngest/run-extract-recipe.ts](../../src/inngest/run-extract-recipe.ts) parsuje odpowiedź jako `RecipeData` (linia ~691), a prompt opisuje jeden „PRIMARY recipe”.
2. **Klucz źródła jest globalnie unikalny.** `recipes_source_url_uniq` (migracja `20261017110000`) nie pozwala na drugi przepis z tym samym adresem, a dedup w kodzie zwraca istniejący wiersz.
3. **Odświeżanie i ponawianie działają na `source_url`** ([src/app/przepis/[slug]/refresh-action.ts](../../src/app/przepis/[slug]/refresh-action.ts), `src/app/(authenticated)/recipes/retry-action.ts`). Przy wielu przepisach z jednego adresu nie wiadomo, który odświeżyć.

## 📝 Proponowane rozwiązanie

### 1. Wykrywanie
- Przy pobieraniu strony liczymy bloki JSON-LD `@type: Recipe` (`src/lib/recipe-json-ld.ts`).
- Prompt ekstrakcji zawsze zwraca tablicę `recipes: [...]`. Reguły w prompcie: jedno danie = jeden wpis; sekcje jednego dania (np. „Podmłoda”, „Spód”) i warianty zostają w jednym wpisie; porady i sekcje „sekrety” nie są wpisami.
- Wynik: długość tablicy po walidacji. Jeden przepis = obecna ścieżka.

### 2. Ekstrakcja
- `parsed` staje się tablicą, a każdy wpis przechodzi przez istniejące `toIngredients`, `splitLlmSteps`, `toServings`, `toMinutes` i `isExtractedRecipeUsable`.
- Nieużywalne wpisy są pomijane. Jeśli żaden nie przejdzie, zwracamy dotychczasowy błąd.
- Wszystkie wpisy powstają z jednego wywołania LLM i jednego pobrania strony (bez ponownego pobierania per przepis).
- Limit D2 jest egzekwowany po walidacji (najpierw kompletne, potem reszta).

### 3. Klucz źródła w zapisie
- Nowa kolumna `source_key text null` (np. slug sekcji lub indeks w tablicy, zależnie od tego, co wybierzemy w fazie 1).
- Indeksy unikalności: `(source_url, source_key)` zamiast samego `source_url`. Dla wierszy bez `source_key` zachowujemy dzisiejszą regułę (`source_key is null` jako pojedynczy klucz), żeby stare linki nie zmieniły się.
- `source_url` pozostaje adresem strony (link „Z wpisu: …”).
- Deduplikacja po fingerprincie i po `sharedUrl` uwzględnia `source_key`, inaczej drugi przepis z tej samej strony zostanie uznany za duplikat pierwszego.

### 4. Odświeżanie, ponawianie, usuwanie
- Akcje działają na `id` wiersza, nie na `source_url`.
- Odświeżenie wielu przepisów z jednego wpisu odświeża tylko wybrany przepis; nie uruchamia ekstrakcji całego wpisu.

### 5. Obrazy
- Okładka: jeśli strona ma jedno og:image, każdy przepis dostaje ten sam, a w fazie 2 wybieramy zdjęcie najbliższe nagłówkowi sekcji (osobny spec, jeśli okaże się potrzebne).
- Zdjęcia kroków są już dopasowywane po URL, więc przenoszą się bez zmian.

### 6. UI
- Na stronie przepisu: „Z wpisu: {tytuł wpisu}” i blok „Inne przepisy z tego wpisu”.
- Komunikat po dodaniu: „Dodano N przepisów z jednego wpisu”, a w dzwonku zbiorczy wpis.

## 📝 Plan wdrożenia (fazy)

- **Faza 1 — ekstrakcja tablicy bez zmian w zapisie.** Prompt i parser zwracają tablicę; zapisujemy pierwszy wpis, a reszta idzie do logu. Testy: jeden przepis (regresja), dwa przepisy (parser), wariant w jednym wpisie.
- **Faza 2 — klucz źródła.** Migracja: kolumna `source_key`, nowe indeksy, dedup z kluczem. Zapis wszystkich wpisów. Testy: dwa wpisy z jednego adresu, duplikat w obrębie tego samego klucza.
- **Faza 3 — odświeżanie i ponawianie po `id`.** Zmiana akcji i wszystkich wywołań po `source_url`.
- **Faza 4 — UI.** Link „Z wpisu”, blok „Inne przepisy”, komunikat zbiorczy.
- **Faza 5 — limit i liczenie do limitu przepisów (D2, D3).**

Każda faza kończy się zielonym `pnpm typecheck`, `pnpm lint`, `pnpm test`. Migracje na produkcji stosujemy zgodnie z `docs/`/notatkami operacyjnymi (Management API, idempotentnie).

## ⚠️ Ryzyka

- **Koszt.** Jeden link zwraca N przepisów w jednym wywołaniu LLM, więc koszt rośnie głównie przez dłuższy wynik, nie przez nowe wywołania.
- **Fałszywe podziały.** LLM może rozbić jedno danie na dwa wpisy (np. ciasto i krem jako osobne przepisy). Reguła D1 i test na stronach-wzorcach to ograniczają.
- **Stare wiersze.** Wiersze bez `source_key` muszą zachować dzisiejsze zachowanie. Migracja nie może zmienić istniejących kluczy.
- **Produkcja.** Zmiana indeksu unikalności jest odwracalna tylko przy zachowaniu danych; przed zastosowaniem trzeba sprawdzić duplikaty po nowym kluczu.

## ❓ Otwarte pytania

- Czy `source_key` ma być slugiem sekcji (czytelny, ale może się zmienić przy edycji), czy indeksem w tablicy (stabilny przy ponownej ekstrakcji, ale zależny od kolejności)?
- Czy D3 (liczenie do limitu) ma zostać, czy liczymy cały wpis jako jedną pozycję?
- Czy strony-katalogi (np. „50 przepisów na…”) mają być odrzucane przy przekroczeniu D2, czy zapisywać pierwsze 10?
