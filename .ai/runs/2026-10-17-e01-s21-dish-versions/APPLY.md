# E01-S21 Phase 1 — apply the migration + merge + deploy

**Kolejność jest ważna: migracja NAJPIERW, potem merge/deploy.** Po deployu ekstrakcja woła RPC `dish_vocabulary` przy każdym zapisie; jeśli migracja nie będzie zastosowana, RPC zwróci błąd (logowany), a klasyfikacja ruszy bez słownika (ryzyko synonimów). Strona przepisu RPC `dish_versions` i tak nie wywoła, dopóki `dish` jest null, więc od strony UI jest bezpiecznie w każdej kolejności — ale dla ekstrakcji migracja ma być pierwsza.

> Uruchamiaj w **Git Bash**, nie w PowerShell. Polskie znaki (`ł ó ą ś ż`, w tym `[A-ZĄĆĘŁŃÓŚŹŻ]` w CHECK) manglują się przez PowerShell/`jq --arg`; metoda `jq -Rs … | curl --data-binary @-` wysyła plik jako UTF‑8 na stdin i to jedyna pewna droga.

Zmienne (ustaw raz w sesji Git Bash, z katalogu worktree):

```bash
REF=wvrlgddgdddwmgzbvtij
TOKEN="C:/Users/spoko/www/zapiszprzepis/.sbp_token"
ENDPOINT="https://api.supabase.com/v1/projects/$REF/database/query"
```

## 1. Rehearsal (próba na sucho, wszystko się cofa — nic nie zapisuje)

```bash
{ echo "begin;"; cat supabase/migrations/20261017230000_recipe_dish_versions.sql; cat .ai/qa/s21-rehearse-dish-versions.sql; } \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" \
      -H "Authorization: Bearer $(cat "$TOKEN")" \
      -H "Content-Type: application/json" \
      --data-binary @-
```

Oczekiwane: w odpowiedzi (jako treść błędu `REHEARSAL_RESULT`, bo blok kończy się `raise exception` → `rollback`) wszystkie tokeny `[ok]`:

```
REHEARSAL_RESULT view_tail[ok] index[ok] versions_rows[ok] versions_order[ok] versions_total[ok] versions_no_self[ok] vocab[ok] anon_versions_grant[ok] anon_vocab_denied[ok] service_vocab_grant[ok] view_grant[ok] anon_call[ok]
```

Jeśli któryś jest `FAIL:…` — zatrzymaj się, nie aplikuj; pokaż mi wynik.

## 2. Zastosowanie migracji (zapis)

```bash
cat supabase/migrations/20261017230000_recipe_dish_versions.sql \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" \
      -H "Authorization: Bearer $(cat "$TOKEN")" \
      -H "Content-Type: application/json" \
      --data-binary @-
```

Oczekiwane: `[]` / brak błędu. Migracja jest idempotentna — ponowne uruchomienie też jest bezpieczne.

## 3. Rejestracja wersji w `schema_migrations`

```bash
echo "insert into supabase_migrations.schema_migrations (version, name) values ('20261017230000','recipe_dish_versions') on conflict (version) do nothing;" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" \
      -H "Authorization: Bearer $(cat "$TOKEN")" \
      -H "Content-Type: application/json" \
      --data-binary @-
```

## 4. Weryfikacja schematu (opcjonalnie)

```bash
echo "select string_agg(column_name,',' order by ordinal_position) as last3 from (select column_name, ordinal_position from information_schema.columns where table_schema='public' and table_name='public_recipes' order by ordinal_position desc limit 3) t; select has_function_privilege('anon','public.dish_versions(bigint)','execute') as anon_versions, has_function_privilege('anon','public.dish_vocabulary()','execute') as anon_vocab, has_function_privilege('service_role','public.dish_vocabulary()','execute') as service_vocab;" \
  | jq -Rs '{query: .}' \
  | curl -sS -X POST "$ENDPOINT" \
      -H "Authorization: Bearer $(cat "$TOKEN")" \
      -H "Content-Type: application/json" \
      --data-binary @-
```

Oczekiwane: `last3` zawiera `dish,dish_accusative,variant_note`; `anon_versions=true`, `anon_vocab=false`, `service_vocab=true`.

## 5. Merge PR #301

```bash
gh pr merge 301 --squash --repo spokospace/zapiszprzepis
```

(albo przez GitHub UI → Squash and merge). Nie wymaga review — to Twój własny PR, a self‑approval na GitHubie i tak jest niemożliwy.

## 6. Deploy

Deploy idzie **wyłącznie przez Workers Builds z `master`** (NIE GitHub Actions — minuty Actions są wyczerpane). Po merge build odpala się sam. Potwierdź w Cloudflare → Workers & Pages → (worker) → **Builds**, że build z commita merge’a przeszedł i jest `Active`. Nic ręcznie nie wdrażasz.

## 7. Weryfikacja na produkcji

- Dowolna strona przepisu wygląda **dokładnie jak dziś** (puste dane → bez paska, bez sekcji, bez wywołania `dish_versions`, „Podobne" bez zmian).
- Po dodaniu nowego przepisu (udostępnij link) jego wiersz dostanie `dish`/`variant_note`. Pasek i sekcja „Inne przepisy na {danie}" pojawią się dopiero, gdy **dwa** przepisy będą miały ten sam `dish`.
- Pełne zapełnienie katalogu + screenshoty z wersjami = **Faza 2 (#298)**, osobny recenzowany backfill.

## Rollback (gdyby trzeba)

Schemat (jednym `begin … commit`, żeby goście nie zobaczyli braku widoku): patrz nagłówek migracji — `drop function … dish_versions, dish_vocabulary; drop view public_recipes;` + odtworzenie z `20261017210000_author_gender_form.sql` (z `servings`) + granty; `drop index … recipes_dish_idx;`. Kolumny `dish*` należą do #298. App rollback wdróż pierwszy (inaczej ekstrakcja wstawia do usuniętych obiektów).
