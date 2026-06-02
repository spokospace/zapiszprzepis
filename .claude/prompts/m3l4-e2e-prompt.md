Dodajemy test E2E dla tego ryzyka z context/foundation/test-plan.md:
[id/tytuł ryzyka + krótki opis]

Punkt zaczepienia badawczego:
[odniesienie do fazy test-plan.md, zmiana folderu lub konkretny przepływ z planu wdrożenia]

Scenariusz biznesowy (jedno obserwowalne zachowanie, które musi pozostać prawdziwe po tym przepływie):
[co widzi użytkownik, co nie może się zepsuć — to staje się twoją asercją]

Prawdziwe granice (nie mockuj — ryzyko ukrywa się tutaj):
[uwierzytelnianie, routing, API, baza danych]

Mockowane granice (mockuj na warstwie sieciowej):
[zewnętrzne API, które są kosztowne lub niedeterministyczne]

Napisz test Playwrighta zgodnie ze wzorcami seed.spec.ts i zasadami E2E
w pliku zasad projektu.
Potwierdź wynik biznesowy, który zawiódłby, gdyby to ryzyko się zmaterializowało.
Wyjaśnij w jednym zdaniu, jaką regresję wyłapuje ten test.

---
Przykład (10xCards, test-plan.md Faza 6):
---

Dodajemy test E2E dla tego ryzyka z context/foundation/test-plan.md:
Ryzyko #1+#2: Wygenerowane fiszki są tracone po przeładowaniu strony — atomowy zapis
zapisuje karty do bazy danych, ale dane nie przetrwają pełnego przeładowania strony SSR.

Punkt zaczepienia badawczego:
test-plan.md Faza 6, scenariusz (a): "generowanie → przeglądanie → zapis pełnej ścieżki sukcesu
z OpenRouterem mockowanym na warstwie sieciowej, potwierdza atomowy zapis i stan talii
podczas przekazywania SSR↔island."

Scenariusz biznesowy (jedno obserwowalne zachowanie, które musi pozostać prawdziwe po tym przepływie):
Po wygenerowaniu fiszek, zaakceptowaniu szkiców i przeładowaniu strony, talia
i jej karty są nadal widoczne. Jeśli dane zostaną utracone, ten test musi zakończyć się niepowodzeniem.

Prawdziwe granice (nie mockuj — ryzyko ukrywa się tutaj):
Uwierzytelnianie (storageState), trasy API (/api/generate, /api/cards), baza danych Supabase,
renderowanie SSR po przeładowaniu.

Mockowane granice (mockuj na warstwie sieciowej):
OpenRouter API — zwraca prawidłową, zgodną ze schematem odpowiedź bez uderzania
w prawdziwy LLM.

Napisz test Playwrighta zgodnie ze wzorcami seed.spec.ts i zasadami E2E
w pliku zasad projektu.
Potwierdź wynik biznesowy, który zawiódłby, gdyby to ryzyko się zmaterializowało.
Wyjaśnij w jednym zdaniu, jaką regresję wyłapuje ten test.