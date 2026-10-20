---
title: Audyt kodu Zapisz Przepis
date: 2026-10-20
commit: e4ff4eb (master)
scope: repozytorium spokospace/zapiszprzepis (aplikacja, migracje, konfiguracja Workers, skrypty)
verdict: gotowe do obecnej skali (zamknięty krąg użytkowników) pod warunkami; niegotowe do publicznego wzrostu i płatności bez poprawek z priorytetu Wysoki
---

# Audyt kodu Zapisz Przepis

## 1. Executive Summary

Zapisz Przepis to dojrzały jak na rozmiar projektu kod (~32 tys. linii TS, 42 migracje), z wyraźnie przemyślanym bezpieczeństwem warstwy auth i bazy. Bramki walidacji przechodzą na czysto: `pnpm typecheck` ✅, `pnpm lint` 0 błędów (2 ostrzeżenia), `pnpm test` 1353/1353 ✅ w 120 plikach.

**Mocne strony**
- **Auth i przekierowania:** `getUser()` (nie `getSession()`) w middleware, `safeNext()` zamyka open-redirecty, `/auth/confirm` przez POST (skanery maili nie zużywają tokenu), reset hasła wylogowuje globalnie.
- **RLS włączone na każdej tabeli;** tabele serwisowe mają odebrane prawa `anon/authenticated`; wszystkie funkcje `SECURITY DEFINER` mają `set search_path` i jawne granty; widok `public_recipes` wystawia tylko allowlistę kolumn.
- **Reguły biznesowe egzekwowane w bazie, nie tylko w UI:** globalny dedup przez unikalne indeksy, bramka pełnego dostępu w `WITH CHECK` RLS, płeć „raz na zawsze” przez trigger, kody dostępu haszowane z rate limitem i advisory lockiem.
- **Brak XSS z treści LLM:** brak `dangerouslySetInnerHTML`/`ld+json`, React 19 blokuje `javascript:` w `href`.
- **Brak trackerów** (zero analityki/pikseli), fonty self-hosted, polityka prywatności wymienia procesorów i transfery.
- **Dobre testy czystej logiki** w `src/lib`, test reflow 320 px (WCAG 1.4.10).

**Krytyczne ryzyka (Top 8)**
1. **Właściciel przepisu może przez REST nadpisać dowolną kolumnę przepisu w globalnym katalogu** (treść, zdjęcia, `source_url`, slug) — defacement i „zaklepywanie” linków innych użytkowników.
2. **Next.js 16.3.4 z advisory critical/high** (RCE w `next/og` — dziś nieosiągalne; SSRF w Image Optimization; cache poisoning ISR) — naprawa = bump do ≥16.3.8.
3. **Kopia zapasowa jest niepełna, nietestowana i bez alertów** — obejmuje 2 tabele (bez `auth.users`, ulubionych, profili, dostępów, zdjęć), a to jedyna kopia danych (darmowy plan Supabase).
4. **Limit 10 slugów** — 11. przepis o tym samym tytule („Sernik”) nigdy się nie zapisze i spali 4× koszt Firecrawl+OpenAI.
5. **Service worker** — zepsuty fallback offline (`caches.match() || …`) i bezterminowe cache’owanie stron zalogowanego bez czyszczenia przy wylogowaniu.
6. **Polityka prywatności mija się z kodem w kwestii płci** — „Nigdy nie pokazujemy … płci”, a publiczna linijka „Dodała/Dodał” ją ujawnia.
7. **Ryzyko prawne praw autorskich** — publiczne, indeksowane kopie pełnych przepisów i zdjęć z cudzych stron.
8. **Brak obserwowalności i CI** — logi Workers nie są przechowywane, brak alertów (backup/keep-alive/pipeline), brak `.github/` — bramki uruchamiane wyłącznie ręcznie.

## 2. Scope & Methodology

**Zakres:** cały kod w repozytorium na `master@e4ff4eb`:
- `src/app` (App Router, Server Actions, route handlery), `src/lib`, `src/inngest`, `src/middleware.ts`;
- `supabase/migrations` (42 pliki), `supabase/config.toml`, szablony maili;
- `custom-worker.ts`, `wrangler.jsonc`, `next.config.ts`, `open-next.config.ts`, `public/sw.js`, `public/manifest.json`;
- `scripts/` (skrypty utrzymaniowe), `e2e/`, konfiguracja testów, dokumentacja procesu (README, SDLC, CLAUDE.md, `context/`).

**Poza zakresem:** produkcyjny dashboard Supabase i Cloudflare (ustawienia Auth, reguły strefy, lifecycle R2), testy penetracyjne na żywym środowisku, testy obciążeniowe, ręczne testy UI na urządzeniach.

| Metoda | Co zrobiono |
| --- | --- |
| Code review | Statyczny przegląd 4 obszarów równolegle (bezpieczeństwo, integralność danych, wydajność/niezawodność, jakość/zgodność); każde ustalenie o priorytecie Wysoki zweryfikowane ręcznie w kodzie |
| Testy funkcjonalne | `pnpm typecheck`, `pnpm lint`, `pnpm test` (Vitest), `playwright test --list` (44 testy e2e) |
| Walidacja danych | Przegląd schematu, constraintów, indeksów, triggerów, polityk RLS i ścieżek zapisu (pipeline Inngest, skrypty) pod kątem wyścigów, idempotencji i spójności |
| Ocena bezpieczeństwa | Auth/sesje, autoryzacja każdej akcji i route’a, RLS/`SECURITY DEFINER`, SSRF, XSS/prompt injection, sekrety w repo i historii git, nagłówki, rate limiting, `pnpm audit` |
| Profilowanie wydajności | Analiza statyczna: strategia renderowania/cache, liczba zapytań na widok, indeksy vs. zapytania, limity Workers Free, bundle klienta, service worker (bez pomiarów runtime) |
| Zgodność | RODO/ePrivacy (polityka vs. faktyczne przepływy danych, usuwanie konta, cookies, backupy), prawa konsumenta (płatności planowane), prawa autorskie i ToS platform, WCAG 2.2 AA (narzędzia) |

> **Uwaga o ASIC / KYC / AML:** to regulacje australijskiego rynku finansowego. Zapisz Przepis nie przetwarza płatności (w kodzie istnieje tylko wartość `'payment'` w `user_full_access.source` i komentarz „until payments exist”), nie jest instytucją obowiązaną i nie działa w Australii — **nie mają zastosowania**. Właściwe ramy to RODO, ePrivacy/Prawo telekomunikacyjne, ustawa o prawach konsumenta, DSA i prawo autorskie — te oceniono w §3f.

## 3. Detailed Findings by Area

Skala: **Wysoki** — realne ryzyko dla danych, użytkowników lub prawa; naprawić teraz. **Średni** — istotny dług/ryzyko; zaplanować. **Niski** — higiena.

### a. Architecture & Environment

**Stan:** Next.js 16 (App Router) → OpenNext → Cloudflare Workers (plan Free: 3 MiB skryptu, 10 ms CPU, 50 subrequestów), Supabase (Postgres + Auth + Storage, plan Free), Inngest (kolejka), Firecrawl/OpenAI/Exa. Cron w `custom-worker.ts`: backup do R2 + keep-alive. Świadome decyzje są udokumentowane w kodzie (np. `middleware.ts` zamiast `proxy.ts` z powodu limitu 3 MiB — `src/middleware.ts:1-9`).

| # | Wnios. | Ustalenie | Dowód |
| --- | --- | --- | --- |
| A1 | **Wysoki** | **Brak CI.** Brak katalogu `.github/`; typecheck/lint/test uruchamiane ręcznie przez agenta/człowieka. Build OpenNext (i limit 3 MiB) sprawdzany dopiero przez Workers Build na `master` — po merge’u. | `SDLC.md`, `.ai/agentic.config.json` |
| A2 | **Wysoki** | **Brak obserwowalności.** 123 wywołania `console.*`, brak bloku `observability` w `wrangler.jsonc`, brak `instrumentation.ts`/Sentry, brak health-checka i alertów. Awaria backupu lub keep-alive to linia logu, której nikt nie przechowuje. | `wrangler.jsonc`, `src/lib/worker-cron.ts` |
| A3 | Średni | **Pipeline Inngest to jedna funkcja bez `step.run`** (`retries: 3`, bez `concurrency`/`throttle`/`idempotency`/`onFailure`). Każdy retry płaci ponownie za Firecrawl+OpenAI; całość w jednym wywołaniu Workera zbliża się do limitu 50 subrequestów (archiwizacja do 13 zdjęć + scraping + LLM + DB). | `src/inngest/functions.ts:6-7` |
| A4 | Średni | **`runExtractRecipe` ma ~840 linii** (scrape, FB, Blogger, YouTube, dedup, LLM, etykiety, zapis); `recipe-image-archive.ts` (759) i `facebook.ts` (674) mieszają parsowanie z I/O. | `src/inngest/run-extract-recipe.ts:131-970` |
| A5 | Średni | **`next-pwa` 5.6.0 nic nie robi** — to plugin webpacka, a build idzie przez Turbopack (`turbopack: {}`); `public/sw.js` jest pisany ręcznie i commitowany. Pakiet wnosi tylko podatności łańcucha build (serialize-javascript, fast-uri, braces). Zmiana `pwa-serwist-migration` jest „parked”. | `next.config.ts:3-26`, `public/sw.js` |
| A6 | Średni | **Duplikacja logiki TS ↔ SQL:** normalizacja URL (`url-normalize.ts` vs `normalize_url`) i slugify (`slugify.ts` vs migracja `20260612000000`). Rozjazd złamie globalny dedup. Klient service-role kopiowany w 3 miejscach w `src` i 14 skryptach. | `src/lib/url-normalize.ts`, `src/inngest/functions.ts:9` |
| A7 | Niski | Konfiguracja nieaktualna: `compatibility_date: 2025-05-05`; `.nvmrc` 22.11 vs `@types/node ^20`, brak `engines`; `.env.local.example` wspomina Vercel i stary klucz JWT, pomija `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INNGEST_*`. | `wrangler.jsonc:5`, `.env.local.example` |
| A8 | Niski | Lokalny dev = produkcyjna baza (świadoma decyzja), ale e2e `add-recipe.spec.ts` („accepts valid URL”) zapisuje prawdziwy `recipe_shares` i odpala prawdziwy job Inngest przy każdym uruchomieniu. | `e2e/add-recipe.spec.ts` |

### b. Code Quality & Maintainability

| # | Wnios. | Ustalenie | Dowód |
| --- | --- | --- | --- |
| B1 | Średni | **Typy bazy są częściowe i niepodpięte.** `supabase.types.ts` zna tylko `recipes` i `recipe_shares` (bez kolumn `dish*`), brak `profiles`, `favorites`, `public_recipes`, RPC. Żaden klient nie jest tworzony z generykiem `<Database>` → wyniki zapytań są faktycznie nietypowane, literówka w kolumnie wychodzi dopiero w runtime. „Zero `any`” jest przez to mylące. | `src/lib/supabase.types.ts`, `src/lib/supabase/server.ts` |
| B2 | Średni | **Brak testów warstwy bazy** (pgTAP / `supabase test db`). RLS, `redeem_access_code`, `transfer_recipes_on_account_delete`, `profile_gender_form` testowane tylko przez mocki — a to tu powstałby wyciek danych. | brak `supabase/tests` |
| B3 | Średni | **Nieprzetestowany kod serwerowy:** `auth/callback`, `login/actions`, `signup/actions`, `reset-password/actions`, `witaj/actions`, `retry-action`, `dismiss-action`, `load-recipe`, `lib/supabase/proxy`. Testowane akcje mockują Supabase w całości (sprawdzają okablowanie, nie autoryzację). Vitest zbiera tylko `*.test.ts` — testy `.tsx` byłyby po cichu pomijane. | `vitest.config.ts:10` |
| B4 | Niski | **Martwy kod (knip):** `src/lib/supabase/client.ts` nieużywany, zależność `workbox-window` nieużywana, 31 nieużywanych eksportów (np. `findPublicRecipeBySourceUrl`, `Chip`, `SITE_URL`). `dotenv` importowany w `playwright.config.ts`, ale niezadeklarowany. | `package.json`, `playwright.config.ts:2` |
| B5 | Niski | **Nazewnictwo:** `package.json` → `"bootstrap-scaffold"`; literówka `getSuabaseServiceRoleKey` (`src/lib/env.ts:16`); `/recipes` (angielski) obok `/ulubione`, `/powiadomienia`; folder `src/app/favorites/` to tylko akcje, nie trasa. | — |
| B6 | Niski | **15 jednorazowych skryptów** backfill/collapse w `package.json`; większość robi `select` bez paginacji (cichy limit 1000 wierszy PostgREST — ID przepisów są już w 800+); `archive-recipe-images` i `refresh-recipe-times` bez dry-run, a przez nowy dedup są praktycznie no-opem, który wciąż kosztuje. | `scripts/` |
| B7 | Niski | Brak formatera (Prettier/Biome); 8 komentarzy `eslint-disable react-hooks/set-state-in-effect`; 2 ostrzeżenia lint (nieużywany `setFormEmail` w `src/app/login/signin-form.tsx:45`, zbędna dyrektywa w `public/sw.js:20`). | `eslint.config.mjs` |
| B8 | Niski | **Dokumentacja procesu się rozjeżdża:** CLAUDE.md miesza reguły projektu z wklejonym blokiem kursu „10xDevs”; SDLC.md wymaga QA/approvali, które CLAUDE.md uchyla; `test-plan.md` mówi „Vitest not yet configured” i wymienia nieistniejące bramki CI; ~22 foldery w `context/changes/` niezarchiwizowane; AGENTS.md to boilerplate. | `context/foundation/test-plan.md:67,80-83` |

### c. Data Integrity & Functional Accuracy

**Poprawnie obsłużone:** wyścig dwóch użytkowników dodających ten sam nowy URL kończy się na unikalnym indeksie i trafia do `linkToSaved` (przepis ląduje w Ulubionych drugiej osoby); dodanie istniejącego linku → Ulubione (idempotentnie, 23505 = sukces); „Ponów” zmienia `failed → pending` warunkowo (brak podwójnego dispatchu); przy usuwaniu konta przepisy ulubione przez innych przechodzą na najstarszą osobę z ulubionych.

| # | Wnios. | Ustalenie | Scenariusz awarii | Dowód |
| --- | --- | --- | --- | --- |
| C1 | **Wysoki** | **Sufit 10 slugów.** Slug jest globalnie unikalny (`recipes_slug_uniq`), pętla próbuje `slug`…`slug-10`. Etykietowanie zmienia w tytule tylko wielkość liter, więc popularne dania mają identyczne tytuły. | 10 różnych „Sernik” istnieje → 11. sernik: wszystkie inserty padają, Inngest powtarza całość 3× (Firecrawl + ~4 wywołania OpenAI), share kończy jako `failed` na zawsze. Problem rośnie z katalogiem. | `run-extract-recipe.ts:787-792` |
| C2 | **Wysoki** | **Backup nie odtworzy aplikacji.** `BACKUP_TABLES = ['recipes','recipe_shares']` — brak `auth.users`, `favorites`, `profiles(_private)`, `user_full_access`, `access_codes`, logów merge, zdjęć Storage. FK `recipes.user_id → auth.users` uniemożliwi restore do nowego projektu. Paginacja offsetem bez snapshotu; całość buforowana w pamięci jako jeden JSON; błędy tylko `console.error`, funkcja nigdy nie rzuca (cron wygląda na udany); retencja 90 dni zależy od reguły R2 spoza repo; restore nigdy nieprzećwiczony. | Utrata projektu Supabase = utrata kont, ulubionych, dostępów i zdjęć. | `src/lib/worker-cron.ts:12` |
| C3 | Średni | **Share może utknąć w `pending` na zawsze.** Brak stanu `processing`, sweepera, `onFailure`; końcowe update’y share ignorują błąd; `refresh-action` zostawia `pending`, gdy `inngest.send` rzuci. | Ubity Worker → `findExistingRecipeForUrl` zwraca `pending` dla tego URL bez końca, każde ponowne dodanie przekierowuje na `?duplicate=pending`, „Ponów” się nie pojawia. | `run-extract-recipe.ts:767-770,956-959`, `recipe-dedup.ts:79-84` |
| C4 | Średni | **Brak walidacji schematu odpowiedzi LLM.** Sprawdzane jest, że składniki to obiekty — nie, że `name` to string; czasy nie są koercowane do int. | `{"amount":"200"}` bez `name` → `Cannot read properties of undefined (reading 'trim')` w dzwonku po 4 płatnych próbach; `"15-20"` jako czas → terminalny błąd insertu. | `run-extract-recipe.ts:530-544` |
| C5 | Średni | **Scalanie na słabych heurystykach między użytkownikami.** ≥5 wspólnych nazw składników (dowolny tytuł) lub ten sam tytuł + podzbiór ≥3 → share trafia do cudzego przepisu, a jego `source_url` nie jest nigdzie zapisany. | Dwa różne blogi z naleśnikami {mąka, mleko, jajka, cukier, sól} → drugi link staje się ulubionym pierwszego; każde kolejne dodanie tego linku znowu płaci za ekstrakcję. | `recipe-dedup.ts:186-219` |
| C6 | Średni | **Retry pomija bramkę pełnego dostępu**, a `recipe_shares_owner_update` pozwala zmienić `shared_url`/`status`. Worker działa jako service role (omija RLS). | Użytkownik bez pełnego dostępu (lub po jego cofnięciu) PATCH-uje swój share na `failed` z dowolnym URL i klika „Ponów” → nowy przepis w katalogu; nieznormalizowany URL omija unikalny indeks. | `retry-action.ts` (brak `getFullAccess`), `20261017140000_full_access_gate.sql:241-245` |
| C7 | Średni | **Retry błędów, które nigdy się nie udadzą** (`FB_EMBED_REFUSED`, `LLM_UNREADABLE`, brak tytułu, C1) — 4× koszt. Share ustawiany na `failed` przed rethrow, więc użytkownik widzi błąd i „Ponów” równolegle z retry Inngest. | — | `run-extract-recipe.ts:962-971` |
| C8 | Niski | Luki normalizacji URL: `http`/`https`, `www.`, `m.`, parametry YouTube `si=`/`t=`/`feature=`, skracacze. `youtube_id` bez unikalnego indeksu. Pusty slug dla tytułu bez liter łacińskich/cyfr. | Duplikaty przepisów. | `src/lib/url-normalize.ts` |
| C9 | Niski | **Migracje danych w migracjach schematu** powiązane z ID produkcyjnymi (`20261016210100_split_desery_to_ciasta.sql` przenosi wszystko spoza listy ID; 113 KB UPDATE-ów w `…backfill_meta_description…`). Replay (restore, branch DB) przekategoryzuje nowe desery. | — | `supabase/migrations/` |
| C10 | Niski | Osierocone pliki Storage po kaskadzie usunięcia konta i po usunięciu przepisu przejętego od innej osoby (polityka Storage pozwala kasować tylko własny folder). | — | `api/recipes/delete/route.ts` |

### d. Security Assessment

**Brak podatności Critical możliwej do wykorzystania w kodzie aplikacji.** Szyfrowanie: TLS zapewnia Cloudflare/Supabase; dane w spoczynku szyfruje dostawca; kody dostępu przechowywane jako hash. Sekrety: skan drzewa i historii git znalazł tylko placeholdery; `wrangler.jsonc` zawiera wyłącznie klucz publishable i URL-e.

| # | Wnios. | Ustalenie | Scenariusz / wpływ | Naprawa | Dowód |
| --- | --- | --- | --- | --- | --- |
| D1 | **Wysoki** | **Właściciel może PATCH-ować dowolną kolumnę `recipes` i INSERT-ować wiersze** przez PostgREST (polityki `recipes_owner_insert/update` bez ograniczeń kolumn; aplikacja nigdy nie zapisuje `recipes` sesją użytkownika). | Użytkownik z pełnym dostępem + publiczny klucz + własny JWT: podmienia treść/zdjęcia przepisu ulubionego przez innych; „Oryginał” prowadzi na phishing; ustawia `source_url`/`youtube_id`/fingerprint na popularny link → kolejne osoby dodające ten link lądują na jego treści, a unikalny indeks blokuje prawdziwą ekstrakcję. | `revoke insert, update on public.recipes from authenticated` (zapisy i tak robi service role) lub trigger `before update` blokujący kolumny poza service role; CHECK `source_url ~ '^https?://'`. | `20261017140000_full_access_gate.sql:263-272` |
| D2 | **Wysoki** | **Next.js 16.3.4** — advisory: critical RCE w `next/og` (nieużywane → dziś nieosiągalne), high SSRF w Image Optimization (częściowo mityguje allowlista Supabase), moderate cache poisoning ISR/SSG i wyciek `use cache`. | Ryzyko rośnie z każdą nową funkcją (np. obrazy OG). | `next@^16.3.8` (aktualnie 16.4.2), `eslint-config-next` w parze. | `package.json` |
| D3 | Średni | **Brak nagłówków bezpieczeństwa** (CSP, `frame-ancestors`/X-Frame-Options, HSTS, Referrer-Policy, nosniff) — nigdzie w `next.config.ts`, middleware, workerze ani `_headers`. | Clickjacking formularzy (usuwanie przepisu, kod dostępu, ustawienia); brak ograniczenia skutków ewentualnego XSS, a cookies sesji Supabase SSR są czytelne z JS. | Ustawić w `custom-worker.ts` lub middleware; HSTS ewentualnie w strefie Cloudflare (zweryfikować). | grep: 0 trafień |
| D4 | Średni | **Brak limitu kosztu ekstrakcji per użytkownik** (OpenAI, Firecrawl) we wszystkich 4 punktach wejścia (`add-recipe-action`, `share/actions`, `refresh-action`, `retry-action`); retry bez bramki (C6). | Skrypt na jednym koncie z pełnym dostępem generuje nieograniczone koszty (każda runda ≤6 scrape’ów + duże wywołanie LLM × 4). | Binding `ratelimits` jak dla Exa (np. 20/h/użytkownik), `getFullAccess` w retry, kolumnowe granty UPDATE na `recipe_shares` (`read_at`, `cleared_at`). | `wrangler.jsonc` (jest tylko `EXA_SEARCH_LIMIT`) |
| D5 | Niski | **Dev login osiągalny z LAN:** `next dev` słucha na wszystkich interfejsach; przy `DEV_LOGIN_ENABLED=1` każdy w tej samej sieci dostaje sesję konta QA z pełnym dostępem na **produkcyjnej** bazie. Produkcja bezpieczna (`NODE_ENV` + flaga + potwierdzony mail). | — | Dodatkowo wymagać hosta loopback. | `src/lib/dev-login.ts:19-20` |
| D6 | Niski | **SSRF — niespójne guardy:** `isPrivateUrl` sprawdza tylko pierwszy URL (redirecty podążane automatycznie), pomija 100.64/10, 198.18/15, NAT64, DNS→prywatne IP; ścieżka Blogger bez sprawdzenia. Na Workers + `global_fetch_strictly_public` praktycznie zmitygowane. | Realne, gdyby ekstrakcja ruszyła na Node (lokalny dev + prod DB). | `redirect: 'manual'` + re-check na każdym skoku. | `src/lib/recipe-image-archive.ts:31-67,111`, `src/lib/blogger-feed.ts` |
| D7 | Niski | Odpowiedzi czytane bez limitu rozmiaru (`arrayBuffer()`/`.text()`); archiwizowane „obrazy” weryfikowane tylko po `Content-Type` (nie magic bytes) — hosting dowolnych plików w publicznym buckecie. | Self-DoS (128 MB pamięci Workera). | Licznik bajtów na strumieniu; sprawdzanie sygnatur JPEG/PNG/WebP. | `recipe-image-archive.ts:122-135` |
| D8 | Niski | Kod zaproszenia na `/signup` to nie granica bezpieczeństwa (porównanie `!==`, brak rate limitu, a publiczne GoTrue `/otp` i OAuth zakładają konta bez kodu) — prawdziwą bramką jest `has_full_access()`. Login zwraca odrębny błąd `no_account` (enumeracja kont); brak CAPTCHA → wyczerpanie projektowego limitu maili blokuje logowanie magic-linkiem wszystkim. | — | Usunąć kod zaproszenia albo traktować jako miękką bramkę; włączyć Turnstile w Supabase Auth; generyczny komunikat. | `src/app/signup/actions.ts:26`, `src/app/login/actions.ts` |
| D9 | Niski | Exa: limiter fails-open i surowy `err.message` do klienta; bucket `recipe-images` listowalny przez każdego; `profiles.display_name` bez CHECK w bazie (długość/podszywanie się pod „Zapisz Przepis”); route handlery (`/api/recipes/delete`, `/share`) bez sprawdzania `Origin` (mityguje SameSite=Lax). | — | Fail-closed w produkcji; usunąć politykę SELECT bucketu; CHECK; sprawdzanie Origin. | `src/lib/exa-rate-limit.ts`, `20260611160000_image_archive_storage.sql:19-22` |
| D10 | Do weryfikacji | Ustawienia produkcyjne poza repo: wymagane potwierdzenie e-maila (pre-account takeover przy logowaniu Google), „secure password change”, ochrona przed wyciekłymi hasłami, `INNGEST_DEV` nigdy nieustawione na Workerze, HSTS w strefie. | — | Sprawdzić w dashboardach. | `supabase/config.toml` (tylko lokalny) |

**Zależności (`pnpm audit --prod`): 72 podatności (2 critical, 38 high, 27 moderate, 5 low).** Większość to narzędzia build/dev:

| Pakiet | Ścieżka | Naprawa | Znaczenie |
| --- | --- | --- | --- |
| `next` 16.3.4 | bezpośrednia | ≥16.3.8 | **runtime** — D2 |
| `proxy-addr` (critical) | `@opennextjs/cloudflare > @opennextjs/aws > express` | bump `@opennextjs/cloudflare` (1.20.12) | ścieżka Node/AWS, raczej poza bundlem Workers |
| `@grpc/grpc-js`, `@opentelemetry/propagator-jaeger`, `brace-expansion` | `inngest > @opentelemetry/…` | bump `inngest` (4.25) | DoS, w bundlu Workera |
| `serialize-javascript`, `fast-uri` ×4, `braces` | `next-pwa > workbox/webpack` | **usunąć `next-pwa`** | build-time |
| `undici`, `sharp`, `form-data` | `wrangler > miniflare`, `@opennextjs/cloudflare` | bump `wrangler` / OpenNext | dev/build |

Health-check z 2026-07-04 (`context/foundation/health-check.md`) wskazywał 6 high; po 3,5 miesiąca jest ich 38 — zależności nie są aktualizowane systematycznie.

### e. Performance & Reliability

**Dobrze:** gość nie płaci za wywołanie Auth; root layout bez sesji; `cache()` dla `getCurrentUser`/`loadRecipe`; `Promise.all` w loaderach; „Podobne” i liczniki nagłówka streamowane przez `Suspense`; każdy zewnętrzny fetch ma `AbortSignal.timeout`; edge cache `/_next/image` z fallbackiem 302; brak web fontów; mały bundle klienta.

| # | Wnios. | Ustalenie | Dowód |
| --- | --- | --- | --- |
| E1 | **Wysoki** | **Service worker: zepsuty fallback offline.** `caches.match(req) \|\| caches.match('/') \|\| new Response(...)` — `caches.match` zwraca Promise (zawsze truthy), więc fallbacki nigdy nie działają; strona spoza cache → `respondWith(undefined)` → błąd sieci zamiast strony głównej/„Offline”. README obiecuje fallback i „30-day revalidate”, których nie ma. | `public/sw.js:94-95,135-137` |
| E2 | **Wysoki** | **SW cache’uje bezterminowo każdy GET 200**, w tym `/ulubione`, `/powiadomienia`, `/settings` i payloady RSC; cache nie jest czyszczony przy wylogowaniu i nie ma limitu wpisów. Prywatność na współdzielonym urządzeniu + nieograniczony wzrost storage. | `public/sw.js:122-139`, `src/app/(actions)/sign-out.ts` |
| E3 | Średni | SW: POST na `/api/*` trafia do gałęzi API (3 s timeout → błąd przy usuwaniu przepisu, `cache.put` na POST rzuca); `self.skipWaiting()` + `clients.claim()` przeczą zamierzonej strategii „bez wymuszonego przeładowania”; cache-first dla niehashowanych plików z `public/` w cache o stałej nazwie → ikony/logo nigdy się nie zaktualizują; udostępnienie offline (Web Share Target) przepada. SW nie ma testów. | `public/sw.js:25,42,74-97` |
| E4 | Średni | **Zero cache’owania danych publicznych.** Brak `revalidate`/`'use cache'`/`unstable_cache`; `AppShell` czyta `cookies()` (dynamiczne nawet strony prawne); `open-next.config.ts` pusty (brak incremental/tag cache). Widok przepisu dla gościa ≈ 8 zapytań do Supabase, dla zalogowanego ≈ 18 (w tym 3 × `count: 'exact'`). Boty i podglądy linków płacą to samo. | `open-next.config.ts`, `src/app/components/app-shell.tsx` |
| E5 | Średni | **Brak indeksów pod gorące zapytania:** filtr `category` + sort `created_at desc, id desc` (strony kategorii, kontekst kategorii, „Podobne”) i globalny feed „najnowsze” — są tylko indeksy `(user_id, created_at)`. Ten sam count kategorii liczony dwukrotnie. | `supabase/migrations/*` (brak indeksu na `category`/`created_at`) |
| E6 | Średni | **Dwa `getUser()` na żądanie zalogowanego** (middleware + `getCurrentUser`), wbrew własnej regule w `CODE_REVIEW.md`/`lessons.md`; ~50–100 ms na nawigację. `/powiadomienia` robi pełny `router.refresh()` co 10 s przez 5 min. | `src/lib/supabase/proxy.ts`, `src/lib/supabase/server.ts` |
| E7 | Średni | **Zapytania bez limitu ucinane po cichu na 1000 wierszach:** fasety tagów kategorii, chipy kategorii `/recipes`, `/ulubione` (bez paginacji, `.in('id', ids)` rośnie z liczbą ulubionych), `favoritedSourceUrls`, `loadFailedShares`. | `src/app/przepisy/[kategoria]/page.tsx`, `src/app/(authenticated)/ulubione/page.tsx` |
| E8 | Średni | **Backup na Workers Free:** wszystkie strony w jednej tablicy + jeden `JSON.stringify` — przy rosnącym JSONB wejdzie w limity CPU/pamięci; nigdy nie rzuca (cron „zielony” przy porażce). | `src/lib/worker-cron.ts` |
| E9 | Niski | Klucz cache obrazów zawiera cały query string — śmieciowe parametry mnożą transformacje IMAGES (spalanie limitu); osobny klucz `avif` bez `images.formats`. `LogoIcon` z `priority`, a ukryty poniżej `lg` (zbędny preload na mobile). Brak `not-found.tsx`. Search: słowa <3 znaków nie używają indeksu trigramowego (akceptowalne w obecnej skali). | `src/lib/image-cache.ts`, `src/app/components/brand-logo.tsx` |

### f. Compliance & Audit Trails

**Dobrze:** polityka prywatności jest ponadprzeciętna (procesorzy: Supabase, Cloudflare, Inngest, Firecrawl, OpenAI, Exa, wsrv.nl, Meta, Google; SCC; backupy 90 dni; podstawy prawne); brak analityki i pikseli → baner zgód niepotrzebny (tylko cookies niezbędne); YouTube przez `youtube-nocookie.com`; logi auth zawierają tylko `{code, status}`; nieudane próby kodu przechowywane bez wpisanego tekstu; strona `/usuwanie-danych` spełnia wymóg Facebook Login.

| # | Wnios. | Ustalenie | Dowód |
| --- | --- | --- | --- |
| F1 | **Wysoki** | **Polityka prywatności nieprawdziwa co do płci (RODO art. 5(1)(a), 13).** Tekst: „Nigdy nie pokazujemy innym: … ani płci”. `profile_gender_form()` jest dostępne dla `anon`, a publiczna linijka „Dodała/Dodał {nazwa}” na stronie przepisu i profilu przy dwóch wartościach (`female`/`male`) wprost ujawnia płeć. | `src/app/(legal)/polityka-prywatnosci/page.tsx:79-80`, `20261017210000_author_gender_form.sql:94-111`, `recipe-header.tsx` |
| F2 | **Wysoki** | **Prawa autorskie.** Pipeline publikuje pełne składniki i kroki oraz kopiuje zdjęcia źródła (galeria do 12 + okładka) do Storage na publicznych, indeksowanych `/przepis/{slug}` z canonical na zapiszprzepis.pl — strony konkurują ze źródłem w wyszukiwarce. Zdjęcia i proza kroków są utworami (pr. aut. art. 1). Ostatni commit (#362) planuje sitemapę i alternatywy Markdown „dla cytowalności przez AI”, co zwiększa ekspozycję. Mitygacje obecne: źródło + link, autor, odtwarzacz YouTube, przepisanie kroków przez LLM, klauzula takedown w regulaminie, `noindex` na `/szukaj`, `/dodaj`. | `src/lib/recipe-image-archive.ts`, `src/app/przepis/[slug]/page.tsx:43-46` |
| F3 | Średni | **Płeć obowiązkowa bez opcji „wolę nie podawać”** (middleware wymusza `/witaj`) na podstawie „umowy” — nie jest niezbędna do świadczenia usługi (minimalizacja, art. 5(1)(c)). | `src/middleware.ts:75-102` |
| F4 | Średni | **Dane osób trzecich z Facebooka:** imiona i nazwiska autorów postów w grupach (osoby prywatne) zapisywane w `source_author` i publikowane — bez informacji z art. 14 i kanału sprzeciwu poza ogólnym mailem. | `src/lib/facebook.ts:415`, `run-extract-recipe.ts:731,811` |
| F5 | Średni | **Brak samodzielnego usunięcia konta** — ręczny runbook 7 kroków (Storage, logi merge ręcznie); brak zapisu, że usunięcie nastąpiło (rozliczalność, art. 5(2)/17); runbook nie mówi, że restore z backupu musi ponownie zastosować usunięcia. | `docs/account-deletion.md` |
| F6 | Średni | **Brak audit trail dla działań administracyjnych** — 15 skryptów service-role zapisujących na produkcji i „609 przepisów poprawionych ręcznie” (CHANGELOG) bez logu zmian; `recipe_merge_log` obejmuje tylko scalenia. | `scripts/`, `CHANGELOG.md` |
| F7 | Średni | **ToS platform:** scraping Facebooka (plugin + parsowanie Relay HTML postów z grup) i prywatne API InnerTube YouTube do transkrypcji — naruszają warunki Meta/YouTube; Meta może cofnąć aplikację Facebook Login (logowanie użytkowników!). | `src/lib/facebook.ts:290-631`, `src/lib/youtube.ts:113` |
| F8 | Średni | **WCAG 2.2 AA bez automatycznej kontroli** — brak `@axe-core/playwright`; pilnowany tylko reflow 320 px i tokeny kolorów. | `e2e/`, `playwright.config.ts` |
| F9 | Niski | Polityka i regulamin obiecują „datę na górze”, której `LegalPage` nie renderuje; cookie `zp-gender` (id użytkownika) nieopisane w sekcji cookies; logi `/share` zapisują pełny udostępniony tekst (może zawierać dane osobowe), logi ekstrakcji — permalinki postów z grup FB; nadawca SMTP produkcji niewidoczny w repo (jeśli własny — dopisać do procesorów). | `src/app/components/legal-page.tsx`, `src/middleware.ts:95-101`, `src/app/share/route.ts` |
| F10 | Info | **Przed włączeniem płatności:** prawo odstąpienia dla treści cyfrowych (zgoda na natychmiastowe dostarczenie + potwierdzenie na trwałym nośniku), aktualizacja regulaminu (cena, reklamacje, ODR/ADR), VAT/JPK, ew. OSS, checkout hostowany przez PSP (Stripe/P24/PayU — PCI SAQ-A, KYC/AML po stronie PSP), PSP na liście procesorów, retencja dokumentów księgowych 5 lat (nadpisuje usunięcie), Omnibus przy promocjach. | `src/app/components/access-code-gate.tsx:105` |

## 4. Recommendations & Remediation Plan

Wysiłek: **S** ≤ ½ dnia · **M** 1–3 dni · **L** > 3 dni.

### Priorytet Wysoki — teraz (1–2 tygodnie)

| # | Obszar | Działanie | Wysiłek | Ustalenia |
| --- | --- | --- | --- | --- |
| 1 | Security | Migracja: `revoke insert, update on public.recipes from authenticated`; kolumnowe granty UPDATE na `recipe_shares` (`read_at`, `cleared_at`); CHECK `source_url ~ '^https?://'`; test regresji (pgTAP) | S | D1, C6 |
| 2 | Security | `next` → 16.4.x, `@opennextjs/cloudflare`, `inngest`, `wrangler`, `@supabase/*` do najnowszych patchy; ponowny `pnpm audit --prod` | S | D2 |
| 3 | Data | Slug: po kolizjach dopisywać unikalny sufiks (`base-<id>` lub base36) zamiast limitu 10; fallback `przepis-<id>` dla pustego slugu; test | S | C1, C8 |
| 4 | Reliability | SW: poprawić fallbacki (`await` + `??`), network-only dla tras zalogowanego i RSC, tylko GET w gałęzi API, limit wpisów, czyszczenie `caches` przy wylogowaniu, bez `skipWaiting()`; test SW | M | E1–E3 |
| 5 | Data/Reliability | Backup: `pg_dump` całej bazy (z `auth`) + sync Storage (np. GitHub Action → R2) lub rozszerzenie listy tabel + streaming per tabela/strona; rzucanie błędu; heartbeat (dead-man’s switch); jednorazowy, udokumentowany test restore do projektu scratch | M | C2, E8 |
| 6 | Compliance | Płeć: neutralna linijka „Dodane przez {nazwa}” **albo** poprawka polityki prywatności; dodać opcję „wolę nie podawać” | S | F1, F3 |
| 7 | Compliance | Decyzja prawna nt. praw autorskich: przestać archiwizować pełne galerie (miniatura/okładka + link), rozważyć `noindex` lub pełne kroki tylko dla zapisującego; wstrzymać sitemapę/Markdown z #362 do decyzji; formalny proces notice-and-action (DSA art. 11/12/16) | M | F2 |
| 8 | Architecture | Observability: `"observability": { "enabled": true }` w `wrangler.jsonc`, `instrumentation.ts` z `onRequestError` + reporter błędów (Sentry for Workers lub równoważny), alerty na backup/keep-alive/pipeline, `/api/health` | M | A2 |
| 9 | Architecture | Minimalne CI (GitHub Actions): typecheck, lint, vitest, `opennextjs-cloudflare build` + kontrola rozmiaru (3 MiB), knip; e2e `add-recipe` nie może pisać do produkcji | M | A1, A8 |

### Priorytet Średni — następne 1–2 sprinty

| # | Obszar | Działanie | Wysiłek | Ustalenia |
| --- | --- | --- | --- | --- |
| 10 | Security | Nagłówki: CSP (z `frame-ancestors 'none'`), X-Frame-Options, Referrer-Policy, nosniff, HSTS (zweryfikować strefę) | S | D3 |
| 11 | Security/Koszt | Rate limit ekstrakcji (binding `ratelimits`, np. 20/h/użytkownik) we wszystkich 4 punktach wejścia; `getFullAccess` w `retryShare` | S | D4, C6 |
| 12 | Reliability | Inngest: rozbić na `step.run` (scrape → LLM → archiwizacja → zapis), `NonRetriableError` dla błędów treści, `failed` tylko w `onFailure`, `concurrency` per `userId`, `throttle`, `idempotency: event.data.shareId` | M | A3, C7 |
| 13 | Data | Walidacja odpowiedzi LLM schematem (np. zod) z koercją składników i czasów; sweeper/`onFailure` dla `pending` > 15 min; dedup ignoruje stare `pending`; sprawdzanie błędów update’u share | M | C3, C4 |
| 14 | Data | Dedup między użytkownikami: wymagać zgodności tytułu lub wyższego progu; tabela aliasów `recipe_source_aliases` dla scalonych linków | M | C5 |
| 15 | Quality | Regenerować `supabase.types.ts` (skrypt `supabase gen types`), typować klientów `<Database>`, check dryfu w CI; wspólna fabryka `createSupabaseAdminClient()` | M | B1, A6 |
| 16 | Quality | Testy bazy (pgTAP / `supabase test db`): macierz RLS anon/inny użytkownik/właściciel, `redeem_access_code`, kaskada usunięcia konta; test parzystości TS↔SQL dla `normalize_url`/slugify | M | B2, A6 |
| 17 | Performance | Indeksy `recipes (category, created_at desc, id desc)` i `recipes (created_at desc, id desc)`; jeden count kategorii; fasety tagów przez RPC `group by`; paginacja `/ulubione` | S | E5, E7 |
| 18 | Performance | Cache danych publicznych: OpenNext z R2 incremental cache + tag cache, `'use cache'` + `cacheTag` dla przepisu/kategorii/feedu, `revalidateTag` z pipeline’u; `getClaims()` zamiast drugiego `getUser()`; jedno RPC na liczniki menu/dzwonka | L | E4, E6 |
| 19 | Architecture | Usunąć `next-pwa` i `workbox-window` (SW zostaje ręczny i przetestowany) lub dokończyć migrację na Serwist | S | A5 |
| 20 | Compliance | Samodzielne „Usuń konto” (service role, sprzątanie Storage, log usunięcia: timestamp + hash id); FK/trigger dla tabel merge; uzupełnić runbook o restore | M | F5, C10 |
| 21 | Compliance | Imiona autorów postów FB tylko dla allowlisty publicznych twórców; log zmian dla skryptów service-role; `@axe-core/playwright` na 3–5 kluczowych ekranach | M | F4, F6, F8 |
| 22 | Compliance | Ocena ryzyka ToS Meta/YouTube; preferować oficjalne oEmbed/Data API, ścieżki scrapingowe traktować jako wymienne | M | F7 |

### Priorytet Niski — backlog / higiena

| # | Obszar | Działanie | Ustalenia |
| --- | --- | --- | --- |
| 23 | Security | Dev login tylko z loopback; `redirect: 'manual'` + re-check SSRF na każdym skoku i w ścieżce Blogger; limity bajtów na strumieniach; magic bytes obrazów; usunąć politykę SELECT bucketu `recipe-images`; CHECK na `display_name`; Origin check w route handlerach; Exa fail-closed + generyczny błąd; Turnstile w Supabase Auth i generyczny komunikat logowania; decyzja co do kodu zaproszenia na `/signup` | D5–D9 |
| 24 | Data | Normalizacja URL (`www.`, `m.`, `http/https`, parametry YouTube), unikalność `youtube_id`; przenieść migracje danych do skryptów; paginacja w skryptach (limit 1000); `--apply`/dry-run dla `archive-recipe-images`, `refresh-recipe-times`, `fix-recipe-covers`; archiwizacja zakończonych skryptów | C8, C9, B6 |
| 25 | Quality | Nazwa pakietu, literówka `getSuabaseServiceRoleKey`, usunięcie martwego kodu (knip), `dotenv` w devDependencies, Prettier/Biome, naprawa 2 ostrzeżeń lint, refaktor `runExtractRecipe` / `recipe-image-archive` / `facebook` na moduły czyste + I/O | B4, B5, B7, A4 |
| 26 | Architecture | `compatibility_date`, `@types/node` 22 + `engines`, aktualny `.env.local.example`, `vitest` include `*.test.tsx` | A7, B3 |
| 27 | Docs | Wyciągnąć blok kursu z CLAUDE.md, scalić wyjątki SDLC, odświeżyć `test-plan.md` i README (middleware, offline), zarchiwizować zakończone `context/changes/*`, data wersji w `LegalPage`, `zp-gender` w sekcji cookies | B8, F9 |
| 28 | Performance | Klucz cache obrazów tylko z `url`/`w`/`q`; bez `priority` dla ukrytego `LogoIcon`; `not-found.tsx`; `/powiadomienia` — wąska akcja zamiast pełnego refresh | E9, E6 |

## 5. Conclusion

**Werdykt: warunkowo gotowe do produkcji w obecnej skali** (zamknięty krąg użytkowników z kodem dostępu, kilkaset przepisów). Fundament bezpieczeństwa — sesje, przekierowania, RLS, funkcje `SECURITY DEFINER`, egzekwowanie reguł biznesowych w bazie — jest solidny i lepszy niż typowy dla projektu tej wielkości. Testy jednostkowe są liczne i zielone.

**Niegotowe do publicznego wzrostu ani do płatności**, dopóki nie zostaną zamknięte pozycje 1–9 z priorytetu Wysoki. Trzy z nich to kilka godzin pracy każda i dają największy zwrot: odebranie bezpośrednich zapisów do `recipes` (1), aktualizacja Next.js (2) i naprawa limitu slugów (3). Największe ryzyka biznesowe nie są techniczne: jedyna kopia danych nie pozwala odtworzyć aplikacji (5), a publikowanie pełnych kopii cudzych przepisów i zdjęć (7) oraz niezgodność polityki prywatności z kodem (6) to ekspozycja prawna, która rośnie z każdą zaindeksowaną stroną.

Kierunek na kolejne miesiące: przenieść jakość z „dyscypliny agenta” do automatu (CI, testy RLS, typy bazy, obserwowalność) — dziś każda z bramek działa tylko wtedy, gdy ktoś pamięta, żeby ją uruchomić. Health-check z lipca wskazał już brak CI i porzucone `next-pwa`; oba punkty są nadal otwarte.

**Nie zweryfikowano** (wymaga dostępu do dashboardów): ustawień produkcyjnych Supabase Auth (potwierdzanie e-maila, secure password change, leaked-password protection, SMTP), reguł strefy Cloudflare (HSTS, WAF), reguły lifecycle bucketu R2 oraz faktycznej liczby wierszy i rozmiaru backupów.
