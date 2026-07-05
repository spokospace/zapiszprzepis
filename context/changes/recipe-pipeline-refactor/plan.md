---
title: Recipe Pipeline Refactor Plan
change-id: recipe-pipeline-refactor
created: 2026-07-06
status: planned
---

## Cel refaktoryzacji

Pipeline dodawania przepisu ma dwa aktywne błędy, które użytkownik widzi teraz: (1) fałszywy sukces przy awarii kolejkowania Inngest — mama klika "Udostępnij", widzi "Zapisałem", przepis nigdy nie pojawia się na liście; (2) `JSON.parse` bez try/catch w `run-extract-recipe.ts` powoduje 3 niepotrzebne retry za każdym razem gdy OpenAI opakowuje odpowiedź w code fence. Cel: naprawić oba te błędy przez minimalne, odwracalne zmiany w error handling — bez przebudowy architektury pipeline.

## Czego NIE robimy

- Nie wydzielamy `detectSource()` / `extractContent()` / `normalizeRecipe()` (chyba że Faza 3 zostanie wybrana jako opcjonalna)
- Nie wprowadzamy `ValidatedRecipeContent` Value Object (to należy do change-id: `02-invariant-aggregate-refactor`)
- Nie budujemy ACL dla typów Supabase (change-id: `03-anti-corruption-layer`)
- Nie naprawiamy R-4 (tracking params w URL) ani R-5 (duplicate pending shares przy refreshie)
- Nie dodajemy testów integracyjnych dla całego pipeline — tylko testy jednostkowe dla zmienianych ścieżek

## Fazy

### Faza 1: Guard — false-success w error handling (guard, nie przebudowa)

- **Co:** naprawić `share/actions.ts:70-84` i `add-recipe-action.ts:48-66` — gdy `inngest.send()` rzuca wyjątek, `triggerRecipeExtraction()` nie powinna zwracać wiadomości sukcesu; `addRecipeFromUrl` nie powinna redirectować do `/recipes?shared=1`
- **Test:** characterization test dla istniejącego zachowania najpierw (dokumentuje obecny błąd), następnie test weryfikujący poprawne zachowanie po naprawie
- **Weryfikacja:** unit test zielony; manualny test: submit złamanego URL z wyłączonym Inngest → użytkownik widzi błąd zamiast "Zapisałem"
- **Odwracalność:** pojedynczy commit, revert jednej funkcji

### Faza 2: Guard — JSON.parse bez try/catch w run-extract-recipe.ts

- **Co:** owinąć `JSON.parse(content)` w `run-extract-recipe.ts:197` w try/catch; wyciąć markdown code fence przed parsowaniem (strip ` ```json\n` prefix + ` ``` ` suffix); ustawić czytelny `error_message` przy SyntaxError zamiast opaque "Unexpected token"
- **Test:** unit test z mockiem OpenAI zwracającym JSON w code fence; unit test z malformed JSON (trailing comma)
- **Weryfikacja:** testy zielone; Inngest nie wykonuje 3 retry dla deterministycznie złego formatu odpowiedzi — błąd od razu z jasnym komunikatem
- **Odwracalność:** pojedynczy commit

### Faza 3 (opcjonalna): Wąski refaktor extract pipeline — wydzielenie faz

- **Co:** wydzielić 3 nazwane funkcje z `run-extract-recipe.ts`: `detectSource()`, `extractContent()`, `normalizeRecipe()` — każda niezależnie testowalna; monolityczna `runExtractRecipe` staje się orchestratorem wywołującym te funkcje
- **Strategia:** Branch by Abstraction — wrapper na każdą fazę, backward compatible; żadna zmiana zachowania
- **Weryfikacja:** te same testy przechodzą co przed wydzieleniem; każda z 3 funkcji ma własny unit test
- **Odwracalność:** osobny commit per funkcja

## Ranking odrzuconych opcji

- **Pełna migracja na domain model / agregat:** out of scope dla tego change-id — należy do `02-invariant-aggregate-refactor.md`; pipeline ma 3 miesiące i aktywnie rośnie, nie jest gotowy na pełne DDD
- **ACL dla typów Supabase:** osobny change-id (`03-anti-corruption-layer.md`); nie wpływa na błędy widoczne przez użytkownika
- **Naprawa R-4 (dedup tracking params):** niska wartość teraz — jeden użytkownik, ~100 przepisów; może trafić do backlogu S-05
- **DB-level constraint na `ingredients NOT EMPTY`:** długoterminowe zabezpieczenie, należy do fazy 4 w `02-invariant-aggregate-refactor.md`
