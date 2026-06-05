---
project: "ZapiszPrzepis"
version: 2
status: draft
created: 2026-05-28
updated: 2026-06-02
prd_version: 1
main_goal: market-feedback
top_blocker: decisions
---

# Mapa drogowa: ZapiszPrzepis

> Wywiedziono z `context/foundation/prd.md` (v1) + automatycznie zbadana baza kodu (po F-01 ship + Cloudflare Workers migration).
> Edytuj na miejscu; archiwizuj po zastąpieniu (poprzednia wersja w `context/foundation/archive/2026-06-02-roadmap.md`).
> Poniższe wycinki są wymienione w kolejności zależności. Tabela „W skrócie" to indeks.

## Podsumowanie wizji

ZapiszPrzepis to PWA *archive-first* do zapisywania przepisów udostępnianych z mediów społecznościowych (głównie Facebook), zaprojektowana dla jednej niedoświadczonej technicznie użytkowniczki — mamy autora aplikacji. Każdy URL trafia do aplikacji przez systemowy gest „udostępnij" i jest przekształcany w trwałą, polskojęzyczną kopię przepisu (tytuł, składniki jako lista wypunktowana, kroki, zdjęcie/screenshot, znormalizowana etykieta źródła) — niezależną od oryginału.

*Archive-first* — termin produktowy — znaczy: aplikacja przechowuje KOPIĘ przepisu, a nie link do niego, więc gdy oryginał zniknie z Facebooka czy bloga, przepis nadal jest w pełni czytelny.

## Gwiazda przewodnia

**S-01: web-blog-recipe-source** — Mama udostępnia URL bloga kulinarnego i po 1-3 min widzi w aplikacji gotowy, polskojęzyczny przepis (karta na liście + szczegółowy widok detail) — to kamień milowy walidacji rdzennej hipotezy produktu (AI dziś wystarczy do automatycznej ekstrakcji przepisu) na najprawdopodobniejszym wykonalnym źródle.

> *Gwiazda przewodnia* — tutaj — to najmniejszy kompleksowy (end-to-end) wycinek, którego pomyślne dostarczenie udowodniłoby podstawową hipotezę produktu. Wybrany jest blog (a nie FB tekstowy, mimo że FB to dominujące źródło per Vision) ponieważ Firecrawl/Jina dla blogów są dojrzałe i niskie ryzykie technicznie — pozwala to walidować pełen pipeline (share → kolejka → scraping → LLM → DB → display) bez czekania na rozstrzygnięcie Open Question #1 (FB Reels feasibility spike). FB tekstowy (S-02) odblokowuje się natychmiast po S-01 reusując ten sam pipeline.

## W skrócie

| ID    | Change ID                       | Wynik (użytkownik może…)                                                                  | Wymagania wstępne     | Odnośniki PRD                          | Status   |
| ----- | ------------------------------- | ----------------------------------------------------------------------------------------- | --------------------- | -------------------------------------- | -------- |
| F-01  | async-job-runner                | (fundament) Trigger.dev odbiera zadanie i kończy je poza request-path Workera (>10ms CPU) | —                     | FR-003, NFR p95 ≤ 3 min                | done     |
| F-02  | pwa-shell-and-share-target      | (fundament) PWA instalowalna z Web Share Target — Pixel 9 widzi ZapiszPrzepis na liście udostępniania | —                     | FR-002, NFR PWA + Web Share Target     | ready    |
| S-01  | web-blog-recipe-source          | udostępnić URL bloga kulinarnego i po 1-3 min zobaczyć w aplikacji polskojęzyczny przepis (karta + detal) | F-01, F-02            | US-01, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-009 | ready    |
| S-02  | first-shared-recipe-fb-text     | udostępnić URL postu tekstowego Facebook i zobaczyć przepis (drugie źródło, reuse pipeline)    | S-01                  | FR-004                                 | ready    |
| S-03  | youtube-recipe-source           | udostępnić URL YouTube (film lub Short) i zobaczyć przepis (yt-dlp + Whisper)             | S-01                  | FR-004                                 | ready    |
| S-04  | fb-reel-recipe-source           | udostępnić URL Facebook Reel i zobaczyć przepis (z audio przez Whisper)                   | S-01                  | FR-004                                 | blocked  |
| S-05  | category-browse                 | przeglądać przepisy pogrupowane wg kategorii (fixed taxonomy)                             | S-01                  | FR-008                                 | blocked  |
| S-06  | recipe-search                   | wyszukać przepis wpisując fragment tytułu lub składnika                                   | S-01                  | FR-013                                 | ready    |
| S-07  | error-ux-and-author-alerts      | zobaczyć czytelny komunikat błędu z bounded retry (max 3) — autor dostaje powiadomienie o trwałym fail | S-01                  | FR-012, NFR „żadne żądanie nie ginie cicho" | blocked  |

## Strumienie

Pomoc nawigacyjna — grupuje elementy, które współdzielą łańcuch Wymagań wstępnych. Kanoniczna kolejność nadal znajduje się w grafie zależności poniżej; ta tabela to proponowana kolejność czytania w równoległych ścieżkach.

| Strumień | Temat                                  | Łańcuch                                            | Uwaga                                                                                                       |
| -------- | -------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A        | Rdzeń pipeline'u i pierwsza walidacja  | `F-01` / `F-02` → `S-01`                           | Oba fundamenty równolegle, S-01 punkt zbiegu i gwiazda przewodnia. Główny strumień market-feedback. |
| B        | Dodatkowe źródła                       | `S-02` → `S-03` / `S-04` (po `S-01`)               | Każde nowe źródło to wymiana scrapera w pipelinie z S-01. `S-04` zablokowany do rozwiązania Open Q#1 (FB Reels feasibility). |
| C        | Przeglądanie i sieć bezpieczeństwa     | `S-05` / `S-06` / `S-07` (po `S-01`)               | Wszystkie wymagają zapisanych przepisów (S-01). `S-05` zablokowany Open Q#3, `S-07` zablokowany Open Q#4. |

## Baza

Co już jest na miejscu w bazie kodu na dzień `2026-06-02` (automatycznie zbadane + potwierdzone przez użytkownika). Poniższe fundamenty zakładają, że są one obecne i NIE odbudowują ich.

- **Frontend:** obecny — Next.js 16.2.6 (App Router) + Tailwind v4 + TypeScript; `src/app/page.tsx`, `layout.tsx`, `globals.css`.
- **Backend / API:** częściowy — Route Handlers obecne (`src/app/auth/callback/route.ts`) + Server Actions (`src/app/login/actions.ts`); brak własnych domain endpoints (np. `/api/share`, `/api/recipe`). Będą dodawane wewnątrz S-01.
- **Dane:** częściowy — Supabase Postgres + migrations baseline `supabase/migrations/20260529093516_init_auth_helpers.sql` (`pg_trgm` extension + `public.current_user_id()` RLS helper). Brak tabel produkcyjnych (recipes, ingredients, recipe_steps) — będą dodawane w S-01.
- **Uwierzytelnianie:** obecny — F-01 (auth-and-supabase-scaffold) zarchiwizowane: magic-link auth, `src/middleware.ts`, `src/lib/supabase/{server,client,proxy}.ts`, RLS-ready via `public.current_user_id()`. Test coverage (Vitest + Playwright) za pośrednictwem `test-coverage-auth-scaffold`.
- **Wdrożenie / infrastruktura:** obecny — Cloudflare Workers + Static Assets via `@opennextjs/cloudflare` adapter; `wrangler.jsonc`; Workers Builds Git CI/CD; production live na `https://zapiszprzepis.pl` (migrowane z Vercel Hobby w `cloudflare-pages-custom-domain`). Per `context/foundation/infrastructure.md` decyzja + risk register.
- **Obserwowalność:** nieobecny — brak Sentry/Datadog/OTel; tylko `console.error` w Server Actions. Akceptowalne dla 1-user MVP (manual debugging tani).

Warstwy zadeklarowane w `tech-stack.md`, ale jeszcze nie wpięte (każda zostanie wprowadzona przez pierwszy wycinek, który jej potrzebuje, lub przez fundament — zasada progresywnego ujawniania): Trigger.dev (async jobs — F-01), Firecrawl (web scraping — S-01), Playwright (FB scraping fallback — S-02), yt-dlp + Whisper API + FFmpeg (transkrypcja audio — S-03/S-04), OpenAI (ekstrakcja LLM + tłumaczenie + klasyfikacja — S-01), next-pwa (Web Share Target + PWA shell — F-02).

## Fundamenty

### F-01: Async job runner (Trigger.dev)

- **Wynik:** (fundament) projekt Trigger.dev utworzony i powiązany z repo; jeden przykładowy task działa end-to-end — serwer Next.js triggeruje zadanie, Trigger.dev je wykonuje (poza request-path Workera) i odsyła stan zakończenia callback'iem.
- **Change ID:** async-job-runner
- **Odnośniki PRD:** FR-003 (potwierdzenie odebrania < 1s + asynchroniczne przetwarzanie 1-3 min), NFR „typowy czas ≤ 3 minuty p95"
- **Odblokowuje:** S-01 (FR-003 wymusza, by ekstrakcja przepisu była poza request-path — Cloudflare Workers ma 10ms CPU limit per invocation na free tier + ~30s HTTP wall time, ani jedno nie pasuje do 1-3 min budżetu). Również odblokowuje wszystkie kolejne wycinki źródłowe (S-02..S-04), które używają tej samej kolejki.
- **Wymagania wstępne:** —
- **Równolegle z:** F-02
- **Blokady:** —
- **Niewiadome:**
  - Czy Trigger.dev SDK działa stabilnie z workerd runtime (Cloudflare Workers nie Node)? Właściciel: autor. Blokuje: nie. Decyzja po /10x-research (planowane przed /10x-plan).
  - Czy webhook callback z Trigger.dev z powrotem do Workera ma stabilny URL + secret pattern dla `wrangler.jsonc` env vars? Właściciel: autor. Blokuje: nie. Standard pattern, do potwierdzenia.
- **Ryzyko:** Trigger.dev jest mniej znany niż natywne Cloudflare Queues, więc krzywa nauki narzędzia jest realna; wybór jest podyktowany NFR (Cloudflare Workers + Queues bez Durable Objects ma własne ograniczenia czasu wykonania; Trigger.dev daje pełne 1-3 min). Pułapka: nie próbuj uruchamiać scrapera w samym Workerze — 30s HTTP timeout to brutal.
- **Status:** done

### F-02: PWA shell + Web Share Target

- **Wynik:** (fundament) PWA jest instalowalna na ekranie głównym Pixel 9 (manifest + service worker + ikony); pole `share_target` w manifeście wskazuje endpoint Next.js; gdy mama klika „Udostępnij" w dowolnej aplikacji, ZapiszPrzepis pojawia się na liście odbiorców.
- **Change ID:** pwa-shell-and-share-target
- **Odnośniki PRD:** FR-002 (systemowy gest „Udostępnij" z dowolnej aplikacji), NFR „PWA instalowalna + Web Share Target API na dwóch najnowszych Chrome i Edge na Androidzie", Guardrail „działa na jej Pixel 9"
- **Odblokowuje:** S-01 (bez Web Share Target żaden URL nie trafi do aplikacji — to JEDYNY kanał wejścia w MVP, brak ręcznego wklejania); odblokowuje również weryfikację Guardraila „działa na Pixel 9" przed jakimkolwiek pełnym wycinkiem.
- **Wymagania wstępne:** —
- **Równolegle z:** F-01
- **Blokady:** —
- **Niewiadome:**
  - Czy `next-pwa` w Next.js 16 App Router stabilnie generuje manifest + SW dla Cloudflare Workers static asset serving? Właściciel: autor. Blokuje: nie. Do potwierdzenia w /10x-research lub spike.
  - Czy share_target POST z Facebook app (vs Chrome) działa konsystentnie? Właściciel: autor. Blokuje: nie. Realny test wymaga deployed PWA.
- **Ryzyko:** Web Share Target API ma wsparcie tylko w Chrome/Edge na Androidzie (nie iOS Safari), ale PRD `target_scale.users: small` + konkretne urządzenie = Pixel 9 Android sprawia, że ograniczenie jest akceptowalne. Pułapka: integracja z `next-pwa` w Next.js 16 App Router + Cloudflare Workers static assets ma znane chropowatości (service worker scope, manifest cache).
- **Status:** ready

## Wycinki

### S-01: Pierwszy udostępniony przepis z bloga WWW (gwiazda przewodnia, end-to-end)

- **Wynik:** Mama udostępnia URL bloga kulinarnego przez systemowy gest „Udostępnij → ZapiszPrzepis", widzi w < 1s komunikat „Zapisałem — przepis pojawi się za chwilę", a po 1-3 minutach (gdy wraca do aplikacji) na liście jest karta nowego przepisu z polskim tytułem i miniaturą; po jej kliknięciu widzi pełny przepis: zdjęcie, składniki jako lista wypunktowana (UL), kroki ponumerowane, znormalizowana etykieta źródła („Blog: <domena>"), opcjonalny przycisk „Otwórz oryginał".
- **Change ID:** web-blog-recipe-source
- **Odnośniki PRD:** US-01, FR-002 (share intent), FR-003 (ack < 1s + async 1-3 min), FR-004 (blog WWW — jedno źródło z czterech wymienionych), FR-005 (tłumaczenie EN→PL gdy oryginał po angielsku + konwersja miar metrycznych), FR-006 (trwała kopia z UL składników), FR-007 (lista uporządkowana od najnowszych — wersja minimalna), FR-009 (pojedynczy przepis pełny — wersja podstawowa)
- **Wymagania wstępne:** F-01, F-02
- **Równolegle z:** —
- **Blokady:** —
- **Niewiadome:**
  - Precyzja konwersji miar US→metric (PRD Open Q#2): czy LLM jest wystarczająco dokładny dla niejednoznacznych przypadków („1 cup of flour" = 120-150g w zależności od mąki), czy potrzebna biblioteka `convert-units` z explicit mapowaniem? Właściciel: autor. Blokuje: nie. Decyzja po pierwszych 10-20 testach EN; ship best-effort, refine.
  - Czy Firecrawl/Jina dają wystarczającą jakość dla polskich blogów kulinarnych (mieszane HTML, dużo embedded mediów, czasem heavy JS)? Właściciel: autor. Blokuje: nie. Spike w trakcie /10x-plan.
- **Ryzyko:** najwięcej koncentruje ryzyka — pierwszy raz pipeline (share → kolejka → scraping → LLM → DB → display) odpala się end-to-end. Blogs są jednak najmniej ryzykownym source: Firecrawl/Jina są dojrzałe, większość blogów wystawia clean HTML z og:image. Pułapka: blogi z heavy JS rendering (single-page apps) mogą wymagać fallback do Playwright; sekwencjonowane jako pierwszy source bo daje mamie szybko walidację bez FB scraping risk.
- **Status:** ready

### S-02: Źródło Facebook tekstowy (drugie źródło)

- **Wynik:** Mama udostępnia URL postu tekstowego z Facebooka (typowo grupy kulinarne) i widzi przepis w aplikacji tak samo jak dla bloga WWW (ten sam pipeline, inny scraper na początku).
- **Change ID:** first-shared-recipe-fb-text
- **Odnośniki PRD:** FR-004 (Facebook posty tekstowe jako wspierane źródło)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-03, S-04, S-05, S-06, S-07
- **Blokady:** —
- **Niewiadome:**
  - Czy `og:description` + inline HTML z FB posts wystarcza dla typowych grup kulinarnych, czy treść jest często w obrazkach (które wymagają OCR)? Właściciel: autor. Blokuje: nie. Spike po ship S-01.
  - Czy FB rate-limit per IP nie zablokuje scrapingu szybko (Workers nie ma rotacji IP)? Właściciel: autor. Blokuje: nie. Best-effort fallback do og:image + tytuł + URL z notą.
- **Ryzyko:** FB scrapuje tekstowe posty łatwiej niż Reels (treść jest w og:description / inline HTML), ale rate-limity FB są realne; fallback best-effort: przy niepełnej ekstrakcji zapisać og:image + tytuł + URL, oznaczyć przepis nutką „niekompletna ekstrakcja" (zgodnie z FR-004 best-effort i NFR „żadne żądanie nie ginie cicho").
- **Status:** ready

### S-03: Źródło YouTube (film lub Short, audio przez Whisper)

- **Wynik:** Mama udostępnia URL YouTube (film lub Short) i widzi przepis z pełną treścią pobraną z transkrypcji audio (Whisper).
- **Change ID:** youtube-recipe-source
- **Odnośniki PRD:** FR-004 (YouTube + Shorts jako wspierane źródło)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-04, S-05, S-06, S-07
- **Blokady:** —
- **Niewiadome:**
  - Jakość transkrypcji Whisper API na polskich akcentach kucharzy YouTube — zwykle akceptowalna, ale bywają przypadki z zaszumionym wejściem dla LLM ekstrakcji. Właściciel: autor. Blokuje: nie. Test na 10 polskich + 10 angielskich filmach po ship S-01.
  - Koszt Whisper API per minute video vs NFR ≤ 10 zł/m-c — ~50 przepisów * średnio 10 min audio * $0.006/min = ~$3/m-c (~12 zł, tight). Właściciel: autor. Blokuje: nie. Mitigation: yt-dlp pobrać tylko jeśli zaczyna od konkretnego heurystyka „ma składniki/instrukcje" — albo tańszy Whisper.cpp self-hosted.
- **Ryzyko:** yt-dlp jest dojrzały i niezawodny; główne ryzyko to jakość transkrypcji + koszt. Pułapka: filmy długie (>30 min vlog z przepisem na końcu) wymagają mądrego cięcia segmentu z przepisem, inaczej Whisper bill ucieka.
- **Status:** ready

### S-04: Źródło Facebook Reels (audio + screenshot)

- **Wynik:** Mama udostępnia URL Facebook Reels (lub video FB) i widzi przepis — gdy ekstrakcja audio przez Whisper się powiedzie, treść jest pełna; w trybie best-effort (rate-limit FB) zapisany jest screenshot + tytuł + URL z notatką „niekompletna ekstrakcja".
- **Change ID:** fb-reel-recipe-source
- **Odnośniki PRD:** FR-004 (FB Reels/Video jako wspierane źródło, ze strategią best-effort z Sokratesa)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-03, S-05, S-06, S-07
- **Blokady:** Open Question #1 z map drogowej (skopiowane z PRD): feasibility scrapingu Facebook Reels — czy Playwright / yt-dlp / FB Graph API są w stanie niezawodnie wyciągnąć audio + screenshot z Reels w MVP? Do potwierdzenia spike'em (1-2 dni) PRZED rozpoczęciem implementacji wycinka.
- **Niewiadome:**
  - Wynik spike'a feasibility FB Reels (Open Q#1) — Właściciel: autor. Blokuje: tak. Bez tej odpowiedzi nie da się zaplanować — strategia best-effort vs full scraping zmienia rozmiar pracy istotnie.
- **Ryzyko:** najwyższe spośród źródeł — FB agresywnie blokuje scraping; może okazać się, że po stronie tła agentowego trzeba zmieniać IP, rotować user-agenty, akceptować częste fail i polegać prawie wyłącznie na og:image z share_target callback (nie na faktycznym Reels content).
- **Status:** blocked

### S-05: Przeglądanie po kategoriach (fixed taxonomy)

- **Wynik:** Mama może otworzyć kategorię (Obiady / Zupy / Desery / Śniadania / Przekąski / Wegetariańskie / Napoje / Inne — lub inna lista po Open Q#3) i zobaczyć tylko przepisy z tej kategorii — kategoria była przypisana automatycznie przez LLM podczas ekstrakcji w S-01..S-04.
- **Change ID:** category-browse
- **Odnośniki PRD:** FR-008 (przeglądanie wg fixed taxonomy kategorii przypisanych automatycznie przez AI)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-03, S-04, S-06, S-07
- **Blokady:** Open Question #3 z map drogowej (skopiowane z PRD): lista kategorii do potwierdzenia z mamą — czy proponowane 8 (Obiady, Zupy, Desery, Śniadania, Przekąski, Wegetariańskie, Napoje, Inne) pokrywa jej typowe wzorce, czy brakuje „Wypieki", „Sałatki", „Słoiki/przetwory"?
- **Niewiadome:**
  - Wynik rozmowy z mamą o lista kategorii (Open Q#3) — Właściciel: autor (rozmowa z mamą). Blokuje: tak. Ship z domyślną 8-pozycyjną listą wymagałby refactor jeśli mama doda kategorie później.
- **Ryzyko:** mało ryzyka technicznego (filtr WHERE category = X); główne ryzyko produktowe to spójność klasyfikacji LLM — ten sam typ przepisu może raz trafić do „Obiady", raz do „Wegetariańskie"; pomaga fixed taxonomy w prompt (już w PRD) ale jakość trzeba audytować na pierwszych ~20 przepisach.
- **Status:** blocked

### S-06: Wyszukiwanie po tytule i składniku

- **Wynik:** Mama wpisuje fragment tytułu lub nazwy składnika w polu wyszukiwania na liście przepisów i widzi wyniki filtrowane natychmiast.
- **Change ID:** recipe-search
- **Odnośniki PRD:** FR-013 (proste tekstowe wyszukiwanie po tytule i składniku — ILIKE / pg_trgm)
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-03, S-04, S-05, S-07
- **Blokady:** —
- **Niewiadome:** —
- **Ryzyko:** najmniej technicznego ryzyka — ILIKE wystarczy dla ~100 przepisów; `pg_trgm` (już zainstalowany w bazie F-01) gdy wyniki LIKE okażą się zbyt sztywne (np. odmiana „mąka" vs „mąki"). Pułapka UX: wyszukiwanie po składniku wymaga rozkładania JSON-owego pola składników na osobne wiersze (lub indeksu GIN) — decyzja o kształcie schematu w S-01 wpływa na łatwość implementacji tutaj.
- **Status:** ready

### S-07: Obsługa błędów + bounded retry + powiadomienie autora

- **Wynik:** Gdy ekstrakcja przepisu się nie powiedzie (niewspierane źródło, video za długie, FB zablokował dostęp), mama widzi czytelny komunikat zamiast cichej awarii; przycisk „spróbuj ponownie" działa maksymalnie 3 razy, potem znika, zostaje tylko „usuń"; autor dostaje powiadomienie (kanał TBD per Open Q#4) o trwale nieudanym przepisie z URL-em i komunikatem błędu.
- **Change ID:** error-ux-and-author-alerts
- **Odnośniki PRD:** FR-012 (czytelny komunikat + bounded retry max 3 + powiadomienie autora), NFR „żadne udostępnione żądanie nie ginie cicho"
- **Wymagania wstępne:** S-01
- **Równolegle z:** S-02, S-03, S-04, S-05, S-06
- **Blokady:** Open Question #4 z map drogowej (skopiowane z PRD): kanał powiadomienia autora o nieudanym przepisie — email? Slack? Manualny review w bazie?
- **Niewiadome:**
  - Wynik decyzji o kanale powiadomienia (Open Q#4) — Właściciel: autor. Blokuje: tak. Domyślnie email (najprostszy), ale Slack daje natychmiastowy push do telefonu autora; decyzja per /10x-plan.
- **Ryzyko:** mało ryzyka technicznego (counter w DB + transactional email/webhook). Pułapka UX: tekst komunikatu błędu musi być zrozumiały dla mamy (nie „HTTP 429 Too Many Requests", ale „Facebook nas chwilowo zablokował — spróbuj za chwilę"). Sekwencjonowane po stabilnym pipelinie z S-01, bo dopiero wtedy znamy realny katalog trybów awarii.
- **Status:** blocked

## Przekazanie backlogu

| ID mapy drogowej | Change ID                      | Sugerowany tytuł problemu                                                            | Gotowe do `/10x-plan` | Uwagi                                                     |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------------------ | --------------------- | --------------------------------------------------------- |
| F-01             | async-job-runner               | Skonfiguruj Trigger.dev dla asynchronicznych zadań w tle (poza request-path Workera) | yes                   | Już utworzony folder; uruchom `/10x-research async-job-runner` |
| F-02             | pwa-shell-and-share-target     | Dodaj PWA shell z manifestem Web Share Target i instalacją na Pixel 9                | yes                   | Uruchom `/10x-plan pwa-shell-and-share-target` — równolegle z F-01 |
| S-01             | web-blog-recipe-source         | Wysyłaj URL bloga WWW → polskojęzyczny przepis (gwiazda przewodnia, end-to-end)      | no                    | Czeka na F-01, F-02                                       |
| S-02             | first-shared-recipe-fb-text    | Dodaj źródło Facebook tekstowy (drugie źródło, reuse pipeline z S-01)               | no                    | Czeka na S-01                                             |
| S-03             | youtube-recipe-source          | Dodaj źródło YouTube przez yt-dlp + Whisper                                          | no                    | Czeka na S-01                                             |
| S-04             | fb-reel-recipe-source          | Dodaj źródło FB Reels przez Playwright + Whisper                                     | no                    | Zablokowany przez Open Question #1 (feasibility spike)    |
| S-05             | category-browse                | Dodaj przeglądanie po kategoriach z fixed taxonomy                                   | no                    | Zablokowany przez Open Question #3 (rozmowa z mamą)       |
| S-06             | recipe-search                  | Dodaj wyszukiwanie ILIKE/pg_trgm po tytule i składniku                               | no                    | Czeka na S-01                                             |
| S-07             | error-ux-and-author-alerts     | Dodaj UX błędów z bounded retry (max 3) i powiadomienie autora przy trwałym fail     | no                    | Czeka na S-01 + Open Q#4 (kanał powiadomienia)            |

## Otwarte pytania dotyczące mapy drogowej

1. **Feasibility scrapingu Facebook Reels** (z PRD §Open Questions #1). Czy Playwright / yt-dlp / Facebook Graph API są w stanie niezawodnie wyciągnąć audio + screenshot z Reels w MVP, czy FB rate-limity / bot detection zmuszą nas do strategii best-effort tylko? Do potwierdzenia spike'em (1-2 dni) PRZED rozpoczęciem S-04. Właściciel: autor. Blokuje: S-04.
2. **Lista kategorii fixed taxonomy do potwierdzenia z mamą** (z PRD §Open Questions #3). Czy 8 zaproponowanych (Obiady, Zupy, Desery, Śniadania, Przekąski, Wegetariańskie, Napoje, Inne) pokrywa jej typowe wzorce? Może brakuje „Wypieki", „Sałatki", „Słoiki/przetwory"? Właściciel: autor (rozmowa z mamą). Blokuje: S-05.
3. **Kanał powiadomienia autora o trwale nieudanym przepisie** (z PRD §Open Questions #4). Email? Slack? Manualny review w bazie? Właściciel: autor. Blokuje: S-07.

## Zaparkowane

- **Push notifications („Dodano: <tytuł>")** — FR-011 jest nice-to-have, nie must. Mama wraca do aplikacji ręcznie; wraca w V2 jeśli pojawi się potrzeba.
- **Placeholder „Zapisuję…" w liście przepisów** — FR-010 jest nice-to-have. W MVP wystarczy ekran potwierdzenia „Zapisałem — przepis pojawi się za chwilę"; lista odświeża się przy następnym otwarciu.
- **Wsparcie Instagram + TikTok** — PRD §Non-Goals. Mają trudniejszy share intent i wymagają osobnej pracy nad scraperem; V2.
- **Współdzielenie rodzinne (ZapiszPrzepis Family)** — PRD §Non-Goals. Każdy użytkownik ma własną prywatną skrzynkę; brak zaproszeń, brak wspólnych folderów. V2.
- **Ręczna edycja przepisu po ekstrakcji** — PRD §Non-Goals + Guardrail „zero data entry". Mama ufa AI lub przepis zostaje jak jest.
- **Funkcje wokół gotowania** („co ugotować z tego co mam", lista zakupów, plan tygodnia, voice search) — PRD §Non-Goals. Inna apka, nie MVP.
- **Semantic search** („coś szybkiego", „bez mięsa") — PRD §Non-Goals. W MVP tylko proste tekstowe filtrowanie (FR-013 → S-06). V2.
- **Aplikacja natywna iOS / Android (Capacitor wrap, App Store)** — PRD §Non-Goals. Tylko PWA. Wraca jeśli Web Share Target okaże się zawodny lub gdy celujemy w App Store.
- **Offline-first przeglądanie zapisanych przepisów** — PRD §Non-Goals. PWA cache może działać best-effort, ale nie jest egzekwowane.

## Zrobione

- **F-XX: (fundament — historyczne F-01 v1) projekt Supabase utworzony i powiązany; mama (po jednorazowym setupie autora) dostaje magic-link, klika go i jest zalogowana z sesją długo-żyjącą; middleware Next.js chroni trasy zalogowane; schema gotowa do dodania pierwszej tabeli przez S-01 z RLS per `auth.uid()`.** — Zarchiwizowano 2026-06-02 → `context/archive/2026-05-28-auth-and-supabase-scaffold/`. Lekcja: `context/foundation/lessons.md` rules #1-#7 (review fixes + Supabase allowlist drift pattern). Również zarchiwizowano change `cloudflare-pages-custom-domain` → `context/archive/2026-05-31-cloudflare-pages-custom-domain/` (Vercel → Cloudflare Workers migracja, zaktualizowała `tech-stack.md` + `infrastructure.md`) oraz `test-coverage-auth-scaffold` (planned dla archiwizacji po merge PR #8).

> Uwaga: ta sekcja jest historycznie pre-populowana z pre-refresh zarchiwizowanych change'y (F-01 + dwa supporting change'e). Normalnie `/10x-archive` jest jedynym autorem tej sekcji; przy regeneracji roadmap.md ten wpis zachowano dla widoczności, że F-01 ship + migration są ground-truth state of master, nie planned work. Future `/10x-archive` doda kolejne wpisy w tym formacie.
