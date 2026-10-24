# Issue #464 item 2 — recipe_category_context RPC — zastosowanie przez Management API

Migracja: `supabase/migrations/20261024120000_recipe_category_context_rpc.sql`
Rehearsal: `.ai/qa/issue-464-rehearse-recipe-category-context.sql`

Co robi: dodaje `security invoker`, `stable` RPC `recipe_category_context(p_id)`, który zwraca
pozycję przepisu w kategorii (total, 1-based idx od najnowszych) oraz sąsiadów prev/next
`{slug,title}` w JEDNYM zapytaniu — zamiast czterech osobnych zapytań, które `loadCategoryContext`
robił na ścieżce krytycznej strony przepisu. Czyta tylko widok `public_recipes`. Tylko funkcja:
nic nie zmienia w tabelach/widokach/RLS/danych, idempotentna (`create or replace`).

**Kolejność deployu:** zastosuj migrację PRZED zmergowaniem app-PR (ten, z którym ten runbook jedzie). Do tego czasu funkcja
nie istnieje, więc `loadCategoryContext` loguje błąd i zwraca `null` — strona przepisu renderuje
się bez paska listy (istniejący fallback niekrytyczny), nic się nie psuje. Zastosowanie wcześniej
jest bezpieczne: nic innego nie odwołuje się do tej funkcji.

> Git Bash, nie PowerShell. Zmienne ustaw raz z katalogu worktree:

```bash
REF=wvrlgddgdddwmgzbvtij
TOKEN="C:/Users/spoko/www/zapiszprzepis/.sbp_token"
ENDPOINT="https://api.supabase.com/v1/projects/$REF/database/query"
```

## 1. Rehearsal (próba na sucho — wszystko się cofa)

```bash
{ echo "begin;"; cat supabase/migrations/20261024120000_recipe_category_context_rpc.sql; cat .ai/qa/issue-464-rehearse-recipe-category-context.sql; } \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```

Oczekiwane (jako treść błędu `REHEARSAL_RESULT`, bo blok kończy się `raise` → rollback):

```
REHEARSAL_RESULT mid[ok] first[ok] last[ok] missing[ok] grants[ok]
```

Jeśli któryś jest `FAIL:…` — zatrzymaj się, nie aplikuj.

## 2. Zastosowanie (zapis)

```bash
cat supabase/migrations/20261024120000_recipe_category_context_rpc.sql \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```

Oczekiwane: `[]`. Idempotentna.

## 3. Rejestracja wersji

```bash
echo "insert into supabase_migrations.schema_migrations (version, name) values ('20261024120000','recipe_category_context_rpc') on conflict (version) do nothing;" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```

## 4. Weryfikacja

```bash
echo "select p.proname, pg_get_function_identity_arguments(p.oid) as args, has_function_privilege('anon','public.recipe_category_context(bigint)','execute') as anon_exec, has_function_privilege('authenticated','public.recipe_category_context(bigint)','execute') as auth_exec from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='recipe_category_context';" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```

Oczekiwane: jeden wiersz, `args = p_id bigint`, `anon_exec=true`, `auth_exec=true`.

## Status

Zastosowane na produkcji 2026-10-24: apply `[]`, zarejestrowane (`20261024120000`), zweryfikowane
(`args = p_id bigint`, `provolatile = s`, `anon_exec=true`, `auth_exec=true`, `public_exec=false`).
Rehearsal wcześniej przeszedł (`mid/first/last/missing/grants [ok]`) i cofnął się; po apply
wywołanie na żywo dla przepisu w kategorii `ciasta` zwróciło poprawny wiersz
(`total=230, idx=3`, prev/next `{slug,title}`). App-PR jest teraz gotowy do mergu (funkcja już w DB).

## Rollback

```bash
echo "drop function if exists public.recipe_category_context(bigint); delete from supabase_migrations.schema_migrations where version='20261024120000';" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" -H "Authorization: Bearer $(cat "$TOKEN")" -H "Content-Type: application/json" --data-binary @-
```
