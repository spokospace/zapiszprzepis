# Issue #444 — category_tag_facets RPC — zastosowanie przez Management API

Migracja: `supabase/migrations/20261021110000_category_tag_facets.sql`
Rehearsal: `.ai/qa/issue-444-rehearse-category-tag-facets.sql`

Co robi: dodaje `security invoker`, `stable` RPC `category_tag_facets(p_category, p_selected)`,
który agreguje liczniki tagów w Postgresie (czyta widok `public_recipes`) zamiast skanu `tags`
całej kategorii po stronie aplikacji. Tylko funkcja: nic nie zmienia w tabelach/widokach/RLS/danych,
idempotentna (`create or replace`).

> Git Bash, nie PowerShell. Zmienne ustaw raz z katalogu worktree:

```bash
REF=wvrlgddgdddwmgzbvtij
TOKEN="C:/Users/spoko/www/zapiszprzepis/.sbp_token"
ENDPOINT="https://api.supabase.com/v1/projects/$REF/database/query"
```

## 1. Rehearsal (próba na sucho — wszystko się cofa)

```bash
{ echo "begin;"; cat supabase/migrations/20261021110000_category_tag_facets.sql; cat .ai/qa/issue-444-rehearse-category-tag-facets.sql; } \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```

Oczekiwane (jako treść błędu `REHEARSAL_RESULT`, bo blok kończy się `raise` → rollback):

```
REHEARSAL_RESULT rows[ok] filter[ok] anon[ok] auth[ok] public[ok]
```

Jeśli któryś jest `FAIL:…` — zatrzymaj się, nie aplikuj.

## 2. Zastosowanie (zapis)

```bash
cat supabase/migrations/20261021110000_category_tag_facets.sql \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```

Oczekiwane: `[]`. Idempotentna.

## 3. Rejestracja wersji

```bash
echo "insert into supabase_migrations.schema_migrations (version, name) values ('20261021110000','category_tag_facets') on conflict (version) do nothing;" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```

## 4. Weryfikacja

```bash
echo "select p.proname, pg_get_function_identity_arguments(p.oid) as args, has_function_privilege('anon','public.category_tag_facets(public.recipe_category, text[])','execute') as anon_exec, has_function_privilege('authenticated','public.category_tag_facets(public.recipe_category, text[])','execute') as auth_exec from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='category_tag_facets';" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```

Oczekiwane: jeden wiersz, `args = p_category recipe_category, p_selected text[]`, `anon_exec=true`, `auth_exec=true`.

## Status

Zastosowane na produkcji 2026-10-21 (apply `[]`, zarejestrowane, zweryfikowane: `anon_exec=true`, `auth_exec=true`).

## Rollback

```bash
echo "drop function if exists public.category_tag_facets(public.recipe_category, text[]); delete from supabase_migrations.schema_migrations where version='20261021110000';" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```
