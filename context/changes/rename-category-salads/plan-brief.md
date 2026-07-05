# Rename category wegetarianskie → salatki — Krótki plan

> Pełny plan: `context/changes/rename-category-salads/plan.md`

## Co i dlaczego

Zamiana kategorii `wegetarianskie` / "Wegetariańskie" na `salatki` / "Sałatki" we wszystkich warstwach aplikacji.
Motywacja: trafniejszy opis treści — to co było oznaczone jako wegetariańskie to w praktyce sałatki.

## Punkt wyjścia

Kategoria `wegetarianskie` istnieje jako **PostgreSQL native enum** (`recipe_category`) — nie text column.
Obecna w: migracji SQL, generated types, warstwie UI, prompcie LLM.

## Pożądany stan końcowy

Filtr na `/recipes` pokazuje "Sałatki" zamiast "Wegetariańskie". Istniejące przepisy z tą kategorią są automatycznie przepisane na `salatki`. LLM klasyfikuje nowe przepisy do `salatki`. TypeScript kompiluje się bez błędów.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego |
|---|---|---|
| Slug enum | `salatki` (bez ł) | Spójny z resztą: obiady, zupy, sniadania — ASCII |
| Migracja enum | `ALTER TYPE RENAME VALUE` | Atomowe, PostgreSQL 10+, nie wymaga rebuildu tabeli |
| Istniejące wiersze | `UPDATE` w tej samej migracji | Paranojne zabezpieczenie — `RENAME VALUE` nie rusza danych, ale jawna synchronizacja |

## Zakres

**W zakresie:** enum SQL, generated types, recipe-categories, category-filter, inngest prompt, live dane

**Poza zakresem:** naprawa recipe-card badge (renderuje raw slug dla wszystkich kategorii — osobna zmiana)

## Architektura / Podejście

Dwufazowo: najpierw migracja DB (żeby enum był aktualny), potem mechaniczne find-replace w 4 plikach TS.
Kolejność faz jest obowiązkowa — TypeScript nie skompiluje się z `salatki` dopóki enum w DB/types nie jest zaktualizowany.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Migracja SQL | Enum `salatki` w DB + live dane przepisane | `npx supabase db push` musi mieć dostęp do produkcji |
| 2. Kod TS | 4 pliki zaktualizowane, typecheck + lint zielone | Pominięcie któregoś pliku → błąd runtime lub zły UX |

**Wymagania wstępne:** aktywna sesja `supabase` CLI z dostępem do produkcyjnego projektu

**Szacowany nakład pracy:** ~1 sesja, 2 fazy

## Otwarte ryzyka i założenia

- Jeśli jakiś przepis ma kategorię `wegetarianskie` w cache CDN / przeglądarce — może pokazać stary chip do odświeżenia; brak trwałego ryzyka.

## Kryteria sukcesu (podsumowanie)

- Chip "Sałatki" widoczny w filtrach na `/recipes`
- Filtrowanie `?category=salatki` zwraca poprawne przepisy
- `npm run typecheck` i `npm run lint` zielone
