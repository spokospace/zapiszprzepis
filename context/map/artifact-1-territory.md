# Artifact 1 — Territory Map (git history analysis)

> Generowany: 2026-07-06 | Zakres: cały dostępny git log (2026-05 – 2026-07, 218 commitów)

---

## Summary

Repozytorium ma zaledwie ~3 miesiące historii (pierwsze commity maj 2026), więc analiza pokrywa cały projekt od zera, a nie ostatni rok. Najbardziej aktywny obszar to pipeline ekstrakcji przepisów (`src/inngest/functions.ts` — 23 edycje, najczęściej zmieniany plik w projekcie), co wskazuje na ciągłe iteracje nad logiką AI-parsowania. Warstwa uwierzytelniania (`reset-password`, `forgot-password`, `login`) była intensywnie budowana w czerwcu, ale w lipcu się ustabilizowała. Współzmienność wskazuje, że `src/app/(authenticated)/recipes` i `src/app/components` to ściśle spleciona para (35 wspólnych commitów) — zmiany w widoku listy przepisów niemal zawsze ciągną za sobą modyfikację komponentów współdzielonych. Migracje Supabase pojawiają się punktowo, zawsze jako osobne commity wąsko powiązane z jedną funkcjonalnością. Plik `src/trigger/extract-recipe.ts` istniał i został usunięty — pipeline został przeniesiony z Trigger.dev do Inngest. `package.json` jest wspólnym mianownikiem z 43 unikalnymi partnerami zmian — typowe dla projektu we wczesnej fazie, gdzie każda funkcja dorzuca zależność.

---

## Top Active Areas

| Folder / Plik | Zmiany (commit-touches) | Uwagi |
|---|---|---|
| `src/inngest/functions.ts` | 23 | Najgorętszy plik; pipeline ekstrakcji AI |
| `src/app/(authenticated)/recipes/` | 43 (folder) | Główny widok aplikacji; `recipes-content.tsx` (17), `page.tsx` (11) |
| `src/lib/` | 53 (folder) | `env.ts` (7), `firecrawl.ts` (6), `supabase.types.ts` (4), `supabase/server.ts` (4) |
| `src/app/reset-password/` | 27 (folder) | Cały flow zbudowany od zera w czerwcu |
| `src/app/components/` | 27 (folder) | Współdzielone komponenty; `category-filter.tsx` (6), `add-recipe-form.tsx` (5) |
| `src/app/share/` | 14 (folder) | `actions.ts` (7), `route.ts` (6) — obsługa linku do przepisu |
| `src/app/page.tsx` | 11 | Strona główna; zmieniana przy każdej dużej funkcji |
| `src/app/login/` | 13 (folder) | Signin form + page |
| `supabase/migrations/` | 8 commitów | 8 migracji; każda powiązana z jedną funkcją |
| `src/middleware.ts` | 6 | Route guards; zmieniana przy każdej zmianie auth |

---

## Quarterly Trend

> Uwaga: historia projektu zaczyna się w maju 2026. Kolumny Q3–Q1 są puste (repo nie istniało).

| Obszar | Q3 2025 | Q4 2025 | Q1 2026 | Maj 2026 | Czerwiec 2026 | Lipiec 2026 |
|---|---|---|---|---|---|---|
| `src/inngest/` | — | — | — | 0 | 21 | 5 |
| `src/lib/` | — | — | — | 1 | 39 | 13 |
| `src/app/(authenticated)/recipes/` | — | — | — | 0 | 18 | 25 |
| `src/app/reset-password/` | — | — | — | 0 | 27 | 0 |
| `src/app/components/` | — | — | — | 0 | 10 | 17 |
| `src/app/share/` | — | — | — | 0 | 11 | 3 |
| `src/app/login/` | — | — | — | 4 | 7 | 2 |
| `supabase/migrations/` | — | — | — | 1 | 6 | 1 |
| `src/app/` (root) | — | — | — | 9 | 0 | 7 |

**Obserwacje trendów:**
- Maj 2026: scaffolding auth + Next.js routing (dominuje `src/app/` root i `src/app/login/`)
- Czerwiec 2026: eksplozja aktywności (149 commitów) — pipeline Inngest, reset-password, share, migracje DB, recipe detail
- Lipiec 2026 (pierwsze dni): przesunięcie ciężaru na `src/app/(authenticated)/recipes/` i `src/app/components/` — UI/UX dopracowanie i testy

---

## Co-change Signals

| Para | Liczba wspólnych commitów | Znaczenie |
|---|---|---|
| `src/app/(authenticated)` ↔ `src/app/components` | 35 | Najsilniejszy sygnał — widok listy i komponenty są ściśle sprzężone |
| `src/app/(authenticated)` ↔ `src/app/share` | 22 | Udostępnianie przepisu zmienia się razem z widokiem receptury |
| `src/app/forgot-password` ↔ `src/app/reset-password` | 21 | Dwa etapy jednego flow — słuszne sprzężenie |
| `src/app/(authenticated)` ↔ `src/lib/failed-shares.ts` | 10 | Obsługa błędów udostępniania widoczna w warstwie UI |
| `src/app/login` ↔ `src/app/reset-password` | 9 | Auth flow zmienia się jako całość |
| `src/app/login` ↔ `src/app/signup` | 9 | Rejestracja i logowanie współdzielą zmiany |
| `src/app/components` ↔ `src/app/page.tsx` | 7 | Strona główna korzysta z komponentów współdzielonych |
| `src/app/reset-password` ↔ `src/middleware.ts` | 6 | Zmiany auth flow wymagają aktualizacji route guard |
| `src/app/login` ↔ `src/lib/supabase` | 6 | Logowanie bezpośrednio wiąże się ze zmianami klienta Supabase |
| `src/inngest/functions.ts` ↔ `src/lib/firecrawl.ts` | 5 | Pipeline ekstrakcji i adapter Firecrawl ewoluują razem |

---

## Common Denominators

Pliki zmieniające się z największą liczbą unikalnych partnerów (sygnał: wspólny mianownik wielu funkcji):

| Plik | Unikalni partnerzy zmian | Rola |
|---|---|---|
| `package.json` | 43 | Każda nowa zależność; wczesna faza projektu |
| `src/app/page.tsx` | 29 | Strona główna agreguje linki do wszystkich funkcji |
| `src/app/(authenticated)/recipes/page.tsx` | 29 | Główny widok — centrum grawitacji UI |
| `src/inngest/functions.ts` | 28 | Centralny plik pipeline; zmiany w AI ekstrakcji rozchodzą się przez cały stack |
| `src/app/share/actions.ts` | 27 | Share flow — dotykany przy każdej zmianie modelu przepisu |
| `src/app/(authenticated)/recipes/[slug]/page.tsx` | 27 | Widok szczegółu receptury |
| `src/lib/supabase/server.ts` | 26 | Klient SSR — dotykany przy każdej nowej funkcji DB |
| `src/app/(authenticated)/recipes/recipes-content.tsx` | 25 | Komponent listy przepisów — serce UI |
| `src/app/share/route.ts` | 23 | Route handler udostępniania |
| `src/lib/env.ts` | 22 | Zmienne środowiskowe — rośnie przy każdej nowej integracji |

**Wniosek:** `src/inngest/functions.ts` jest architektonicznie najważniejszym plikiem — łączy warstwę UI (share, recipes) z zewnętrznymi serwisami (Firecrawl, OpenAI). Każda zmiana modelu danych lub integracji przez niego przechodzi.

---

## Unknowns

Do weryfikacji w Deep Focus:

1. **Trigger.dev → Inngest migration** — `src/trigger/extract-recipe.ts` został usunięty, ale czy wszystkie callsites zostały zaktualizowane? `trigger.config.ts` i `src/app/test-trigger/` też usunięte — czy nie ma resztek importów?
2. **`src/lib/failed-shares.ts`** — współzmienia się z `src/app/(authenticated)` w 10 commitach, ale nie pojawia się w top-zmienianych plikach. Jaka jest jego odpowiedzialność i czy nie jest kandydatem do przeniesienia do `inngest/`?
3. **`src/lib/supabase.types.ts`** — zmieniany 4x, ale jako plik generowany automatycznie (`supabase gen types`). Czy jest commitowany ręcznie czy przez CI? Ryzyko desynchronizacji ze schematem.
4. **`src/middleware.ts`** — 6 zmian, zmienia się przy auth i reset-password. Czy pokrywa wszystkie chronione route'y po ostatnich dodatkach (np. `/share`, API endpoints)?
5. **`e2e/`** — folder pojawił się w git, ale z tylko 3 touches. Co jest pokryte? Czy testy e2e są uruchamiane w CI?
6. **`src/app/share/`** — wysoka współzmienność (22 wspólnych commitów z `authenticated/`). Czy logika udostępniania jest odpowiednio odizolowana, czy splatała się z logiką widoku?
7. **Brak historii przed majem 2026** — analiza obejmuje tylko ~3 miesiące. Nie wiadomo, czy projekt miał wcześniejszą historię w innym repo.

---

*Źródła danych: `git log --since="12 months ago"`, `git diff-tree`, Python co-change pair analysis. Wszystkie liczby to commit-touches (ile razy plik/folder pojawił się w jakimkolwiek commicie), nie liczba zmienionych linii.*
