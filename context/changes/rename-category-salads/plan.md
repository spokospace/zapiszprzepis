# Rename category wegetarianskie → salatki — Implementation Plan

## Przegląd

Przemianowanie kategorii przepisów z `wegetarianskie` / Wegetariańskie na `salatki` / Sałatki.
Zmiana obejmuje: migrację PostgreSQL enum + aktualizację istniejących wierszy + 4 pliki TypeScript.

## Analiza stanu obecnego

Kategoria `wegetarianskie` jest **PostgreSQL native enum** (`recipe_category`), nie text ani CHECK constraint.
Zdefiniowana jest w 5 miejscach:

1. `supabase/migrations/20260607000000_recipe_schema.sql:14-23` — oryginalna definicja enum
2. `src/lib/supabase.types.ts:169` (union type) + `:315` (Constants array)
3. `src/lib/recipe-categories.ts:11` — value + label dla UI
4. `src/app/components/category-filter.tsx:23` — klucz `CATEGORY_ICONS`
5. `src/inngest/functions.ts:151` — prompt LLM do klasyfikacji

Brak seed pliku — istniejące przepisy z kategorią `wegetarianskie` to live dane w Supabase.

## Pożądany stan końcowy

- Enum PostgreSQL zawiera `salatki` zamiast `wegetarianskie`.
- Wszystkie istniejące przepisy z `category = 'wegetarianskie'` mają `category = 'salatki'`.
- UI wyświetla "Sałatki" zamiast "Wegetariańskie" w filtrach i na stronie szczegółów.
- LLM klasyfikuje przepisy do `salatki`, nie `wegetarianskie`.
- `npm run typecheck` i `npm run lint` przechodzą czysto.

## Czego NIE robimy

- Nie naprawiamy `recipe-card.tsx`, który renderuje raw slug jako badge (dotyczy wszystkich kategorii — osobna zmiana).
- Nie zmieniamy ikony (`Salad` z lucide pozostaje poprawna).
- Nie migrujemy innych kategorii.

## Podejście do implementacji

1. Nowa migracja SQL: `ALTER TYPE public.recipe_category RENAME VALUE 'wegetarianskie' TO 'salatki'` — dostępne od PostgreSQL 10, atomowe, nie wymaga rebuildu enum. Następnie `UPDATE` istniejących wierszy (paranojne zabezpieczenie; ALTER TYPE Rename nie rusza danych, ale warto być jawnym). Migracja stosowana przez Supabase CLI.
2. Aktualizacja TypeScript: 4 pliki, każdy to mechaniczne zastąpienie stringa.

---

## Faza 1: Migracja bazy danych

### Przegląd

Zmiana wartości enum w PostgreSQL i aktualizacja istniejących wierszy na produkcyjnym Supabase.

### Wymagane zmiany:

#### 1. Nowy plik migracji

**Plik**: `supabase/migrations/20260705000000_rename_category_salatki.sql`

**Cel**: Przemianowanie wartości enum i synchronizacja istniejących wierszy.

**Kontrakt**:
```sql
alter type public.recipe_category rename value 'wegetarianskie' to 'salatki';
update public.recipes set category = 'salatki' where category = 'wegetarianskie';
```

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- Migracja stosuje się bez błędów na zdalnym Supabase: `npx supabase db push`

#### Weryfikacja ręczna:

- W Supabase Dashboard → Table Editor: przepisy z dawną kategorią `wegetarianskie` mają teraz `salatki`
- Żadna istniejąca cecha aplikacji nie rzuca błędu 500 (enum constraint naruszony)

---

## Faza 2: Aktualizacja kodu TypeScript

### Przegląd

Mechaniczne zastąpienie stringa `wegetarianskie` na `salatki` (i etykiety `Wegetariańskie` na `Sałatki`) w 4 plikach TypeScript.

### Wymagane zmiany:

#### 1. Generated types

**Plik**: `src/lib/supabase.types.ts`

**Cel**: Union type i Constants array muszą odzwierciedlać nową wartość enum.

**Kontrakt**: Dwa miejsca:
- linia 169: `| "wegetarianskie"` → `| "salatki"`
- linia 315: `"wegetarianskie",` → `"salatki",`

#### 2. Kategorie UI

**Plik**: `src/lib/recipe-categories.ts`

**Cel**: Wartość i etykieta wyświetlana w filtrach i na stronie szczegółów przepisu.

**Kontrakt**: linia 11: `{ value: 'wegetarianskie', label: 'Wegetariańskie' }` → `{ value: 'salatki', label: 'Sałatki' }`

#### 3. Category filter — ikona

**Plik**: `src/app/components/category-filter.tsx`

**Cel**: Klucz `CATEGORY_ICONS` musi pasować do nowej wartości enum.

**Kontrakt**: linia 23: klucz `wegetarianskie:` → `salatki:`

#### 4. Inngest LLM prompt

**Plik**: `src/inngest/functions.ts`

**Cel**: Prompt wysyłany do LLM musi zawierać aktualną listę kategorii, inaczej LLM będzie klasyfikować do `wegetarianskie` i dostanie błąd enum constraint.

**Kontrakt**: linia 151: `wegetarianskie` → `salatki` w stringu prompt.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- TypeScript nie zgłasza błędów: `npm run typecheck`
- Lint przechodzi: `npm run lint`
- Grep nie zwraca wyników: `grep -r "wegetarianskie" src/`

#### Weryfikacja ręczna:

- Strona `/recipes` pokazuje chip "Sałatki" (nie "Wegetariańskie") w filtrach
- Kliknięcie "Sałatki" filtruje przepisy poprawnie (URL: `?category=salatki`)
- Strona szczegółów przepisu z tą kategorią wyświetla "Sałatki" w badge

---

## Strategia testowania

### Kroki testowania ręcznego:

1. Otwórz `/recipes` — sprawdź czy chip "Sałatki" pojawia się zamiast "Wegetariańskie"
2. Kliknij chip "Sałatki" — sprawdź URL `?category=salatki` i czy lista przepisów się filtruje
3. Wejdź w szczegóły przepisu z kategorią sałatki — sprawdź badge i link

## Referencje

- Oryginalna definicja enum: `supabase/migrations/20260607000000_recipe_schema.sql:14-23`
- Kategorie UI: `src/lib/recipe-categories.ts`
- Generated types: `src/lib/supabase.types.ts:163-171` i `:309-318`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany.

### Faza 1: Migracja bazy danych

#### Automatyczne

- [x] 1.1 Migracja stosuje się bez błędów: `npx supabase db push` — 9ba7c92

#### Ręczne

- [x] 1.2 Istniejące przepisy mają `category = 'salatki'` w Dashboard — 9ba7c92
- [x] 1.3 Aplikacja nie rzuca 500 po migracji — 9ba7c92

### Faza 2: Aktualizacja kodu TypeScript

#### Automatyczne

- [x] 2.1 `npm run typecheck` przechodzi — 701aba4
- [x] 2.2 `npm run lint` przechodzi — 701aba4
- [x] 2.3 `grep -r "wegetarianskie" src/` — brak wyników — 701aba4

#### Ręczne

- [ ] 2.4 Chip "Sałatki" widoczny w filtrach na `/recipes`
- [ ] 2.5 Filtrowanie po `?category=salatki` działa poprawnie
- [ ] 2.6 Badge na stronie szczegółów pokazuje "Sałatki"
