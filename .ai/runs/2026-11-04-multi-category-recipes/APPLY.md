# Issue #689 (slice 1) — przepisy w wielu kategoriach — zastosowanie przez Management API

Migracja: `supabase/migrations/20261104100000_recipe_extra_categories.sql`
Rehearsal: `.ai/qa/issue-689-rehearse-extra-categories.sql`
Spec: `.ai/specs/2026-11-04-multi-category-recipes.md` (PR #690)

Co robi (wszystko addytywne, idempotentne):

- `recipes.extra_categories recipe_category[]` (domyślnie `{}`) + `recipes.taxonomy_locked_at timestamptz`,
  CHECK `recipes_extra_categories_valid` (najwyżej 2, bez NULL, bez powtórzeń, bez kategorii głównej),
  indeks GIN.
- `public_recipes`: jedna nowa OSTATNIA kolumna `extra_categories` (strzeżone odtworzenie widoku;
  filtr `hidden_at is null` zostaje; `assert_public_view_boundary()` uruchamia się w migracji).
  `taxonomy_locked_at` NIE jest wystawione.
- `category_tag_facets`, `recipe_category_context`, `admin_usage_summary_as`: kategoria = główna LUB dodatkowa.
- `search_recipes`: zwraca też `extra_categories` (zmiana typu zwracanego → `drop function` + `create`
  w tej samej transakcji).
- `admin_set_taxonomy_as` / `admin_set_taxonomy`: nowy ostatni argument `p_extra_categories`
  (null = bez zmian, `{}` = wyczyść); każda ręczna zmiana ustawia `taxonomy_locked_at`. Stare
  sygnatury są usuwane (PostgREST nie wybrałby między dwiema).

**Kolejność:** zastosuj migrację PRZED zmergowaniem app-PR (ten, z którym ten runbook jedzie).
Stara wersja aplikacji działa na nowym schemacie bez zmian (kolumny/argumenty addytywne; stare
wywołanie `admin_set_taxonomy` z trzema argumentami też działa). Nowa wersja bez migracji psuje
listy kategorii (filtr po `extra_categories`) — dlatego migracja idzie pierwsza.
Po zmergowaniu: Workers Build z `master`, potem `pnpm smoke:prod`.

> Git Bash, nie PowerShell. Zmienne z katalogu worktree:

```bash
REF=wvrlgddgdddwmgzbvtij
TOKEN="C:/Users/spoko/www/zapiszprzepis/.sbp_token"
ENDPOINT="https://api.supabase.com/v1/projects/$REF/database/query"
```

## 1. Rehearsal (wszystko się cofa)

```bash
{ echo "begin;"; cat supabase/migrations/20261104100000_recipe_extra_categories.sql; cat .ai/qa/issue-689-rehearse-extra-categories.sql; } \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```

Oczekiwane (treść błędu, bo blok kończy się `raise` → rollback):

```
REHEARSAL_RESULT view_last[ok] primary_rejected[ok] three_rejected[ok] membership[ok] rpcs[ok] grants[ok]
```

Cokolwiek z `FAIL` — zatrzymaj się, nie aplikuj.

## 2. Zastosowanie (zapis)

```bash
cat supabase/migrations/20261104100000_recipe_extra_categories.sql \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```

Oczekiwane: `[]`. Migracja jest idempotentna.

## 3. Rejestracja wersji

```bash
echo "insert into supabase_migrations.schema_migrations (version, name) values ('20261104100000','recipe_extra_categories') on conflict (version) do nothing;" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```

## 4. Weryfikacja

Smoke widoku (gość czyta `public_recipes` z nową kolumną):

```bash
echo "select count(*) as visible, count(*) filter (where extra_categories <> '{}') as with_extras from public.public_recipes;" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```

Oczekiwane: `visible` = liczba widocznych przepisów, `with_extras` = 0 (dodatkowe kategorie dopiero wpisze admin
albo slice 2). Potem w panelu admina: otwórz przepis → „Dodatkowe kategorie” → zapisz jedną; sprawdź, że przepis
pojawia się na `/przepisy/{ta-kategoria}` i że licznik listy wzrósł o 1.

## 5. Rollback

Patrz „Down” na końcu migracji. Najpierw `drop view public.public_recipes`, potem odtworzenie starych definicji.
