---
project: ZapiszPrzepis
version: 1
status: draft
created: 2026-05-28
updated: 2026-05-28
prd_version: 1
main_goal: market-feedback
top_blocker: time
---

# Mapa drogowa: ZapiszPrzepis

> Wywiedziono z `context/foundation/prd.md` (v1) + automatycznie zbadana baza kodu (świeży scaffold Next.js po `/10x-bootstrapper`).
> Edytuj na miejscu; archiwizuj po zastąpieniu.
> Poniższe wycinki są wymienione w kolejności zależności. Tabela „W skrócie" to indeks.

## Podsumowanie wizji

ZapiszPrzepis to PWA *archive-first* do zapisywania przepisów udostępnianych z mediów społecznościowych (głównie Facebook), zaprojektowane dla jednej niedoświadczonej technicznie użytkowniczki — mamy autora aplikacji. Każdy URL trafia do aplikacji przez systemowy gest „udostępnij" i jest przekształcany w trwałą, polskojęzyczną kopię przepisu (tytuł, składniki jako lista wypunktowana, kroki, zdjęcie/screenshot, znormalizowana etykieta źródła) — niezależną od oryginału. *Archive-first* — termin produktowy — znaczy: aplikacja przechowuje KOPIĘ przepisu, a nie link do niego, więc gdy oryginał zniknie z Facebooka czy bloga, przepis nadal jest w pełni czytelny.

## Gwiazda północna

**S-01: Mama udostępnia URL z postu tekstowego Facebook i widzi w aplikacji gotowy, polskojęzyczny przepis** — to kamień milowy walidacji rdzennej hipotezy produktu (AI dziś wystarczy do automatycznej ekstrakcji przepisu z dowolnego źródła) na faktycznie dominującym źródle z Wizji PRD.

> *Gwiazda północna* to tutaj najmniejszy kompleksowy (end-to-end) wycinek, którego pomyślne dostarczenie udowodniłoby podstawową hipotezę produktu — umieszczony tak wcześnie, jak pozwalają na to Wymagania wstępne, ponieważ wszystko inne ma znaczenie tylko wtedy, gdy to działa.

## W skrócie

| ID    | Change ID                       | Wynik (użytkownik może…)                                                                  | Wymagania wstępne     | Odnośniki PRD                          | Status   |
| ----- | ------------------------------- | ----------------------------------------------------------------------------------------- | --------------------- | -------------------------------------- | -------- |
| F-01  | auth-and-supabase-scaffold      | (fundament) projekt Supabase z magic-link auth, sesja długo-żyjąca, RLS-ready             | —                     | FR-001, Access Control                 | ready    |
| F-02  | async-job-runner                | (fundament) Trigger.dev odbiera zadanie i kończy je poza request-path                     | —                     | FR-003, NFR p95 ≤ 3 min                | ready    |
| F-03  | pwa-shell-and-share-target      | (fundament) PWA instalowalna z Web Share Target — Pixel 9 widzi ZapiszPrzepis na liście udostępniania | —                     | FR-002, NFR PWA + Web Share Target     | ready    |
| S-01  | first-shared-recipe-fb-text     | udostępnić URL FB-tekstowy i po 1-3 min zobaczyć w aplikacji polskojęzyczny przepis (karta + detal) | F-01, F-02, F-03      | US-01, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-009 | proposed |
| S-02  | web-blog-recipe-source          | udostępnić URL bloga WWW i zobaczyć przepis (drugie źródło)                               | S-01                  | FR-004                                 | proposed |
| S-03  | fb-reel-recipe-source           | udostępnić URL Facebook Reel i zobaczyć przepis (z audio przez Whisper)                   | S-01                  | FR-004                                 | blocked  |
| S-04  | youtube-recipe-source           | udostępnić URL YouTube (film lub Short) i zobaczyć przepis (yt-dlp + Whisper)             | S-01                  | FR-004                                 | proposed |
| S-05  | category-browse                 | przeglądać przepisy pogrupowane wg kategorii (fixed taxonomy 8 pozycji)                   | S-01                  | FR-008                                 | proposed |
| S-06  | recipe-search                   | wyszukać przepis wpisując fragment tytułu lub składnika                                   | S-01                  | FR-013                                 | proposed |
| S-07  | error-ux-and-author-alerts      | zobaczyć czytelny komunikat błędu z bounded retry (max 3) — autor dostaje email o trwałym fail | S-01                  | FR-012, NFR „żadne żądanie nie ginie cicho" | proposed |

## Strumienie

Pomoc nawigacyjna — grupuje elementy, które współdzielą łańcuch Wymagań wstępnych. Kanoniczna kolejność nadal znajduje się w grafie zależności poniżej; ta tabela to proponowana kolejność czytania w równoległych ścieżkach.

| Strumień | Temat                                  | Łańcuch                                  | Uwaga                                                                                                       |
| -------- | -------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A        | Rdzeń pipeline'u i pierwsza walidacja  | `F-01` / `F-02` / `F-03` → `S-01`        | Wszystkie 3 fundamenty są od siebie niezależne — mogą być realizowane równolegle. S-01 to punkt zbiegu i gwiazda północna. |
| B        | Dodatkowe źródła                       | `S-02` / `S-03` / `S-04` (po `S-01`)     | Każde nowe źródło to wymiana scrapera w pipelinie z S-01. `S-03` zablokowany do rozwiązania Otwartego Pytania #1. |
| C        | Przeglądanie i sieć bezpieczeństwa     | `S-05` / `S-06` / `S-07` (po `S-01`)     | Wszystkie wymagają zapisanych przepisów (S-01). Cel: kategoryzacja, wyszukiwanie i obsługa trwałych błędów. |

## Baza

Co już jest na miejscu w bazie kodu na dzień `2026-05-28` (świeży scaffold po `/10x-bootstrapper`). Poniższe fundamenty zakładają, że są one obecne i NIE odbudowują ich.

- **Frontend:** obecny — Next.js 16.2.6 (App Router) + Tailwind v4 + TypeScript; `src/app/page.tsx`, `layout.tsx`, `globals.css` z scaffolda.
- **Backend / API:** częściowy — Next.js obsługuje API routes (Server Actions + route handlers), ale `src/app/api/` jeszcze nie istnieje; brak własnych endpointów.
- **Dane:** nieobecny — brak SDK Supabase w `package.json`, brak `supabase/` ani migracji. Zadeklarowane w `tech-stack.md`, ale niewpięte.
- **Uwierzytelnianie:** nieobecny — brak middleware uwierzytelniania, brak helperów Supabase auth. Zadeklarowane jako magic-link Supabase w `tech-stack.md`.
- **Wdrożenie / infrastruktura:** częściowy — Next.js jest natywny dla Vercel (zerokonfiguracyjny deploy), ale brak `vercel.json`, brak zmiennych środowiskowych, brak powiązania projektu z kontem Vercel.
- **Obserwowalność:** nieobecny — niezadeklarowana w `tech-stack.md`, brak loggera w zależnościach.

Warstwy zadeklarowane w `tech-stack.md`, ale jeszcze nie wpięte (każda zostanie wprowadzona przez pierwszy wycinek, który jej potrzebuje, lub przez fundament — zasada progresywnego ujawniania): Supabase (DB + auth + storage), Trigger.dev (async jobs), Firecrawl (web scraping), Playwright (FB scraping fallback), Whisper API + FFmpeg (transkrypcja audio), OpenAI (ekstrakcja LLM + tłumaczenie + klasyfikacja), next-pwa (Web Share Target + PWA shell).

## Fundamenty

### F-01: Supabase scaffold + magic-link auth

- **Wynik:** (fundament) projekt Supabase utworzony i powiązany; mama (po jednorazowym setupie autora) dostaje magic-link, klika go i jest zalogowana z sesją długo-żyjącą; middleware Next.js chroni trasy zalogowane; schema gotowa do dodania pierwszej tabeli przez S-01 z RLS per `auth.uid()`.
- **Change ID:** auth-and-supabase-scaffold
- **Odnośniki PRD:** FR-001 (sesja długo-żyjąca), Access Control (passwordless magic link, jeden e-mail → jedno konto → prywatna skrzynka)
- **Odblokowuje:** S-01 (i każdy kolejny wycinek per-użytkownik) — bez sesji i RLS, żaden wycinek nie może zapisać przepisu w imieniu mamy.
- **Wymagania wstępne:** —
- **Równolegle z:** F-02, F-03
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** najniższe technicznie spośród fundamentów (Supabase magic-link to dobrze udokumentowana ścieżka), ale jest prerekwizytem każdego wycinka per-użytkownik — sekwencjonowane najwcześniej, by odblokować pozostałe; jedyna pułapka to konfiguracja redirect URL w Supabase dla środowiska Vercel preview vs produkcyjnego.
- **Status:** ready

### F-02: Async job runner (Trigger.dev)

- **Wynik:** (fundament) projekt Trigger.dev utworzony i powiązany z repo; jeden przykładowy task działa end-to-end: serwer Next.js triggeruje zadanie, Trigger.dev je wykonuje (poza request-path Vercel) i odsyła stan zakończenia.
- **Change ID:** async-job-runner
- **Odnośniki PRD:** FR-003 (potwierdzenie odebrania < 1s + asynchroniczne przetwarzanie 1-3 min), NFR „typowy czas ≤ 3 minuty p95"
- **Odblokowuje:** S-01 (FR-003 wymusza, by ekstrakcja przepisu była poza request-path — Vercel ma twardy timeout 60s na funkcji serverless, a NFR wymaga p95 ≤ 3 min). Również odblokowuje wszystkie kolejne wycinki źródłowe (S-02..S-04), które używają tej samej kolejki.
- **Wymagania wstępne:** —
- **Równolegle z:** F-01, F-03
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** Trigger.dev jest mniej znany niż Vercel cron, więc krzywa nauki narzędzia jest realna; wybór jest podyktowany NFR (Vercel cron / functions mają timeout 60s, a NFR wymaga p95 ≤ 3 min). Pułapka: webhook callback z Trigger.dev z powrotem do Vercel musi mieć stabilny URL i sekret.
- **Status:** ready

### F-03: PWA shell + Web Share Target

- **Wynik:** (fundament) PWA jest instalowalna na ekranie głównym Pixel 9 (manifest + service worker + ikony); pole `share_target` w manifeście wskazuje endpoint Next.js; gdy mama klika „Udostępnij" w dowolnej aplikacji, ZapiszPrzepis pojawia się na liście odbiorców.
- **Change ID:** pwa-shell-and-share-target
- **Odnośniki PRD:** FR-002 (systemowy gest „Udostępnij" z dowolnej aplikacji), NFR „PWA instalowalna + Web Share Target API na dwóch najnowszych Chrome i Edge na Androidzie", Guardrail „działa na jej Pixel 9"
- **Odblokowuje:** S-01 (bez Web Share Target żaden URL nie trafi do aplikacji — to JEDYNY kanał wejścia w MVP, brak ręcznego wklejania); odblokowuje również weryfikację Guardraila „działa na Pixel 9" przed jakimkolwiek pełnym wycinkiem.
- **Wymagania wstępne:** —
- **Równolegle z:** F-01, F-02
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** Web Share Target API ma wsparcie tylko w Chrome/Edge na Androidzie (nie iOS Safari), ale PRD `target_scale.users: small` + konkretne urządzenie = Pixel 9 Android sprawia, że ograniczenie jest akceptowalne. Pułapka: integracja z `next-pwa` w Next.js App Router wymaga uwagi (App Router + service workers mają znane chropowatości).
- **Status:** ready

## Wycinki

### S-01: Pierwszy udostępniony przepis (FB tekstowy, end-to-end)

- **Wynik:** Mama udostępnia URL postu tekstowego z Facebooka przez systemowy gest „Udostępnij → ZapiszPrzepis", widzi w < 1s komunikat „Zapisałem — przepis pojawi się za chwilę", a po 1-3 minutach (gdy wraca do aplikacji) na liście jest karta nowego przepisu z polskim tytułem i miniaturą; po jej kliknięciu widzi pełny przepis: zdjęcie/screenshot, składniki jako lista wypunktowana (UL), kroki ponumerowane, znormalizowana etykieta źródła („Facebook"), opcjonalny przycisk „Otwórz oryginał".
- **Change ID:** first-shared-recipe-fb-text
- **Odnośniki PRD:** US-01, FR-002 (share intent), FR-003 (ack < 1s + async 1-3 min), FR-004 (FB tekstowy — jedno źródło z czterech wymienionych), FR-005 (tłumaczenie EN→PL gdy oryginał po angielsku + konwersja miar metrycznych), FR-006 (trwała kopia z UL składników), FR-007 (lista uporządkowana od najnowszych — wersja minimalna), FR-009 (pojedynczy przepis pełny — wersja podstawowa)
- **Wymagania wstępne:** F-01, F-02, F-03
- **Równolegle z:** —
- **Blokady:** —
- **Niewiadome:**
  - Precyzja konwersji miar US→metric (Otwarte Pytanie #2 z PRD): czy LLM jest wystarczająco dokładny dla niejednoznacznych przypadków („1 cup of flour" = 120-150g), czy potrzebna biblioteka `convert-units` z explicit mapowaniem? — Właściciel: autor. Blokuje: nie. Decyzja po pierwszych 10-20 testach EN; ship best-effort, refine.
- **Ryzyko:** najwięcej koncentruje ryzyka — pierwszy raz pipeline (share → kolejka → scraping → LLM → DB → display) odpala się end-to-end; FB scraping postów tekstowych jest łatwiejszy niż Reels (treść jest w og:description / inline HTML), ale rate-limity FB są realne; fallback best-effort: przy niepełnej ekstrakcji zapisać og:image + tytuł + URL, oznaczyć przepis nutką „niekompletna ekstrakcja" (zgodnie z FR-004 best-effort i NFR „żadne żądanie nie ginie cicho").
- **Status:** proposed

### S-02: Źródło bloga WWW (drugie źródło)

- **Wynik:** Mama udostępnia URL strony WWW (typowo blog kulinarny) i widzi przepis w aplikacji tak samo jak dla FB postu tekstowego (ten sam pipeline, inny scraper na początku).
- **Change ID:** web-blog-recipe-source
- **Odnośniki PRD:** FR-004 (strony WWW jako wspierane źródło)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-03, S-04, S-05, S-06, S-07
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** najmniej ryzykowne ze wszystkich źródeł — Firecrawl/Jina są dojrzałe, większość blogów wystawia clean HTML z og:image. Pułapka: blogi z heavy JS rendering (single-page apps) mogą wymagać fallback do Playwright; sekwencjonowane jako pierwsze rozszerzenie źródła, bo daje mamie szybko drugie źródło bez nowego ryzyka.
- **Status:** proposed

### S-03: Źródło Facebook Reels (audio + screenshot)

- **Wynik:** Mama udostępnia URL Facebook Reels (lub video FB) i widzi przepis — gdy ekstrakcja audio przez Whisper się powiedzie, treść jest pełna; w trybie best-effort (rate-limit FB) zapisany jest screenshot + tytuł + URL z notatką „niekompletna ekstrakcja".
- **Change ID:** fb-reel-recipe-source
- **Odnośniki PRD:** FR-004 (FB Reels/Video jako wspierane źródło, ze strategią best-effort z Sokratesa)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-04, S-05, S-06, S-07
- **Blokady:** Otwarte Pytanie #1 z PRD: feasibility scrapingu Facebook Reels — czy Playwright / yt-dlp / FB Graph API są w stanie niezawodnie wyciągnąć audio + screenshot z Reels w MVP? Do potwierdzenia spike'em (1-2 dni) PRZED rozpoczęciem implementacji wycinka.
- **Niewiadome:**
  - Wynik spike'a feasibility FB Reels (Otwarte Pytanie #1) — Właściciel: autor. Blokuje: tak. Bez tej odpowiedzi nie da się zaplanować — strategia best-effort vs full scraping zmienia rozmiar pracy istotnie.
- **Ryzyko:** najwyższe spośród źródeł — FB agresywnie blokuje scraping; może okazać się, że po stronie tła agentowego trzeba zmieniać IP, rotować user-agenty, akceptować częste fail i polegać prawie wyłącznie na og:image z share_target callback (nie na faktycznym Reels content).
- **Status:** blocked

### S-04: Źródło YouTube (film lub Short, audio przez Whisper)

- **Wynik:** Mama udostępnia URL YouTube (film lub Short) i widzi przepis z pełną treścią pobraną z transkrypcji audio (Whisper).
- **Change ID:** youtube-recipe-source
- **Odnośniki PRD:** FR-004 (YouTube + Shorts jako wspierane źródło)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-03, S-05, S-06, S-07
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** yt-dlp jest dojrzały i niezawodny; główne ryzyko to jakość transkrypcji Whisper na polskich i angielskich akcentach kucharzy — zwykle akceptowalna, ale bywają przypadki, w których LLM ekstrakcji dostaje zaszumione wejście; koszt Whisper API mieści się w NFR ≤ 10 zł/m-c przy ~50 przepisach.
- **Status:** proposed

### S-05: Przeglądanie po kategoriach (fixed taxonomy)

- **Wynik:** Mama może otworzyć kategorię (Obiady / Zupy / Desery / Śniadania / Przekąski / Wegetariańskie / Napoje / Inne) i zobaczyć tylko przepisy z tej kategorii — kategoria była przypisana automatycznie przez LLM podczas ekstrakcji w S-01..S-04.
- **Change ID:** category-browse
- **Odnośniki PRD:** FR-008 (przeglądanie wg fixed taxonomy kategorii przypisanych automatycznie przez AI)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-03, S-04, S-06, S-07
- **Blokady:** —
- **Niewiadome:**
  - Lista kategorii do potwierdzenia z mamą (Otwarte Pytanie #3): czy proponowane 8 pokrywa jej typowe wzorce, czy brakuje „Wypieki", „Sałatki", „Słoiki/przetwory"? — Właściciel: autor (rozmowa z mamą). Blokuje: nie. Ship z domyślną 8-pozycyjną listą; refine po pierwszej rozmowie i ewentualnie zmień prompt klasyfikatora w S-01..S-04.
- **Ryzyko:** mało ryzyka technicznego (filtr WHERE category = X); główne ryzyko produktowe to spójność klasyfikacji LLM — ten sam typ przepisu może raz trafić do „Obiady", raz do „Wegetariańskie"; pomaga fixed taxonomy w prompt (już w PRD) ale jakość trzeba audytować na pierwszych ~20 przepisach.
- **Status:** proposed

### S-06: Wyszukiwanie po tytule i składniku

- **Wynik:** Mama wpisuje fragment tytułu lub nazwy składnika w polu wyszukiwania na liście przepisów i widzi wyniki filtrowane natychmiast.
- **Change ID:** recipe-search
- **Odnośniki PRD:** FR-013 (proste tekstowe wyszukiwanie po tytule i składniku — ILIKE / pg_trgm)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-03, S-04, S-05, S-07
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** najmniej technicznego ryzyka — ILIKE wystarczy dla ~100 przepisów; pg_trgm gdyby wyniki LIKE okazały się zbyt sztywne (np. odmiana „mąka" vs „mąki"). Pułapka UX: wyszukiwanie po składniku wymaga rozkładania JSON-owego pola składników na osobne wiersze (lub indeksu GIN) — decyzja o kształcie schematu w S-01 wpływa na łatwość implementacji tutaj.
- **Status:** proposed

### S-07: Obsługa błędów + bounded retry + email do autora

- **Wynik:** Gdy ekstrakcja przepisu się nie powiedzie (niewspierane źródło, video za długie, FB zablokował dostęp), mama widzi czytelny komunikat zamiast cichej awarii; przycisk „spróbuj ponownie" działa maksymalnie 3 razy, potem znika, zostaje tylko „usuń"; autor dostaje email o trwale nieudanym przepisie z URL-em i komunikatem błędu.
- **Change ID:** error-ux-and-author-alerts
- **Odnośniki PRD:** FR-012 (czytelny komunikat + bounded retry max 3 + powiadomienie autora), NFR „żadne udostępnione żądanie nie ginie cicho"
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-03, S-04, S-05, S-06
- **Blokady:** —
- **Niewiadome:**
  - Kanał powiadomienia autora (Otwarte Pytanie #4): email? Slack? Manualny review w bazie? — Właściciel: autor. Blokuje: nie. Domyślnie email (najprostszy), decyzja per `/10x-plan`.
- **Ryzyko:** mało ryzyka technicznego (counter w DB + transactional email). Pułapka UX: tekst komunikatu błędu musi być zrozumiały dla mamy (nie „HTTP 429 Too Many Requests", ale „Facebook nas chwilowo zablokował — spróbuj za chwilę"). Sekwencjonowane po stabilnym pipelinie z S-01, bo dopiero wtedy znamy realny katalog trybów awarii.
- **Status:** proposed

## Przekazanie backlogu

| ID mapy drogowej | Change ID                      | Sugerowany tytuł problemu                                                            | Gotowe do `/10x-plan` | Uwagi                                                     |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------------------ | --------------------- | --------------------------------------------------------- |
| F-01             | auth-and-supabase-scaffold     | Bootstrap projektu Supabase z magic-link auth i schematem gotowym do RLS             | yes                   | Uruchom `/10x-plan auth-and-supabase-scaffold`            |
| F-02             | async-job-runner               | Skonfiguruj Trigger.dev dla asynchronicznych zadań w tle (poza request-path)         | yes                   | Uruchom `/10x-plan async-job-runner` — równolegle z F-01  |
| F-03             | pwa-shell-and-share-target     | Dodaj PWA shell z manifestem Web Share Target i instalacją na Pixel 9                | yes                   | Uruchom `/10x-plan pwa-shell-and-share-target` — równolegle |
| S-01             | first-shared-recipe-fb-text    | Wysyłaj URL FB tekstowy → polskojęzyczny przepis (gwiazda północna, end-to-end)      | no                    | Czeka na F-01, F-02, F-03                                 |
| S-02             | web-blog-recipe-source         | Dodaj źródło bloga WWW przez Firecrawl/Jina                                          | no                    | Czeka na S-01                                             |
| S-03             | fb-reel-recipe-source          | Dodaj źródło FB Reels przez Playwright + Whisper                                     | no                    | Zablokowany przez Otwarte Pytanie #1 (feasibility spike)  |
| S-04             | youtube-recipe-source          | Dodaj źródło YouTube przez yt-dlp + Whisper                                          | no                    | Czeka na S-01                                             |
| S-05             | category-browse                | Dodaj przeglądanie po kategoriach z fixed taxonomy (8 pozycji)                       | no                    | Czeka na S-01                                             |
| S-06             | recipe-search                  | Dodaj wyszukiwanie ILIKE/pg_trgm po tytule i składniku                               | no                    | Czeka na S-01                                             |
| S-07             | error-ux-and-author-alerts     | Dodaj UX błędów z bounded retry (max 3) i email do autora przy trwałym fail          | no                    | Czeka na S-01                                             |

## Otwarte pytania dotyczące mapy drogowej

1. **Feasibility scrapingu Facebook Reels** (z PRD §Open Questions #1). Czy Playwright / yt-dlp / Facebook Graph API są w stanie niezawodnie wyciągnąć audio + screenshot z Reels w MVP, czy FB rate-limity / bot detection zmuszą nas do strategii best-effort tylko? Do potwierdzenia spike'em (1-2 dni) PRZED rozpoczęciem S-03. Właściciel: autor. Blokuje: S-03.
2. **Precyzja konwersji miar US→metric** (z PRD §Open Questions #2). Czy LLM jest wystarczająco dokładny dla niejednoznacznych przypadków, czy potrzebna biblioteka `convert-units` z explicit mapowaniem? Właściciel: autor. Blokuje: nikogo (S-01 i kolejne shipują best-effort, decyzja po pierwszych 10-20 testach EN).
3. **Lista kategorii fixed taxonomy do potwierdzenia z mamą** (z PRD §Open Questions #3). Czy 8 zaproponowanych (Obiady, Zupy, Desery, Śniadania, Przekąski, Wegetariańskie, Napoje, Inne) pokrywa jej typowe wzorce? Może brakuje „Wypieki", „Sałatki", „Słoiki/przetwory"? Właściciel: autor (rozmowa z mamą). Blokuje: nikogo (S-05 shipuje z domyślną listą, refine po rozmowie).
4. **Kanał powiadomienia autora o trwale nieudanym przepisie** (z PRD §Open Questions #4). Email? Slack? Manualny review w bazie? Właściciel: autor. Blokuje: nikogo (decyzja per `/10x-plan` dla S-07).

## Zaparkowane

- **Push notifications („Dodano: <tytuł>")** — FR-011 jest nice-to-have, nie must. Mama wraca do aplikacji ręcznie; wraca w V2 jeśli pojawi się potrzeba.
- **Placeholder „Zapisuję…" w liście przepisów** — FR-010 jest nice-to-have. W MVP wystarczy ekran potwierdzenia „Zapisałem — przepis pojawi się za chwilę"; lista odświeża się przy następnym otwarciu.
- **Wsparcie Instagram + TikTok** — PRD §Non-Goals. Mają trudniejszy share intent i wymagają osobnej pracy nad scraperem; V2.
- **Współdzielenie rodzinne (ZapiszPrzepis Family)** — PRD §Non-Goals. Każdy użytkownik ma własną prywatną skrzynkę; brak zaproszeń, brak wspólnych folderów. V2.
- **Ręczna edycja przepisu po ekstrakcji** — PRD §Non-Goals + Guardrail „zero data entry". Mama ufa AI lub przepis zostaje jak jest.
- **Funkcje wokół gotowania** („co ugotować z tego co mam", lista zakupów, plan tygodnia, voice search) — PRD §Non-Goals. Inna apka, nie MVP.
- **Wyszukiwanie semantyczne** („coś szybkiego", „bez mięsa") — PRD §Non-Goals. W MVP tylko proste tekstowe filtrowanie (FR-013 → S-06). V2.
- **Aplikacja natywna iOS / Android (Capacitor wrap, App Store)** — PRD §Non-Goals. Tylko PWA. Wraca jeśli Web Share Target okaże się zawodny lub gdy celujemy w App Store.
- **Offline-first przeglądanie zapisanych przepisów** — PRD §Non-Goals. PWA cache może działać best-effort, ale nie jest egzekwowane.

## Zrobione

(Puste przy pierwszym generowaniu. `/10x-archive` doda tutaj wpis i zmieni `Status` na `done`, gdy zmiana zostanie zarchiwizowana.)
