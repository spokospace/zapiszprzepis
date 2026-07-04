---
project: ZapiszPrzepis
version: 2
status: active
created: 2026-05-28
updated: 2026-07-04
prd_version: 1
main_goal: market-feedback
top_blocker: time
---

# Mapa drogowa: ZapiszPrzepis

> Wywiedziono z `context/foundation/prd.md` (v1) + automatycznie zbadana baza kodu (stan na 2026-07-04, projekt w toku — nie świeży scaffold).
> Regeneracja mid-flight: rdzeń „udostępnij → archiwum" już działa. Poprzednia mapa (v1, 2026-05-28) w `context/foundation/archive/2026-07-04-roadmap.md`.
> Edytuj na miejscu; archiwizuj po zastąpieniu.
> Wycinki są wymienione w kolejności zależności. Tabela „W skrócie" to indeks.

## Podsumowanie wizji

ZapiszPrzepis to PWA *archive-first* do zapisywania przepisów udostępnianych z mediów społecznościowych (głównie Facebook), zaprojektowane dla jednej niedoświadczonej technicznie użytkowniczki — mamy autora aplikacji. Każdy URL trafia do aplikacji przez systemowy gest „udostępnij" i jest przekształcany w trwałą, polskojęzyczną kopię przepisu (tytuł, składniki jako lista wypunktowana, kroki, zdjęcie/screenshot, znormalizowana etykieta źródła) — niezależną od oryginału. *Archive-first* — termin produktowy — znaczy: aplikacja przechowuje KOPIĘ przepisu, a nie link do niego, więc gdy oryginał zniknie z Facebooka czy bloga, przepis nadal jest w pełni czytelny.

Rdzeń tej pętli jest już wdrożony (F-01..F-03, S-01..S-03). Ta wersja mapy sekwencjonuje **pozostałą powierzchnię must-have**: odnajdywanie zapisanych przepisów (kategorie + wyszukiwanie), niezawodność (zamykalne błędy + alert autora) oraz kontrolę dostępu (brama rejestracji z kodem). **Zakres MVP to przepisy z linków, stron WWW i blogów** — Facebook Reels/Video (nawet jako sam odnośnik) jest świadomie odłożony do V2 (decyzja użytkownika 2026-07-04: zbyt czasochłonne jak na MVP; patrz Zaparkowane).

## Gwiazda północna

**S-04: Mama otwiera kategorię lub wpisuje fragment nazwy i odnajduje zapisany przepis** (razem z `S-05` wyszukiwaniem) — to następny kamień milowy walidacji: dowód, że kolekcja przepisów jest użyteczna **w czasie**, a nie tylko w momencie zapisu.

> *Gwiazda północna* to tutaj najmniejszy kompleksowy (end-to-end) wycinek, którego pomyślne dostarczenie udowodniłoby aktualną hipotezę produktu — umieszczony tak wcześnie, jak pozwalają na to Wymagania wstępne. Pierwotna gwiazda (pierwszy zapisany przepis FB) jest już wdrożona; nowa hipoteza brzmi: „mama używa aplikacji samodzielnie ≥ 3 dni z rzędu" (Kryterium Wtórne PRD, zretargetowane z 30 → 3 dni), a jej warunkiem jest możliwość *odnalezienia* wcześniej zapisanego przepisu bez przewijania listy chronologicznej.

## W skrócie

| ID    | Change ID                       | Wynik (użytkownik może…)                                                                     | Wymagania wstępne | Odnośniki PRD                                            | Status |
| ----- | ------------------------------- | -------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------- | ------ |
| F-01  | auth-and-supabase-scaffold      | (fundament) Supabase + magic-link, sesja długo-żyjąca, RLS per-user                          | —                 | FR-001, Access Control                                  | done   |
| F-02  | async-job-runner                | (fundament) runner zadań w tle poza request-path (Inngest — pivot z Trigger.dev)             | —                 | FR-003, NFR p95 ≤ 3 min                                 | done   |
| F-03  | pwa-shell-and-share-target      | (fundament) PWA instalowalna z Web Share Target — Pixel 9 widzi ZapiszPrzepis                | —                 | FR-002, NFR PWA + Web Share Target                      | done   |
| S-01  | first-shared-recipe-fb-text     | udostępnić URL FB-tekstowy i zobaczyć polskojęzyczny przepis (karta + detal + trwałe zdjęcie) | F-01, F-02, F-03  | US-01, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-009 | done   |
| S-02  | web-blog-recipe-source          | udostępnić URL bloga WWW i zobaczyć przepis (Blogger feed + Firecrawl)                       | S-01              | FR-004                                                  | done   |
| S-03  | youtube-recipe-source           | udostępnić URL YouTube i zobaczyć przepis (odnośnik + embed; bez transkrypcji — pivot)       | S-01              | FR-004                                                  | done   |
| S-04  | category-browse                 | przeglądać przepisy pogrupowane wg kategorii (fixed taxonomy, 8 pozycji)                     | S-01              | FR-008                                                  | ready  |
| S-05  | recipe-search                   | wyszukać przepis wpisując fragment tytułu lub składnika (utwardzone ILIKE/pg_trgm)           | S-01              | FR-013                                                  | ready  |
| S-06  | error-ux-and-author-alerts      | obsłużyć nieudane przepisy w **dzwoneczku powiadomień** (Ponów / Odrzuć / Wyczyść wszystkie) — autor dostaje email | S-01              | FR-012, NFR „żadne żądanie nie ginie cicho"             | ready  |
| S-07  | invite-code-registration-gate   | zarejestrować się tylko z ważnym kodem zaproszenia (zamknięte rejestracje)                   | F-01              | Access Control (rozszerzenie — Otwarte Pytanie #5)      | ready  |
| ~~S-08~~ | ~~fb-reel-link-reference~~   | ~~FB Reel/Video jako odnośnik~~ — **odłożone do V2** (poza scope MVP, patrz Zaparkowane)     | —                 | —                                                       | parked |

## Strumienie

Pomoc nawigacyjna — grupuje elementy współdzielące łańcuch Wymagań wstępnych. Kanoniczna kolejność jest w grafie zależności poniżej; ta tabela to proponowana kolejność czytania w równoległych ścieżkach.

| Strumień | Temat                              | Łańcuch                                              | Uwaga                                                                                       |
| -------- | ---------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A        | Rdzeń pipeline'u (wdrożony)        | `F-01` / `F-02` / `F-03` → `S-01` → `S-02` / `S-03`  | Cały strumień `done` — pętla „udostępnij → polskojęzyczny przepis" działa na 3 źródłach.     |
| B        | Odnajdywanie (gwiazda północna)    | `S-04` / `S-05`                                      | Oba zależą tylko od `S-01` (wdrożone) → równoległe i `ready`. Cel: kolekcja użyteczna w czasie. |
| C        | Niezawodność i kontrola dostępu    | `S-06` / `S-07`                                      | `S-06` naprawia aktywny błąd (baner „nie udało się" nie znika + zepsuty „Ponów"); `S-07` zamyka rejestracje. |

## Baza

Co już jest na miejscu w bazie kodu na dzień `2026-07-04` (automatycznie zbadane). Poniższe fundamenty i wdrożone wycinki NIE są odbudowywane.

- **Frontend:** obecny — Next.js 16.2.6 (App Router) + React 19 + Tailwind v4. Lista przepisów (`src/app/(authenticated)/recipes/page.tsx`) i detal (`[slug]/page.tsx`) wdrożone; ekrany auth (`/login`, `/signup`, `/forgot-password`, `/reset-password`) obecne. Dedykowane trasy „kategorie" i „wyszukiwanie" — **nieobecne**.
- **Backend / API:** obecny — route handlers (`/share`, `/api/recipes/delete`, `/api/inngest`, `/auth/callback`) + Server Actions (dodawanie, retry, refresh, auth). Pipeline: intake → dedup → `recipe_shares` → `inngest.send('recipe/extract')` → scrape (Firecrawl / Blogger feed) → ekstrakcja gpt-4o-mini → zapis + archiwum obrazu (`src/inngest/functions.ts`).
- **Async jobs:** obecny — **Inngest** jest realnym runnerem (`src/inngest/client.ts`, `functions.ts`). Trigger.dev pozostał tylko jako smoke-test (`src/trigger/example.ts`) — **martwy kod do usunięcia** (patrz Otwarte Pytanie #6).
- **Dane:** obecny — `recipes` (title, slug, description, image_url, ingredients jsonb, steps jsonb, source_type, source_url, category enum, prep/cook/total_time, youtube_id) + `recipe_shares`; RLS per-user (`current_user_id()`); unikalny indeks dedup URL; bucket `recipe-images` z archiwizacją (`src/lib/recipe-image-archive.ts`).
- **Uwierzytelnianie:** obecny — Supabase magic-link w pełni wpięty (`login/actions.ts` → `/auth/callback` → `updateSession` w `middleware.ts`).
- **Wdrożenie / infrastruktura:** obecny — **Cloudflare Workers via OpenNext** (pivot z Vercel; `wrangler.jsonc`, `open-next.config.ts`), domena produkcyjna `zapiszprzepis.pl`. Env przez `src/lib/env.ts`. CI — **nieobecny** (manualny `wrangler deploy`).
- **Obserwowalność:** nieobecny — tylko `console.*` + try/catch; brak error trackingu, brak alertu autora o nieudanym przepisie (potrzebne przez `S-06`).
- **Wyszukiwanie:** częściowy — `pg_trgm` włączony, ale bez indeksu GIN; filtrowanie działa jako JS `.includes()` po pobranych wierszach (`recipes/page.tsx`) — działa dla małej kolekcji, `S-05` je utwardza.

Wdrożone increments złożone w powyższą bazę (bez własnych wierszy w Wycinkach): `recipe-url-dedup` (idempotencja udostępnień), `image-archive-storage` (trwała kopia zdjęcia, FR-006), `recipe-detail-improvements` (FR-009), `cloudflare-pages-custom-domain` (pivot hostingu).

## Fundamenty

> Wszystkie fundamenty są `done` (obecne w bazie). Wymienione dla kompletnego obrazu; nie są odbudowywane. Brak nowych fundamentów — pozostała praca to pionowe wycinki, które progresywnie wprowadzają potrzebne elementy (indeks GIN w `S-05`, kanał email w `S-06`).

### F-01: Supabase scaffold + magic-link auth

- **Wynik:** (fundament) projekt Supabase powiązany; magic-link → sesja długo-żyjąca; middleware chroni trasy zalogowane; RLS per `auth.uid()`.
- **Change ID:** auth-and-supabase-scaffold
- **Odnośniki PRD:** FR-001, Access Control
- **Odblokowuje:** S-01 (i każdy wycinek per-użytkownik), S-07 (brama rejestracji nadbudowuje ten sam przepływ auth).
- **Wymagania wstępne:** —
- **Równolegle z:** F-02, F-03
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** wdrożony i zweryfikowany (patrz `lessons.md` — 5 reguł z review F-01: walidacja `next=`, mapowanie kodów błędów Setem, `getSession` vs `getUser`, `SECURITY DEFINER`, walidacja env).
- **Status:** done

### F-02: Async job runner (Inngest — pivot z Trigger.dev)

- **Wynik:** (fundament) zadania ekstrakcji wykonują się poza request-path; Next.js wysyła `recipe/extract`, Inngest je wykonuje i zapisuje wynik.
- **Change ID:** async-job-runner
- **Odnośniki PRD:** FR-003 (ack < 1s + async), NFR „typowy czas ≤ 3 min p95"
- **Odblokowuje:** S-01 i wszystkie wycinki źródłowe (S-02, S-03) — dzielą tę samą kolejkę; S-06 (retry i alert autora działają na stanie zadania).
- **Wymagania wstępne:** —
- **Równolegle z:** F-01, F-03
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** wdrożony na Inngest (nie Trigger.dev jak zakładała mapa v1) — pivot dobrze pasuje do Cloudflare Workers. Pozostałość: martwy smoke-test Trigger.dev do usunięcia (Otwarte Pytanie #6).
- **Status:** done

### F-03: PWA shell + Web Share Target

- **Wynik:** (fundament) PWA instalowalna na Pixel 9; `share_target` w manifeście → route `/share`; ZapiszPrzepis pojawia się na liście „Udostępnij".
- **Change ID:** pwa-shell-and-share-target
- **Odnośniki PRD:** FR-002, NFR „PWA + Web Share Target na Chrome/Edge Android", Guardrail „Pixel 9"
- **Odblokowuje:** S-01 (jedyny kanał wejścia URL w MVP); weryfikację Guardraila „Pixel 9".
- **Wymagania wstępne:** —
- **Równolegle z:** F-01, F-02
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** wdrożony (`public/manifest.json`, `public/sw.js` via next-pwa, `src/app/share/route.ts`). Brak dedykowanego folderu zmiany — zbudowany inline; działa.
- **Status:** done

## Wycinki

### S-01: Pierwszy udostępniony przepis (FB tekstowy, end-to-end)

- **Wynik:** Mama udostępnia URL postu FB, widzi w < 1s „Zapisałem…", a po 1-3 min na liście jest karta z polskim tytułem i miniaturą; detal pokazuje trwałe zdjęcie, składniki jako UL, kroki ponumerowane, etykietę źródła i „Otwórz oryginał".
- **Change ID:** first-shared-recipe-fb-text
- **Odnośniki PRD:** US-01, FR-002, FR-003, FR-004 (FB tekstowy), FR-005 (EN→PL + miary metryczne), FR-006 (trwała kopia + UL składników), FR-007 (lista od najnowszych), FR-009 (detal)
- **Wymagania wstępne:** F-01, F-02, F-03
- **Równolegle z:** —
- **Blokady:** —
- **Niewiadome:**
  - Precyzja konwersji miar US→metric (Otwarte Pytanie #2) — Właściciel: autor. Blokuje: nie. Ship best-effort, refine po testach.
- **Ryzyko:** wdrożony i działa na produkcji; złożył w sobie increments `image-archive-storage`, `recipe-detail-improvements`, `recipe-url-dedup`. Trwałość FB-tekst OK; rate-limity FB obsłużone best-effortem (og:image + tytuł, nota o niekompletności).
- **Status:** done

### S-02: Źródło bloga WWW (Blogger feed + Firecrawl)

- **Wynik:** Mama udostępnia URL bloga kulinarnego i widzi przepis tym samym pipeline'em co FB-tekst (inny scraper na wejściu).
- **Change ID:** web-blog-recipe-source
- **Odnośniki PRD:** FR-004 (strony WWW)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-03, S-04, S-05, S-06
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** wdrożony. Pivot: `*.blogspot.com` używa Blogger JSON feed zamiast Firecrawl (Firecrawl zwracał śmieci z Google Translate) — udokumentowane w pamięci projektu.
- **Status:** done

### S-03: Źródło YouTube (odnośnik + embed — pivot)

- **Wynik:** Mama udostępnia URL YouTube i zapisuje przepis; wideo jest osadzone przez `youtube_id` (iframe), a treść pochodzi z metadanych/opisu — bez pobierania i transkrypcji audio.
- **Change ID:** youtube-recipe-source
- **Odnośniki PRD:** FR-004 (YouTube + Shorts)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-04, S-05, S-06
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** wdrożony jako **pivot** — mapa v1 zakładała yt-dlp + Whisper, ale serverless (Cloudflare Workers) nie uruchomi binariów; zamiast tego zapis `video_id` + iframe. Pełna transkrypcja audio → V2 (Zaparkowane).
- **Status:** done

### S-04: Przeglądanie po kategoriach (fixed taxonomy) — GWIAZDA PÓŁNOCNA

- **Wynik:** Mama otwiera kategorię (Obiady / Zupy / Desery / Śniadania / Przekąski / Wegetariańskie / Napoje / Inne) i widzi tylko przepisy z tej kategorii — kategoria przypisana automatycznie przez LLM podczas ekstrakcji (kolumna `category` już w schemacie).
- **Change ID:** category-browse
- **Odnośniki PRD:** FR-008 (przeglądanie wg fixed taxonomy przypisanej przez AI)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-05, S-06, S-07
- **Blokady:** —
- **Niewiadome:**
  - Lista kategorii do potwierdzenia z mamą (Otwarte Pytanie #3): czy 8 pozycji wystarcza, czy brakuje „Wypieki" / „Sałatki" / „Przetwory"? — Właściciel: autor (rozmowa z mamą). Blokuje: nie. Ship z domyślną 8-pozycyjną listą; refine promptu klasyfikatora po rozmowie.
- **Ryzyko:** mało ryzyka technicznego (filtr `WHERE category = X` — kolumna istnieje); folder zmiany `context/changes/category-browse/` już otwarty, ale trasa jeszcze nieobecna. Główne ryzyko produktowe to spójność klasyfikacji LLM — audytować na pierwszych ~20 przepisach.
- **Status:** ready

### S-05: Wyszukiwanie po tytule i składniku (utwardzone)

- **Wynik:** Mama wpisuje fragment tytułu lub nazwy składnika i widzi wyniki filtrowane natychmiast, także dla rosnącej kolekcji (nie tylko po aktualnie pobranych wierszach).
- **Change ID:** recipe-search
- **Odnośniki PRD:** FR-013 (proste tekstowe wyszukiwanie po tytule i składniku)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-04, S-06, S-07
- **Blokady:** —
- **Niewiadome:**
  - Kształt zapytania po składniku: składniki są w polu `jsonb` — czy wystarczy `ILIKE` na zmaterializowanym tekście, czy potrzebny indeks GIN / rozłożenie na wiersze? — Właściciel: autor. Blokuje: nie. Decyzja per `/10x-plan`.
- **Ryzyko:** obecnie wyszukiwanie to JS `.includes()` po pobranych wierszach — działa dla ~100 przepisów, ale nie skaluje i nie łapie odmiany („mąka" vs „mąki"). Utwardzenie: `pg_trgm` (już włączony) + indeks GIN, przeniesienie filtra do zapytania SQL.
- **Status:** ready

### S-06: Zamykalne błędy + bounded retry + email do autora

- **Wynik:** Nieudane ekstrakcje nie wiszą już w banerze nad listą, tylko żyją w **dzwoneczku powiadomień** w nagłówku (badge = liczba spraw do uwagi). Mama otwiera dzwoneczek i dla każdego wpisu ma „Ponów" (naprawiony — nie renderuje już `javascript:throw`) oraz „Odrzuć"; na górze „Wyczyść wszystkie". Wpis znika po odrzuceniu i nie wraca dla przepisów, które dodały się inną drogą (auto-rozwiązywanie). Autor dostaje email o trwale nieudanym przepisie.
- **Change ID:** error-ux-and-author-alerts
- **Odnośniki PRD:** FR-012 (czytelny komunikat + bounded retry max 3 + powiadomienie autora), NFR „żadne udostępnione żądanie nie ginie cicho"
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-04, S-05, S-07
- **Blokady:** —
- **Niewiadome:**
  - Kanał powiadomienia autora (Otwarte Pytanie #4): email (Resend?) vs inny? — Właściciel: autor. Blokuje: nie. Domyślnie email.
- **Ryzyko:** adresuje **aktywny błąd na produkcji**: baner „Nie udało się przetworzyć (N)" wyświetla się cały czas, nawet gdy przepisy zostały już dodane; formularz „Ponów" ma `action="javascript:throw new Error('A React form was unexpectedly submitted…')"` — Server Action nie jest poprawnie podpięty (prawdopodobnie `form.submit()` zamiast `requestSubmit()` / błędne bindowanie akcji). Powierzchnia = dzwoneczek w nowym nagłówku `(authenticated)/layout.tsx` (dziś nie ma wspólnego paska — powstaje przy okazji, trafia tam też wylogowanie); baner inline z `recipes-content.tsx` usunięty. Wymaga: (a) odrzucania per-share + „Wyczyść wszystkie" (MVP: delete wiersza, bez migracji enuma), (b) naprawy retry przez `useTransition` (omija `javascript:throw`), (c) transactional email przy trwałym fail. Tekst błędu zrozumiały dla mamy (nie „HTTP 429").
- **Status:** ready

### S-07: Brama rejestracji z kodem zaproszenia

- **Wynik:** Nowa rejestracja wymaga wpisania ważnego kodu zaproszenia; bez kodu rejestracja jest odrzucana. Istniejący, zalogowani użytkownicy (mama) nie są dotknięci. Zamyka otwarte rejestracje na publicznej domenie `zapiszprzepis.pl`.
- **Change ID:** invite-code-registration-gate
- **Odnośniki PRD:** Access Control (rozszerzenie — **nowa praca poza obecnym PRD**, patrz Otwarte Pytanie #5; rekomendowane dodanie FR-014)
- **Wymagania wstępne:** F-01
- **Równolegle z:** S-04, S-05, S-06
- **Blokady:** —
- **Niewiadome:**
  - Mechanizm kodu: pojedynczy stały kod z env vs tabela kodów jednorazowych vs allow-lista e-maili? — Właściciel: autor. Blokuje: nie. Domyślnie: pojedynczy kod z env (najprostszy dla 1-2 użytkowników), decyzja per `/10x-plan`.
- **Ryzyko:** nowa powierzchnia względem PRD (PRD §Access Control opisuje tylko magic-link bez bramy). Niski koszt techniczny (walidacja kodu przed `signInWithOtp` w Server Action rejestracji), ale należy zaktualizować PRD, by mapa nie rozjeżdżała się ze specyfikacją. Uwaga: nie zablokować mamy — brama dotyczy tylko *nowej* rejestracji, nie logowania istniejącej sesji.
- **Status:** ready

### S-08: Facebook Reel/Video jako źródło — ODŁOŻONE DO V2

- **Wynik (docelowy, poza MVP):** Mama udostępnia URL FB Reel lub video; aplikacja zapisuje go jako trwały odnośnik + og:image + tytuł (jak YouTube-embed), bez pełnej ekstrakcji treści z audio.
- **Change ID:** fb-reel-link-reference
- **Status:** **parked (V2).** Decyzja użytkownika (2026-07-04): każda praca nad źródłem Reels — nawet minimalna (sam odnośnik + og:image) — jest zbyt czasochłonna jak na MVP. Zakres MVP to przepisy z **linków, stron WWW i blogów**. Reels/Video z FB wraca dopiero w V2. Szczegóły w sekcji Zaparkowane; pełny opis wariantu „odnośnik" zachowany w historii mapy v2.

## Przekazanie backlogu

| ID mapy drogowej | Change ID                     | Sugerowany tytuł problemu                                                        | Gotowe do `/10x-plan` | Uwagi                                                       |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------- |
| F-01             | auth-and-supabase-scaffold    | Supabase + magic-link auth z RLS                                                 | no                    | done — zarchiwizuj przez `/10x-archive`                    |
| F-02             | async-job-runner              | Async job runner (Inngest)                                                       | no                    | done — pivot z Trigger.dev                                 |
| F-03             | pwa-shell-and-share-target    | PWA shell + Web Share Target na Pixel 9                                          | no                    | done — zbudowany inline (brak folderu zmiany)              |
| S-01             | first-shared-recipe-fb-text   | Udostępnij FB-tekst → polskojęzyczny przepis (end-to-end)                        | no                    | done                                                       |
| S-02             | web-blog-recipe-source        | Źródło bloga WWW (Blogger feed + Firecrawl)                                      | no                    | done                                                       |
| S-03             | youtube-recipe-source         | Źródło YouTube (odnośnik + embed)                                                | no                    | done — pivot bez transkrypcji                              |
| S-04             | category-browse               | Przeglądanie po kategoriach (fixed taxonomy 8 pozycji)                           | yes                   | **Gwiazda północna.** Uruchom `/10x-plan category-browse`  |
| S-05             | recipe-search                 | Utwardzone wyszukiwanie ILIKE/pg_trgm po tytule i składniku                      | yes                   | Uruchom `/10x-plan recipe-search` — równolegle z S-04      |
| S-06             | error-ux-and-author-alerts    | Zamykalne błędy + naprawa „Ponów" + email do autora                             | yes                   | Naprawia aktywny błąd na produkcji                         |
| S-07             | invite-code-registration-gate | Brama rejestracji z kodem zaproszenia                                            | yes                   | Zaktualizuj PRD (FR-014) — nowa powierzchnia               |
| ~~S-08~~         | ~~fb-reel-link-reference~~    | ~~FB Reel/Video jako odnośnik~~                                                  | no                    | **Parked → V2** (poza scope MVP, decyzja 2026-07-04)       |

## Otwarte pytania dotyczące mapy drogowej

1. **Feasibility scrapingu Facebook Reels** (z PRD §Open Questions #1) — **ZAMKNIĘTE / POZA SCOPE MVP.** Decyzja użytkownika (2026-07-04): źródło Reels/Video z FB jest w całości odłożone do V2 — również wariant „sam odnośnik + og:image". MVP obejmuje tylko linki, strony WWW i blogi. Spike niepotrzebny; pytanie wraca dopiero gdy Reels wejdzie do V2.
2. **Precyzja konwersji miar US→metric** (PRD §Open Questions #2). Czy LLM wystarcza, czy potrzebna biblioteka `convert-units`? Właściciel: autor. Blokuje: nikogo (S-01 shipuje best-effort; decyzja po testach EN).
3. **Lista kategorii fixed taxonomy do potwierdzenia z mamą** (PRD §Open Questions #3). Czy 8 pozycji wystarcza? Właściciel: autor (rozmowa z mamą). Blokuje: nikogo (S-04 shipuje z domyślną listą).
4. **Kanał powiadomienia autora o nieudanym przepisie** (PRD §Open Questions #4). Email (Resend)? Inny? Właściciel: autor. Blokuje: nikogo (S-06 domyślnie email).
5. **Brama rejestracji z kodem zaproszenia — aktualizacja PRD.** Nowa praca (S-07) wykracza poza PRD §Access Control (opisuje tylko magic-link). Rekomendacja: dodać FR-014 „zamknięte rejestracje z kodem zaproszenia" do PRD, by specyfikacja i mapa się nie rozjechały. Właściciel: autor. Blokuje: nikogo (S-07 może ruszyć; PRD dogonić równolegle).
6. **Retarget Kryterium Wtórnego 30 → 3 dni + usunięcie martwego Trigger.dev.** (a) PRD §Success Criteria Secondary mówi „≥ 30 dni bez pomocy"; użytkownik zretargetował do „≥ 3 dni" — zaktualizować PRD. (b) `src/trigger/example.ts` + `trigger.config.ts` to martwy smoke-test po pivocie na Inngest — usunąć przy okazji S-06. Właściciel: autor. Blokuje: nikogo.

## Zaparkowane

- **Facebook Reels / Video jako źródło (w całości, nawet jako sam odnośnik)** — decyzja użytkownika 2026-07-04: każda praca nad Reels jest zbyt czasochłonna jak na MVP; zakres MVP to linki, strony WWW i blogi. Dawny slice S-08 (`fb-reel-link-reference`) przeniesiony tutaj. V2.
- **Pełna ekstrakcja audio z FB Reel / YouTube (Whisper)** — serverless (Cloudflare Workers) nie uruchomi yt-dlp/FFmpeg; YouTube w MVP działa jako odnośnik + embed (S-03). V2, gdy dojdzie osobny worker do transkrypcji.
- **Auto-wykrywanie udostępnień z Messengera i innych aplikacji** — decyzja użytkownika: w przyszłości aplikacja będzie „wyłapywać" udostępnienia z Messengera itp. V2.
- **Push notifications („Dodano: <tytuł>")** — FR-011 nice-to-have. Mama wraca do aplikacji ręcznie. V2.
- **Placeholder „Zapisuję…" w liście przepisów** — FR-010 nice-to-have. W MVP wystarczy ekran potwierdzenia po share; lista odświeża się przy otwarciu. V2.
- **Wsparcie Instagram + TikTok** — PRD §Non-Goals. Trudniejszy share intent, osobny scraper. V2.
- **Współdzielenie rodzinne (ZapiszPrzepis Family)** — PRD §Non-Goals. Płaski model per-użytkownik. V2.
- **Ręczna edycja przepisu po ekstrakcji** — PRD §Non-Goals + Guardrail „zero data entry".
- **Funkcje wokół gotowania** („co ugotować z tego co mam", lista zakupów, plan tygodnia, voice search) — PRD §Non-Goals. Inna apka.
- **Wyszukiwanie semantyczne** („coś szybkiego", „bez mięsa") — PRD §Non-Goals. W MVP tylko tekstowe (S-05). V2.
- **Aplikacja natywna iOS / Android (Capacitor wrap, App Store)** — PRD §Non-Goals. Tylko PWA.
- **Offline-first przeglądanie** — PRD §Non-Goals. PWA cache best-effort, nieegzekwowane.
- **CI/CD (GitHub Actions → auto-deploy)** — obecnie manualny `wrangler deploy`; tech-stack zakładał auto-deploy-on-merge. Nie blokuje MVP; podłączyć, gdy tempo zmian wzrośnie.

## Zrobione

> Uwaga: normalnie tę sekcję wypełnia wyłącznie `/10x-archive`. Poniższe wpisy są dodane ręcznie przy regeneracji mid-flight (wybór użytkownika „built = done"), bo praca jest wdrożona na produkcji, ale foldery zmian nie zostały jeszcze zarchiwizowane. Uruchom `/10x-archive <change-id>` dla każdej, by domknąć cykl formalnie.

- **F-01: Supabase + magic-link auth** — wdrożony; 5 reguł z review w `context/foundation/lessons.md`. Folder: `context/changes/auth-and-supabase-scaffold/` (do zarchiwizowania).
- **F-02: Async job runner (Inngest)** — wdrożony; pivot z Trigger.dev. Folder: `context/changes/async-job-runner/`.
- **F-03: PWA shell + Web Share Target** — wdrożony inline (brak folderu zmiany).
- **S-01: Pierwszy udostępniony przepis (FB tekstowy)** — wdrożony; złożył increments dedup + image-archive + detail-improvements. Folder: `context/changes/first-shared-recipe-fb-text/`.
- **S-02: Źródło bloga WWW** — wdrożony (Blogger feed pivot). Folder: `context/changes/web-blog-recipe-source/`.
- **S-03: Źródło YouTube** — wdrożony (odnośnik + embed pivot). Folder: `context/changes/youtube-recipe-source/`.
