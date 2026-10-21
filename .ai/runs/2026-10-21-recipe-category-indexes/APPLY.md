# Perf — indeksy na recipes(category, created_at) — zastosowanie przez Management API

Migracja: `supabase/migrations/20261021100000_recipes_category_created_indexes.sql`

Co robi: dokłada dwa indeksy do `public.recipes`, które dziś są seq-scanowane przy
każdym wejściu — lista kategorii, filtr tagów i blok „Podobne" (`category + order by
created_at desc, id desc`) oraz globalny feed „Ostatnio dodane" (`order by created_at
desc`). Tylko indeksy: nic nie zmienia w tabelach, widokach, RLS ani danych, jest
idempotentna (`if not exists`) i bezpieczna w dowolnej kolejności względem deployu —
aplikacji NIE trzeba wdrażać razem z nią.

> Uruchamiaj w **Git Bash**, nie w PowerShell. Metoda `jq -Rs … | curl --data-binary @-`
> wysyła zapytanie jako UTF‑8 na stdin (ta migracja jest czystym ASCII, ale trzymamy się
> sprawdzonej ścieżki).

Zmienne (ustaw raz w sesji Git Bash, z katalogu worktree):

```bash
REF=wvrlgddgdddwmgzbvtij
TOKEN="C:/Users/spoko/www/zapiszprzepis/.sbp_token"
ENDPOINT="https://api.supabase.com/v1/projects/$REF/database/query"
```

## 1. Zastosowanie migracji (zapis)

```bash
cat supabase/migrations/20261021100000_recipes_category_created_indexes.sql \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" \
      -H "Authorization: Bearer $(cat "$TOKEN")" \
      -H "Content-Type: application/json" \
      --data-binary @-
```

Oczekiwane: `[]` / brak błędu. Idempotentna — ponowne uruchomienie też jest bezpieczne.

## 2. Rejestracja wersji w `schema_migrations`

```bash
echo "insert into supabase_migrations.schema_migrations (version, name) values ('20261021100000','recipes_category_created_indexes') on conflict (version) do nothing;" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" \
      -H "Authorization: Bearer $(cat "$TOKEN")" \
      -H "Content-Type: application/json" \
      --data-binary @-
```

## 3. Weryfikacja — indeksy istnieją

```bash
echo "select indexname from pg_indexes where schemaname='public' and tablename='recipes' and indexname in ('recipes_category_created_idx','recipes_created_idx') order by indexname;" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" \
      -H "Authorization: Bearer $(cat "$TOKEN")" \
      -H "Content-Type: application/json" \
      --data-binary @-
```

Oczekiwane: oba wiersze — `recipes_category_created_idx` i `recipes_created_idx`.

## 4. Weryfikacja — planer faktycznie ich używa (opcjonalnie)

Podmień `'obiady'` na dowolną niepustą kategorię. Szukamy `Index Scan using
recipes_category_created_idx` zamiast `Seq Scan` + `Sort`.

```bash
echo "explain select id, slug, title from public.recipes where category='obiady' order by created_at desc, id desc limit 24;" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" \
      -H "Authorization: Bearer $(cat "$TOKEN")" \
      -H "Content-Type: application/json" \
      --data-binary @-
```

> Uwaga: przy małej liczbie wierszy w kategorii planer może nadal wybrać Seq Scan (bo to
> tańsze) — to normalne. Zysk rośnie wraz z katalogiem; indeks jest wtedy gotowy.

## Rollback (gdyby trzeba)

```bash
echo "drop index if exists public.recipes_category_created_idx; drop index if exists public.recipes_created_idx;" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" \
      -H "Authorization: Bearer $(cat "$TOKEN")" \
      -H "Content-Type: application/json" \
      --data-binary @-
```

Plus `delete from supabase_migrations.schema_migrations where version='20261021100000';`
jeśli chcesz cofnąć też wpis wersji.
