# Plan: Phase 2 cache'u odczytów gościa (R2 + D1): analiza i plan wdrożenia

**Status:** plan do akceptacji właściciela · 2026-10-26
**Dotyczy:**
- #445 (Phase 1 kodu: #532, na `master`),
- spec i runbook w PR #529 (`.ai/specs/2026-10-25-cache-guest-reads*.md`),
- #545 (wolne odpowiedzi dla crawlerów spoza UE).

## TL;DR

- **Phase 2 działa.** Sprawdziłem ją na prawdziwym buildzie OpenNext 1.20.13 z lokalnym R2 i D1 (miniflare, kod z `master`, prawdziwa baza Supabase, tylko odczyty gościa). Przy trafieniu w cache zapytania do Supabase znikają: na stronie głównej z 3 do 0, a TTFB spada lokalnie z 1,2 s do 0,06 s.
- **Runbook w #529 trzeba poprawić w trzech miejscach.** Dwie poprawki są krytyczne:
  1. **Kolejka Durable Object jest zbędna.** Odświeżanie `unstable_cache` po upływie TTL robi sam Next (`pendingRevalidates` + `waitUntil`), nie kolejka OpenNext. Odpada więc DO, migracja, `WORKER_SELF_REFERENCE` i zmiany w `custom-worker.ts`. Zostają **tylko R2 i D1**.
  2. **Bez filtra miękkich tagów** każde `revalidatePath('/', 'layout')` czyści **cały** cache danych. Robią to akcje „ponów”, „odrzuć” i „oznacz powiadomienia”. Potwierdziłem to w eksperymencie. Poprawka: `withFilter({ tagCache: d1NextTagCache, filterFn: softTagFilter })`.
  3. **Z filtrem `populateCache` nie zakłada tabeli `revalidations` w D1**, bo rozpoznaje cache tagów po nazwie. Bez tabeli unieważnianie **po cichu nie działa**: odczyty przepuszczają, zapisy giną. Tabelę trzeba założyć raz, ręcznie. To też potwierdziłem w eksperymencie.
- **Przed włączeniem cache** worker Inngest musi unieważniać cache po dodaniu i odświeżeniu przepisu. Dziś tego nie robi, choć spec (Q4) to zakładał. Bez tego po „Odśwież” stara wersja przepisu byłaby widoczna do 120 s i jeszcze przy jednym wejściu (stale-while-revalidate).
- **Dwa ograniczenia zysku**, które trzeba znać przed decyzją:
  - **Klucz cache zawiera identyfikator buildu**, więc każdy deploy zaczyna z pustym cache. W tygodniu 22–25.10 było 7–17 deployów dziennie.
  - **Strona przepisu ma nadal 3–5 zapytań poza cache:** kontekst kategorii, wersje dania i „podobne przepisy”. Pierwszy bajt przychodzi szybko, ale pełne załadowanie dla crawlerów spoza UE poprawi się dopiero w etapie E.
- **Darmowy plan Cloudflare wystarcza.** R2 i D1 mieszczą się w limitach z dużym zapasem. Durable Objects nie są już potrzebne.

## 1. Co sprawdziłem i jak

| Źródło | Co |
|---|---|
| Kod źródłowy | `@opennextjs/cloudflare` 1.20.13, `@opennextjs/aws` 4.1.12, `next` 16.4.3 (`node_modules`): ścieżka `unstable_cache` → incremental cache → tag cache, obsługa błędów, `populateCache`, `withRegionalCache`, `withFilter`, DO queue |
| Kod aplikacji | ścieżka żądania gościa dla `/przepis/[slug]`, `/przepisy/[kategoria]`, `/`, `/u/[username]`; wszystkie wywołania `revalidateTag` i `revalidatePath` |
| Eksperyment lokalny | worktree z `master`, `open-next.config.ts` z R2 + D1, bindingi w `wrangler.jsonc`, logowanie każdego `fetch` Workera, `opennextjs-cloudflare build` + `preview` (miniflare: lokalne R2, D1, Cache API), TTL skrócony do 15 s na czas testu SWR |
| Produkcja | `curl` z US East (`IAD`/`EWR`) i nagłówki odpowiedzi, 2026-10-26 (patrz #545) |
| Dokumentacja Cloudflare | limity Workers, cenniki R2, D1 i DO, konfiguracja Workers Builds (2026-10-26) |

### Wyniki eksperymentu (strona główna `/`, gość, wszystkie odczyty objęte cache)

| Krok | Zapytania do Supabase | TTFB lokalnie | Wniosek |
|---|---|---|---|
| T1: pierwsze wejście | 3 | 1,23 s | miss: odczyt z Supabase i zapis do R2 |
| T2: drugie wejście | **0** | 0,09 s | trafienie w cache |
| T3: po upływie TTL | 3 w tle | **0,06 s** | stara wartość podana od razu, odświeżenie w tle bez kolejki DO |
| T4: kolejne wejście | 0 | 0,05 s | świeża wartość z cache |
| `revalidateTag('recipes:list', { expire: 0 })`, potem wejście | 3 | 0,44 s | unieważnienie działa (blokujący miss) |
| `revalidatePath('/', 'layout')` **bez filtra**, potem wejście | **3** | 0,76 s | ❌ cały cache wyczyszczony przez miękki tag |
| `revalidatePath('/', 'layout')` **z filtrem**, potem wejście | **0** | 0,06 s | ✅ filtr chroni cache |
| `revalidateTag` z filtrem, **bez tabeli D1** | 0 | 0,07 s | ❌ unieważnienie zginęło po cichu |
| `revalidateTag` z filtrem, z tabelą | 3 | 0,97 s | ✅ działa; w D1 wiersz `<buildId>/recipes:list` |

Inne strony przy drugim wejściu:
- **`/przepisy/obiady`:** zostało 1 zapytanie (`category_descriptions`, poza cache). TTFB 0,07 s.
- **`/przepis/lemoniada`:** TTFB 2,18 s → 0,05 s. Odczyt blokujący pierwszy bajt przychodzi z cache, ale 5 zapytań poza cache nadal idzie przy każdym wejściu i dociera strumieniem po pierwszym bajcie.
- **`/u/{username}`:** bez zmian, 4 zapytania, bo nic tu nie jest w cache.

Sprawdziłem też, że nic się nie psuje:
- `sitemap.xml`, `llms.txt`, strona 404 i alternatywy `.md` działają jak dotąd;
- user-agenty Googlebot i AhrefsBot dostają tę samą odpowiedź co przeglądarka (Next nie blokuje dla nich metadanych).

## 2. Ustalenia

### 2.1 Jak cache działa po włączeniu

- `unstable_cache` zapisuje wynik jako wpis typu FETCH w R2 pod kluczem `incremental-cache/<buildId>/<sha256>.fetch`.
- `withRegionalCache` (tryb `long-lived`) trzyma kopię w Cache API danej lokalizacji Cloudflare przez `revalidate`, czyli 120 s.
- Przy każdym odczycie, także trafieniu regionalnym, OpenNext pyta D1, czy któryś tag wpisu został unieważniony po jego zapisaniu. To jedno zapytanie `SELECT … IN (…)` na wywołanie.
- Po 120 s Next podaje starą wartość i odświeża ją w tle. Wpisy w R2 nie wygasają same, więc długi ogon stron (crawlery) dostaje szybko starą wersję, a nie miss. Warunek: od ostatniego deployu ktoś już wszedł na daną stronę.
- `revalidateTag(tag, { expire: 0 })` zapisuje w D1 wiersz `<buildId>/<tag>`. Następny odczyt to blokujący miss.

### 2.2 Kolejka Durable Object jest zbędna

- Kolejka (`queue.send`) obsługuje tylko strony ISR/SSG (`x-nextjs-cache: STALE`) i `enableCacheInterception`. Nasze trasy są w całości dynamiczne (czytają cookies), a odświeżanie `unstable_cache` idzie przez `workStore.pendingRevalidates` → `waitUntil`.
- Domyślna kolejka `dummy` jest akceptowana przez build.
- Test T3 potwierdza odświeżanie w tle bez kolejki.
- **Skutek:** nie trzeba Durable Object, migracji `new_sqlite_classes`, `WORKER_SELF_REFERENCE` ani eksportu z `custom-worker.ts`. Mniej zasobów i mniej sposobów na nieudany deploy.

### 2.3 Miękkie tagi czyszczą cały cache (krytyczne)

- `revalidatePath(path, …)` zapisuje miękki tag `_N_T_<path>`. Każdy wpis jest sprawdzany razem z miękkimi tagami swojej strony, a `_N_T_/layout` ma każda strona.
- Wywołania w kodzie:
  - `revalidatePath('/', 'layout')`: `(authenticated)/recipes/retry-action.ts` (4×), `dismiss-action.ts` (2×), `powiadomienia/actions.ts` (2×),
  - `revalidatePath('/')`: `settings/actions.ts`,
  - `revalidatePath('/ulubione')`: `favorites`, `share`, `add-recipe-action`.
- Bez filtra każde oznaczenie powiadomień jako przeczytanych wyczyściłoby cache wszystkim użytkownikom.
- **Poprawka:** `withFilter({ tagCache: d1NextTagCache, filterFn: softTagFilter })`. Jest to bezpieczne, bo w aplikacji nie ma stron ISR, które `revalidatePath` mogłoby odświeżać po stronie serwera. Odświeżenie widoku po Server Action działa w Next niezależnie od tag cache.

### 2.4 `withFilter` wyłącza zakładanie tabeli D1

- `populateCache` wybiera krok po nazwie cache tagów (`case D1_TAG_NAME`). Po owinięciu nazwa to `filtered-d1-next-mode-tag-cache`, więc krok „Creating D1 table” się nie wykonuje. Zaobserwowałem to w logu eksperymentu.
- Brak tabeli nie powoduje błędu 500:
  - odczyty łapią wyjątek i traktują wpis jako ważny,
  - zapis tagu łapie wyjątek i loguje „Failed to revalidate tag”,
  - efekt to cache bez unieważniania.
- **Poprawka:** właściciel zakłada tabelę raz (krok B4). Jest wspólna dla wszystkich buildów, bo identyfikator buildu jest w kluczu wiersza. Weryfikacja w kroku D3.
- Plus: z filtrem Workers Builds nie potrzebuje uprawnień do D1, bo `populateCache` w ogóle nie dotyka D1.

### 2.5 Każdy deploy zaczyna z pustym cache

- Build ID (`OPEN_NEXT_BUILD_ID`) jest w kluczach R2, Cache API i D1.
- Deploye `master`:
  - 22.10: 7,
  - 23.10: 15,
  - 24.10: 17,
  - 25.10: 10,
  - 19–21.10: 0.
- W intensywne dni cache żyje średnio 1–2 h, więc crawler wchodzący na rzadko odwiedzaną stronę zwykle trafi na miss, czyli na dzisiejszą prędkość.
- **Opcje:**
  - zaakceptować to;
  - rozgrzewać cache po deployu (etap F);
  - użyć stałego klucza (`deploymentId`). **Tego nie polecam:** po zmianie kodu cache mógłby podać dane w starym kształcie.
- Pliki R2 ze starych buildów zostają. Potrzebna jest reguła cyklu życia bucketu (krok B2).

### 2.6 Brakujące unieważnianie po dodaniu i odświeżeniu przepisu

- `revalidateRecipeCaches` jest wywoływane tylko w `api/recipes/delete/route.ts`. Worker Inngest (`src/inngest/run-extract-recipe.ts`) wstawia przepis, aktualizuje go przy odświeżeniu i uzupełnia luki bez żadnego unieważniania. Spec (Q4) to zakładał, ale #532 tego nie dowiózł.
- Skutki po włączeniu cache:
  - nowy przepis pojawia się na listach z opóźnieniem do 120 s, a po upływie TTL jeszcze przy jednym wejściu;
  - po „Odśwież” właściciel widzi starą treść;
  - jeśli ktoś wszedł na nieistniejący slug, który zaraz potem dostaje przepis, wynik `null` jest w cache i strona zwraca 404 do 120 s.
- **Poprawka:** etap A1.
- Inne zmiany danych publicznych (zmiana nazwy autora w ustawieniach, `gallery_count`, skrypty administracyjne) mieszczą się w zaakceptowanym budżecie 120 s.

### 2.7 Awaria D1 lub R2 nie psuje stron

- Każdy odczyt i zapis R2, D1 i regional cache jest w `try/catch`, a OpenNext przechodzi wtedy na odczyt z Supabase albo na wpis bez sprawdzenia tagów.
- Przekroczenie dziennego limitu D1 na darmowym planie oznacza tylko, że do północy UTC unieważnianie nie działa i obowiązuje 120 s TTL.
- Uwaga: wywołania D1 nie mają timeoutu, więc wolne D1 dodaje opóźnienie do każdej strony z cache.

### 2.8 Co zostaje poza cache (gość)

| Trasa | W cache po Phase 2 | Nadal z Supabase przy każdym wejściu |
|---|---|---|
| `/` | wszystko (3 zapytania, 2 poziomy) | — |
| `/przepisy/[kategoria]` | lista, liczniki tagów, suma | `category_descriptions` (metadane) |
| `/przepis/[slug]` | przepis (blokuje pierwszy bajt) | `recipe_category_context`, `dish_versions` (gdy przepis ma danie), „podobne przepisy” (2 listy + liczba); każdy prefetch Poprzedni/Następny to pełny render |
| `/u/[username]` | nic | `profiles`, `profile_gender_form`, podsumowanie, lista przepisów (≥ 4, 3 poziomy) |
| `.md`, `sitemap.xml`, `llms.txt` | nic (klient z cookies) | bez zmian; `.md` ma `s-maxage=3600` |

Dla gościa uwierzytelnianie nie robi zapytań sieciowych (`getUser()` bez ciasteczka kończy się lokalnie).

### 2.9 Limity darmowego planu (szacunek)

| Zasób | Limit Free | Szacunek po Phase 2 | Zapas |
|---|---|---|---|
| D1, odczyty wierszy | 5 mln/dzień | 1–3 zapytania na stronę; przy 20 tys. stron/dzień ≤ 120 tys. | ~40× |
| D1, zapisy | 100 tys./dzień | tylko `revalidateTag`: dziesiątki dziennie | ogromny |
| R2, klasa A (zapisy) | 1 mln/mies. | zapis przy missie lub odświeżeniu; nawet przy pełnym przejściu crawlera po każdym deployu ≤ ~300 tys./mies. | ~3× |
| R2, klasa B (odczyty) | 10 mln/mies. | ≤ 1 na wywołanie cache (plus leniwe odświeżenie kopii regionalnej) ≈ 2 mln/mies. | ~5× |
| R2, miejsce | 10 GB | ~10 MB na build × liczba buildów w oknie reguły cyklu życia; przy 14 dniach ≤ ~2 GB | ~5× |
| Subrequesty na żądanie | 50 (`fetch` + Cache API) | dziś ≤ ~8 `fetch` + ≤ 2 operacje Cache API na wywołanie cache | wystarcza; pilnować w etapie E |
| Durable Objects | — | nieużywane | — |

Ruch dzienny (20 tys. stron) to założenie. Do weryfikacji w panelu w kroku D5.

Uwaga poza zakresem: sporadyczne błędy `1102` (limit CPU, #464) wskazują raczej na plan Free (10 ms CPU). Cache ich nie usunie, bo koszt CPU to głównie render Reacta.

### 2.10 Korekty runbooka z #529

- Usunąć kroki dotyczące DO queue: binding `NEXT_CACHE_DO_QUEUE`, `migrations`, `WORKER_SELF_REFERENCE`, eksport `DOQueueHandler`.
- Dodać `withFilter(softTagFilter)` oraz ręczne założenie tabeli D1 z weryfikacją.
- „Smart Placement pomaga przy cold miss” jest nieaktualne. Pomiary w #464 i #545 pokazują `cf-placement: local-*`, bez zysku.
- Limit „3 MiB” jest nieaktualny. Według obecnej dokumentacji liczy się tylko rozmiar nieskompresowany, 64 MiB na obu planach.
- Dopisać: klucz z build ID (pusty cache po deployu), regułę cyklu życia R2 i lokalizację zasobów.

## 3. Plan wdrożenia

Kolejność ma znaczenie. Najpierw kod, który poprawia unieważnianie (bezpieczny, bo dziś cache jest atrapą), potem zasoby, a na końcu włączenie konfiguracji.

### Etap 0: decyzje właściciela (~15 min)

1. Potwierdzić Q3 w #529 w uproszczonej wersji: **R2 + D1, bez Durable Object**.
2. Sprawdzić plan konta (Workers & Pages → Plans). Free wystarcza (2.9).
3. Sprawdzić komendę deploy w Workers Builds (Settings → Builds). Oczekiwane: `pnpm exec opennextjs-cloudflare deploy`, albo `npx wrangler deploy`, które w wrangler 4.152 deleguje do OpenNext. Domyślny token Workers Builds ma „Workers R2 Storage: Edit”, czego wymaga `populateCache` dla R2. D1 nie jest potrzebne (2.4).
4. Zaakceptować pusty cache po każdym deployu albo zlecić etap F.

### Etap A: kod (agent, osobny PR, bezpieczny na dziś)

Na obecnej atrapie cache te zmiany nic nie zmieniają w działaniu produkcji. Przygotowują poprawne unieważnianie.

1. **A1.** W `src/inngest/run-extract-recipe.ts` wywołać `revalidateRecipeCaches(slug)` po udanym wstawieniu nowego przepisu, aktualizacji przy odświeżeniu i uzupełnieniu luk. Testy jednostkowe z mockiem `revalidateTag`. Do sprawdzenia przy implementacji: czy wywołanie leży w obrębie żądania `/api/inngest` (Route Handler), w którym `revalidateTag` ma kontekst Next.
2. **A2.** Zaktualizować komentarz w `src/lib/recipe-cache.ts:56-57`: atrapą jest także incremental cache, nie tylko tag cache.
3. **A3.** Zaktualizować spec i runbook w #529 według 2.10 albo zastąpić runbook tym planem.

Bramka: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

### Etap B: zasoby Cloudflare (właściciel, przed etapem C)

```bash
# B1 — bucket R2 na cache (lokalizacja: Europa, blisko Supabase i użytkowników)
npx wrangler r2 bucket create zapiszprzepis-inc-cache --location weur

# B2 — reguła cyklu życia: usuwa pliki starych buildów
#      (panel: R2 → zapiszprzepis-inc-cache → Settings → Object lifecycle rules:
#       prefix "incremental-cache/", delete after 14 days)

# B3 — baza D1 na tagi; zanotuj database_id (to nie sekret, trafi do wrangler.jsonc)
npx wrangler d1 create zapiszprzepis-tag-cache --location weur

# B4 — tabela (populateCache jej nie założy, patrz 2.4); idempotentne
npx wrangler d1 execute zapiszprzepis-tag-cache --remote --command \
  "CREATE TABLE IF NOT EXISTS revalidations (tag TEXT NOT NULL, revalidatedAt INTEGER NOT NULL, stale INTEGER, expire INTEGER default NULL, UNIQUE(tag) ON CONFLICT REPLACE);"
npx wrangler d1 execute zapiszprzepis-tag-cache --remote --command "SELECT count(*) FROM revalidations"   # → 0
```

Właściciel przekazuje agentowi `database_id`. Zasoby muszą istnieć **przed** merge etapu C (BACKWARD_COMPATIBILITY §6, CODE_REVIEW.md).

### Etap C: włączenie konfiguracji (agent przygotowuje PR, właściciel merguje przy obserwacji)

`wrangler.jsonc`: do istniejących `r2_buckets` dochodzi drugi wpis i nowa sekcja D1. Nic więcej.

```jsonc
"r2_buckets": [
  { "binding": "BACKUPS", "bucket_name": "zapiszprzepis-backups" },
  { "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "zapiszprzepis-inc-cache" }
],
"d1_databases": [
  { "binding": "NEXT_TAG_CACHE_D1", "database_name": "zapiszprzepis-tag-cache", "database_id": "<z B3>" }
]
```

`open-next.config.ts`:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache"
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache"
import { softTagFilter, withFilter } from "@opennextjs/cloudflare/overrides/tag-cache/tag-cache-filter"

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  // Soft tags (_N_T_…) out: revalidatePath('/', 'layout') must not wipe the data cache.
  // Side effect: populateCache no longer creates the D1 table — created once by hand (plan B4).
  tagCache: withFilter({ tagCache: d1NextTagCache, filterFn: softTagFilter }),
})
```

Konfiguracja jest identyczna z tą przetestowaną w eksperymencie.

- **Przed merge:**
  - bramka walidacyjna;
  - `pnpm cf-typegen`, jeśli typy bindingów tego wymagają;
  - lokalny `pnpm preview` z ręcznie założoną tabelą i powtórzenie testów T1–T4 oraz unieważniania (skrypt z eksperymentu da się dołączyć do PR jako `scripts/`).
- **Merge** w porze, gdy właściciel może obserwować build. Jeśli build padnie, na przykład na `populateCache` R2 z powodu tokenu, zostaje poprzednia wersja. Wtedy poprawić token i zrobić Retry.

### Etap D: weryfikacja na produkcji (agent + właściciel)

1. **D1.** Build `master` zielony, a w logu buildu „Populating remote R2 incremental cache… Successfully”. Potem `pnpm smoke:prod` ✓ (zasada z CLAUDE.md).
2. **D2. Trafienia.** Seria `curl` na `/`, `/przepisy/obiady` i 3 przepisy (z Polski i z US East): pierwsze wejście = miss, kolejne szybsze. W Workers Logs nie ma `[recipe-cache]` ani „Failed to revalidate tag”.
3. **D3. Unieważnianie.** Właściciel odświeża jeden swój przepis („Odśwież”, po etapie A1). Strona pokazuje nową wersję od razu, a w D1 widać wiersz:
   `wrangler d1 execute zapiszprzepis-tag-cache --remote --command "SELECT tag, revalidatedAt FROM revalidations ORDER BY revalidatedAt DESC LIMIT 5"`
   **Kont QA nie używamy do dodawania przepisów.**
4. **D4. Pomiar przed i po** (metoda z #225/#464: mediana z 10 prób, 3 typy stron, gość, Polska i US East). Wyniki w #445 i #545.
5. **D5. Obserwacja przez 48 h:** zużycie R2 i D1 w panelu wobec limitów (2.9), błędy w Workers Logs.

### Etap E (opcjonalnie, po D): reszta publicznych odczytów

Cel: pełny czas ładowania dla crawlerów spoza UE (#545).
- Objąć `unstable_cache` (120 s, tag `recipes:list`) te odczyty:
  - `recipe_category_context`,
  - `dish_versions`,
  - „podobne przepisy”,
  - `category_descriptions` (dłuższy TTL),
  - stronę profilu `/u/[username]` (nowy tag `profile:{username}`, unieważniany w `settings/actions.ts`).
- Wymaga osobnego krótkiego speca: klucze, tagi, test braku wycieku danych między użytkownikami. Pilnować limitu 50 subrequestów (2.9).

### Etap F (opcjonalnie): rozgrzewanie po deployu

- Skrypt `pnpm warm:prod`: pobiera adresy z `sitemap.xml` i otwiera je raz (około 700 żądań). Uruchamiany po `pnpm smoke:prod`.
- Zapełnia R2 globalnie; kopię regionalną tylko w lokalizacji, z której jest uruchomiony.
- Koszt: ~700 żądań Workera i ~3–4 tys. zapytań do Supabase na deploy.
- Ma sens dopiero, gdy D4 pokaże, że puste cache po deployu realnie szkodzi.

## 4. Wycofanie

- **Najszybciej:** Cloudflare → Workers & Pages → zapiszprzepis → Deployments → „Rollback” do poprzedniej wersji (bez buildu).
- **Trwale:** revert PR z etapu C, bo `open-next.config.ts` wraca do `defineCloudflareConfig({})`, czyli atrapy cache i dzisiejszego zachowania.
- Danych do migracji wstecz nie ma. Bucket R2 i baza D1 mogą zostać albo można je usunąć.
- Etap A można zostawić. Na atrapie cache nic nie robi.

## 5. Rejestr ryzyk

| # | Ryzyko | Skutek | Zabezpieczenie | Status |
|---|---|---|---|---|
| R1 | Miękkie tagi czyszczą cały cache | cache praktycznie nie działa przy aktywnych użytkownikach | `withFilter(softTagFilter)` | zweryfikowane lokalnie |
| R2 | Brak tabeli D1 po `withFilter` | unieważnianie po cichu nie działa | B4 + D3 | zweryfikowane lokalnie |
| R3 | Brak unieważniania w Inngest | stara treść po dodaniu lub odświeżeniu; 404 dla świeżego slugu | A1 + D3 | do wdrożenia |
| R4 | Pusty cache po każdym deployu | mniejszy zysk dla crawlerów w intensywne dni | akceptacja albo etap F | potwierdzone w kodzie |
| R5 | Awaria lub limit D1/R2 | brak unieważniania (do 120 s) albo miss; bez błędów 500 | try/catch w OpenNext | potwierdzone w kodzie i lokalnie |
| R6 | Deploy pada na `populateCache` R2 (token) | zostaje stara wersja | E0.3, obserwacja buildu, Retry | niezweryfikowane |
| R7 | Wyciek danych między użytkownikami | jeden użytkownik widzi dane drugiego | cache tylko publicznych danych (klient anon, testy z #532); serca, właściciel i menu poza cache | bez zmian względem Phase 1 |
| R8 | Wolne D1 (bez timeoutu) | wolniejsze trafienia | D1 w `weur`; pomiar w D4 | do obserwacji |
| R9 | Rosnące miejsce w R2 | przekroczenie 10 GB | B2 (cykl życia 14 dni) | do wdrożenia |

## 6. Decyzje dla właściciela

1. Zgoda na wariant **R2 + D1 bez Durable Object** (Q3 w #529).
2. Kto aktualizuje #529: agent wnosi poprawki z 2.10 do gałęzi `spec/cache-guest-reads`, czy ten plan zastępuje runbook.
3. Czy pusty cache po deployu jest akceptowalny (domyślnie tak, etap F później i tylko po pomiarze).
4. Czy po etapie D robimy etap E (zalecane dla #545).

## 7. Czego nie sprawdziłem

- Zachowania na prawdziwym Cloudflare: Cache API, lokalizacji D1 i R2 oraz realnych opóźnień z US East. Eksperyment działał na miniflare. Szacunki dla produkcji weryfikuje D4.
- Którą komendę deploy i jaki token ma dziś Workers Builds (E0.3).
- Czy `revalidateTag` w kroku Inngest ma kontekst Next na Workerze (A1, D3).
- Czy deploy z bindingiem D1 wymaga uprawnień D1 w tokenie Workers Builds. Sam `populateCache` ich nie wymaga.
- Liczby ruchu użytej w szacunkach limitów (2.9).
