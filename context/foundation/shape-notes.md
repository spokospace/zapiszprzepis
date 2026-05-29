---
project: "ZapiszPrzepis"
version: 1
context_type: greenfield
created: 2026-05-28
updated: 2026-05-28
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "persona scope"
      decision: "konkretna nazwana osoba — mama autora aplikacji"
    - topic: "pain categories"
      decision: "dane uwięzione gdzieś (znikające treści) + tarcie w przepływie pracy + zakładki/Reels kasowane z czasem"
    - topic: "founder insight"
      decision: "AI (LLM + transkrypcja audio) dopiero teraz jest na tyle dobre, by jednym gestem 'udostępnij' ekstrahować przepis z dowolnego źródła; status quo (Pinterest, FB save, Chrome bookmarks) jest 'link-first', brak rozwiązań 'archive-first' dla przepisów"
    - topic: "auth strategy"
      decision: "passwordless magic link — jednorazowy setup, brak haseł, brak ekranów logowania na co dzień"
    - topic: "multi-tenancy in MVP"
      decision: "osobne prywatne skrzynki na użytkownika; brak ról, brak współdzielenia; rodzinne udostępnianie zostaje na V2"
    - topic: "MVP scope vs timeline"
      decision: "użytkownik świadomie wybiera pełen przepływ (z Whisper + push) w 4 tygodnie, akceptując sustained-effort cost — bez cięcia zakresu"
    - topic: "success criteria"
      decision: "Primary = działający share→save flow; Secondary = mama używa 30 dni bez pomocy; Guardrails = trwała kopia + zero data entry + < 1s potwierdzenie + działa na jej Pixel 9 (30s SLA usunięty — zapis jest asynchroniczny)"
    - topic: "save SLA model"
      decision: "asynchroniczne przetwarzanie: < 1s na potwierdzenie odebrania, typowy czas 1-3 min do gotowego przepisu; mama nie czeka przy ekranie"
    - topic: "ingredient display"
      decision: "lista wypunktowana (UL), BEZ interaktywnego odhaczania; AI reformatuje prozę na listę"
    - topic: "categories"
      decision: "fixed taxonomy (Obiady/Zupy/Desery/Śniadania/Przekąski/Wegetariańskie/Napoje/Inne), LLM wybiera jedną; lista do potwierdzenia z mamą"
    - topic: "push notifications in MVP"
      decision: "nice-to-have, NIE must-have; mama wraca do aplikacji ręcznie i widzi gotowy przepis; push wraca w V2"
    - topic: "error retry policy"
      decision: "max 3 próby 'spróbuj ponownie'; po 3 nieudanych pozostaje tylko 'usuń', autor jest powiadamiany emailem o permanentnym failure"
    - topic: "search"
      decision: "dodane FR-013: proste tekstowe wyszukiwanie po tytule i składniku (ILIKE/pgsearch); semantic search ('coś szybkiego', 'bez mięsa') wraca w V2"
    - topic: "domain rule"
      decision: "automatyczna transformacja URL w trwały, strukturalny, polskojęzyczny przepis (ekstrakcja + normalizacja + archiwizacja w jednym przepływie) — nie CRUD"
    - topic: "cost budget"
      decision: "miesięczny koszt eksploatacji ≤ 10 zł dla typowego użytkownika (~50 przepisów/m-c); wymusza ostrożny wybór modelu LLM/Whisper API i kompresję storage"
    - topic: "in-app processing feedback"
      decision: "FR-010 (placeholder w liście) przesunięte do nice-to-have; w MVP po share PWA pokazuje 'Zapisałem — przepis pojawi się za chwilę' (single screen), mama wraca do aplikacji i widzi gotowy przepis. Bez placeholdera w liście, bez push (FR-011 też nice-to-have)."
    - topic: "product surface"
      decision: "PWA (web-app) na Androidzie; Capacitor wrap to V2 jeśli Web Share Target okaże się zawodny lub gdy chcemy iOS"
  frs_drafted: 13
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 4
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Mama autora aplikacji codziennie ogląda na telefonie przepisy w mediach społecznościowych — głównie Facebook (posty i Reels), rzadziej YouTube, TikTok, blogi kulinarne. Chce zachować te, które wyglądają smacznie, na "kiedyś tam ugotuję". Próbuje korzystać z zakładek przeglądarki i opcji "Zapisz" na Facebooku, ale po kilku tygodniach lub miesiącach większość zachowanych linków przestaje działać: posty są usuwane, grupy kulinarne znikają, Reels są kasowane przez autorów, blogi gasną. Codziennie traci kolejne przepisy, a istniejące "zapisane" treści są dla niej praktycznie bezużyteczne — i nie radzi sobie technicznie z żadnym alternatywnym workflow (kopiowanie do notatek, ręczne wpisywanie składników, zarządzanie folderami).

Wgląd, na którym opiera się produkt: AI (LLM do ekstrakcji + Whisper do transkrypcji audio z filmów) jest dopiero teraz na tyle dobre i tanie, by jednym gestem systemowym "udostępnij" wyciągnąć przepis z dowolnego źródła (tekst, Reel, film) i zapisać jego trwałą **lokalną kopię** — tytuł, składniki, kroki, zdjęcie/screenshot, transkrypcję, oryginalny URL. Pinterest, Facebook Save, zakładki Chrome i istniejące aplikacje kulinarne są "link-first" — wszystkie polegają na tym, że źródło nadal istnieje. Ten produkt jest "archive-first": zapisuje KOPIĘ przepisu, a nie odnośnik do niego.

## User & Persona

Główna persona: **mama autora aplikacji**. Codzienna użytkowniczka smartfonu (Android), ale niedoświadczona technicznie — nie wpisuje ręcznie składników, nie wypełnia formularzy, nie zakłada kont, nie zarządza folderami ani tagami. Wzorzec dotarcia do produktu: ogląda przepis na telefonie (post / Reel / film), klika systemowe **„Udostępnij"** — tak jak udostępnia zdjęcia na WhatsApp lub Messenger — wybiera „ZapiszPrzepis" z listy aplikacji, i nie robi nic więcej. Cały dalszy proces (rozpoznanie źródła, pobranie zdjęcia/transkrypcja audio, ekstrakcja składników i kroków, tłumaczenie na polski jeśli oryginał był po angielsku, przypisanie kategorii) musi się wydarzyć automatycznie. Jej pierwsze zetknięcie z produktem nie powinno wymagać żadnego onboardingu poza instalacją PWA.

## Access Control

Uwierzytelnianie typu **passwordless magic link** (jednorazowy link aktywacyjny wysłany e-mailem). Setup mamy wykonuje autor aplikacji raz: wpisuje jej adres e-mail, klika link na jej telefonie, sesja jest długo-żyjąca i nie wygasa w trakcie normalnego użytkowania. Mama nigdy nie widzi ekranu logowania ani formularza rejestracji.

Każdy użytkownik ma **swoją osobną, prywatną skrzynkę przepisów**. Brak ról (administrator / członek / gość), brak współdzielenia, brak grup rodzinnych. Płaski model: jeden e-mail → jedno konto → jedna kolekcja przepisów widoczna tylko dla niej. Współdzielenie rodzinne ("ZapiszPrzepis Family") wyraźnie poza zakresem MVP — wraca jako V2.

Nieuwierzytelniony użytkownik, który trafi na URL aplikacji, widzi tylko ekran „Wpisz e-mail, by otrzymać link" — żadnej treści przepisów, żadnego katalogu publicznego.

## Success Criteria

### Primary

- Mama otrzymuje link do przepisu na Facebooku (post, Reel, Story) lub na innym wspieranym źródle (blog kulinarny, YouTube), klika systemowe **„Udostępnij" → ZapiszPrzepis** i w ciągu ≤ 30 sekund widzi w aplikacji nowy przepis z tytułem, zdjęciem/screenshotem, składnikami, krokami i kategorią — bez wpisywania jakichkolwiek danych.

### Secondary

- Mama używa aplikacji **bez pomocy autora przez ≥ 30 dni z rzędu** (samodzielnie zapisuje przepisy, samodzielnie z nich gotuje).

### Guardrails

- **Trwałość kopii** — gdy oryginalne źródło zniknie (post FB usunięty, blog wygasł, Reel skasowany), zapisany przepis nadal jest w pełni dostępny w aplikacji (treść, zdjęcie/screenshot, transkrypcja).
- **Zero ręcznego wprowadzania danych** — mama NIGDY nie musi wpisywać tekstu poza jednorazowym setupem (autor robi go za nią). Brak formularzy do uzupełniania składników, brak wymuszania korekt po ekstrakcji.
- **Potwierdzenie przyjęcia w < 1 sekundę** — gdy mama kliknie „Udostępnij → ZapiszPrzepis", aplikacja musi natychmiast pokazać „Zapisuję…" i pozwolić jej zamknąć ekran (przetwarzanie jest asynchroniczne, ale potwierdzenie odebrania natychmiastowe).
- **Działa na jej Google Pixel 9 (Android)** — PWA + Web Share Target API musi być zainstalowalne i stabilne na tym konkretnym urządzeniu.

## Timeline acknowledgment

Potwierdzono dnia 2026-05-28: 4-tygodniowe MVP wymaga stałego zaangażowania — wieczornej pracy i części weekendów; użytkownik zaakceptował koszt świadomie ("będę pracował więcej i spał mniej, ale zrobimy to").

## Functional Requirements

### Konto i autoryzacja

- FR-001: Mama (po jednorazowym setupie autora) korzysta z aplikacji bez konieczności logowania się przy każdym otwarciu — sesja jest długo-żyjąca. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: „sesja może wygasnąć po update PWA lub wyczyszczeniu cache — mama nagle bez dostępu". Rozwiązanie: FR utrzymane; dodaj guard w implementacji (silent refresh tokenu, backup magic link na email autora gdy sesja jednak padnie) — to nie zmienia FR, tylko ścieżkę implementacji.

### Zapisywanie przepisów

- FR-002: Mama może z dowolnej aplikacji na telefonie (FB, Chrome, Instagram, YouTube) udostępnić link do ZapiszPrzepis przez systemowy gest „Udostępnij" — tak jak udostępnia zdjęcie na WhatsApp. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: „niektóre aplikacje (Instagram, TikTok) udostępniają link wewnętrzny, którego backend nie otworzy". Rozwiązanie: FR utrzymane dla zakresu FR-004 (FB + YouTube + WWW); Instagram i TikTok są niewspierane w MVP (patrz Non-Goals). Dla linków wewnętrznych FB — fallback do screenshotu + og:image, ale tylko best-effort.
- FR-003: Po udostępnieniu linku aplikacja przyjmuje go natychmiast (potwierdza odebranie w < 1 sekundę), a samo przetwarzanie odbywa się asynchronicznie — typowo gotowe w ciągu 1-3 minut. Mama nie musi siedzieć przy ekranie; powiadomienie push lub kolejne otwarcie aplikacji pokaże gotowy przepis. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: „realny SLA u mamy to 'gotowe gdy wraca do aplikacji', nie 30 sekund przy ekranie". Rozwiązanie: FR-003 PRZEFORMUŁOWANE — twardy 30s SLA usunięty, model jest asynchroniczny. Również usunięty odpowiedni Guardrail z Success Criteria.
- FR-004: Aplikacja obsługuje co najmniej te źródła: strony WWW (blogi kulinarne), posty Facebook (tekstowe), Facebook Reels/Video, YouTube (filmy + Shorts). Priorytet: must-have
  > Sokrates: Rozważono kontrargument: „Facebook agresywnie blokuje scraping — Reels mogą być niewykonalne w MVP". Rozwiązanie: FR utrzymane jako must-have, ale ze strategią best-effort dla FB Reels (gdy scraping zawodzi, zapisz og:image + tytuł + URL, oznacz przepis jako „nie udało się wyciągnąć pełnej treści"). Feasibility FB Reels = Open Question #1 do potwierdzenia przed startem developmentu.
- FR-005: Aplikacja rozpoznaje przepisy w języku angielskim, tłumaczy je na polski i adaptuje miary do metrycznych (cups → ml/g, °F → °C, składniki US → polskie odpowiedniki). Priorytet: must-have
  > Sokrates: Rozważono kontrargument: „konwersja miar US→metric jest niedokładna (1 cup of flour zależy od tego co sypiemy, 120-150g) — może zniszczyć przepis". Rozwiązanie: FR utrzymane; w detail view składnik konwertowany pokazuje się z notatką „≈" przy wartościach niedokładnych. Precyzja konwersji vs. czystość UX = Open Question #2.

### Trwałość

- FR-006: Każdy zapisany przepis pozostaje w pełni czytelny (tytuł, zdjęcie/screenshot, **składniki w postaci listy wypunktowanej**, kroki, opcjonalnie transkrypcja) nawet po usunięciu oryginalnego źródła. AI przeredagowuje surowy tekst tak, by lista składników była rzeczywistą listą (UL) — nie zdaniem w prozie. Priorytet: must-have
  > Sokrates: Użytkownik dodał uzupełnienie: „kopia będzie przeredagowana pod AI, aby poza opisem była czytelna lista (wypunktowana) składników". Rozwiązanie: FR-006 ROZSZERZONE — explicit wymóg reformatowania składników jako lista UL; bez interaktywnej checklisty (potwierdzone w Sokratesie do FR-009: „nie robimy odhaczania").

### Przeglądanie

- FR-007: Mama może otworzyć aplikację i zobaczyć listę swoich przepisów uporządkowaną od najnowszych. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: „po 100 przepisach lista chronologiczna jest niewyszukiwalna — mama nie znajdzie przepisu sprzed 3 miesięcy". Rozwiązanie: FR-007 utrzymane jako domyślna lista; ale DODANO nowe FR-013 (wyszukiwanie po tytule i składniku) jako must-have.
- FR-008: Mama może przeglądać przepisy pogrupowane w **stałej taksonomii kategorii** przypisanych automatycznie przez AI (kategoria wybierana z fixed listy: Obiady, Zupy, Desery, Śniadania, Przekąski, Wegetariańskie, Napoje, Inne). Priorytet: must-have
  > Sokrates: Rozważono kontrargument: „LLM zwraca niespójne kategorie — ten sam typ przepisu może raz trafić do 'Obiady', raz do 'Makarony'". Rozwiązanie: FR-008 PRZEFORMUŁOWANE — fixed taxonomy zamiast free-form. LLM dostaje listę w prompt i wybiera jedną kategorię. Konkretna lista kategorii do potwierdzenia z mamą = Open Question #3.
- FR-009: Mama może otworzyć pojedynczy przepis i zobaczyć: tytuł po polsku, zdjęcie/screenshot, opis (krótki), **składniki jako klasyczna lista wypunktowana** (bez interaktywnego odhaczania), kroki ponumerowane, znormalizowaną etykietę źródła (np. „Facebook Reel", „YouTube") i opcjonalny przycisk „Otwórz oryginał". Priorytet: must-have
  > Sokrates: Użytkownik skorygował: „nie robimy odhaczania, po prostu jeśli opis ma składniki musimy je wyświetlać klasycznie jako lista, a nie jako zwykłe zdania tekstowe". Rozwiązanie: usunięto checklist behavior; składniki to plain UL.

### Wyszukiwanie

- FR-013: Mama może wyszukać przepis w aplikacji wpisując fragment tytułu lub nazwy składnika — wyniki są filtrowane natychmiast. Priorytet: must-have
  > Sokrates: FR dodane jako rezultat wyzwania na FR-007 — proste tekstowe filtrowanie (ILIKE / pgsearch), nie semantic search. Semantyczne wyszukiwanie ("coś szybkiego", "bez mięsa") wraca jako V2.

## Business Logic

Dla każdego udostępnionego URL aplikacja samodzielnie ekstrahuje, normalizuje (język + miary + strukturę) i archiwizuje przepis tak, by oryginał mógł zniknąć bez utraty danych.

Wejście dla tej reguły to **jeden URL** — wszystko, co użytkownik widzi na ekranie udostępniania (Facebook post, Reel, link do bloga, film z YouTube). Wyjście to **strukturalny obiekt przepisu** widoczny dla użytkownika: tytuł po polsku, lista składników w postaci listy wypunktowanej, ponumerowane kroki, zdjęcie lub screenshot, znormalizowana etykieta źródła i kategoria z fixed taxonomy.

Reguła obejmuje cztery decyzje domenowe: (a) **klasyfikację** — przypisanie przepisu do jednej z ośmiu kategorii (Obiady, Zupy, Desery, Śniadania, Przekąski, Wegetariańskie, Napoje, Inne); (b) **normalizację języka** — gdy oryginał jest po angielsku, pełna treść trafia do mamy po polsku, z adaptowanymi nazwami składników (cilantro → kolendra) i metrycznymi miarami (cup → ml/g, °F → °C); (c) **strukturyzację** — jeśli źródło zawiera składniki w prozie tekstowej („dodaj szklankę mąki, jajko i mleko"), aplikacja rozpoznaje je i prezentuje jako odrębne pozycje listy; (d) **archiwizację** — równolegle z ekstrakcją system zapisuje obraz źródłowy (og:image lub screenshot) i transkrypcję audio (dla filmów), tak by przepis pozostał czytelny po zniknięciu oryginału.

Użytkownik napotyka tę regułę raz na każde udostępnienie. Po kliknięciu „Udostępnij → ZapiszPrzepis" mama widzi placeholder „Zapisuję…", wraca do aplikacji po 1-3 minutach i otrzymuje gotowy, polskojęzyczny przepis bez konieczności jakichkolwiek poprawek.

## Non-Functional Requirements

- Potwierdzenie odebrania udostępnienia (placeholder „Zapisuję…" widoczny w aplikacji) w **< 1 sekundę** od kliknięcia „Udostępnij → ZapiszPrzepis".
- Typowy czas od udostępnienia URL do gotowego, w pełni czytelnego przepisu na liście użytkownika **≤ 3 minuty p95**.
- Każdy zapisany przepis pozostaje w pełni dostępny i czytelny **przez ≥ 5 lat** od daty zapisu, nawet jeśli oryginalne źródło zostanie usunięte.
- Miesięczny koszt eksploatacji dla typowego użytkownika (~50 przepisów / miesiąc) **≤ 10 zł** brutto (suma kosztów AI, storage, hostingu, transferu, amortyzowanej infrastruktury per użytkownik).
- Aplikacja jest instalowalna jako PWA i poprawnie obsługuje Web Share Target API na **dwóch najnowszych wersjach Chrome i Edge na Androidzie**.
- **Żadne udostępnione żądanie nie ginie cicho** — każde poprawnie odebrane żądanie kończy się w aplikacji jednym z trzech stanów widocznych dla użytkownika: gotowy przepis, best-effort z notą o niekompletnej ekstrakcji, lub czytelny komunikat błędu z opcjami akcji.

### Stan przetwarzania i błędy

- FR-010: Gdy przepis jest w trakcie zapisywania, mama widzi go w aplikacji jako placeholder „Zapisuję…"; po zakończeniu placeholder zostaje zastąpiony pełnym przepisem. Priorytet: **nice-to-have**
  > Sokrates: Użytkownik zdecydował (po pierwotnym Sokratesie o race conditions): „FR-010 to nie jest must-have". Rozwiązanie: PRZESUNIĘTE z must-have do nice-to-have. W MVP po udostępnieniu PWA pokazuje krótki komunikat „Zapisałem — przepis pojawi się na liście za chwilę" i można ją zamknąć; mama wraca do aplikacji, gotowy przepis jest na liście (lista odświeża się przy otwarciu). Placeholder + push (FR-011) razem wracają w V2.
- FR-011: Aplikacja może wysyłać push notification „Dodano: <tytuł>" gdy przepis jest gotowy. Priorytet: **nice-to-have**
  > Sokrates: Użytkownik zdecydował: „na początek powiadomienia push nie są koniecznością". Rozwiązanie: FR-011 PRZESUNIĘTE z must-have do nice-to-have; wraca w V2. W MVP mama wraca do aplikacji ręcznie po chwili i widzi gotowy przepis na liście (FR-010 placeholder daje minimalny feedback wewnątrz aplikacji).
- FR-012: Gdy zapis się nie uda (niewspierane źródło, video za długie, FB zablokował dostęp), mama widzi czytelny komunikat. Może spróbować ponownie maksymalnie 3 razy; po 3 nieudanych próbach przycisk „spróbuj ponownie" znika, zostaje tylko „usuń"; autor jest powiadomiony (np. e-mailem) o nieudanym przepisie, by mógł zbadać przyczynę. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: „mama klika 'spróbuj ponownie' 10× na nigdy nie działającym źródle — frustracja, telefon do autora". Rozwiązanie: FR ROZSZERZONE o bounded retry (max 3) + powiadomienie autora przy permanentnym fail. Cap retry chroni mamę przed nieskończoną pętlą frustracji.

## Non-Goals

- **Współdzielenie przepisów między użytkownikami (ZapiszPrzepis Family)** — każdy użytkownik ma własny zbiór; brak zaproszeń, brak wspólnych folderów. Wraca w V2.
- **Wsparcie dla Instagram i TikTok** — w MVP tylko Facebook (posty + Reels/Video), YouTube i strony WWW. Instagram + TikTok mają trudniejszy share intent i wymagają osobnej pracy nad scraperem; V2.
- **Ręczna edycja przepisu po ekstrakcji** — brak ekranów „popraw składniki", „dodaj swój krok". Mama ufa AI, lub przepis zostaje jak jest. Pilnuje guardrail „zero data entry".
- **Funkcje wokół gotowania**: „co ugotować z tego co mam", lista zakupów, planowanie tygodnia, voice search — wszystkie wymienione w pomyśle V2. Inna apka, nie MVP.
- **Push notifications** — FR-011 jest nice-to-have, nie must. Mama wraca do aplikacji ręcznie.
- **Placeholder „Zapisuję…" w liście przepisów** — FR-010 jest nice-to-have. Po share PWA pokazuje jeden krótki ekran potwierdzenia; lista przepisów jest aktualizowana przy następnym otwarciu.
- **Semantic search** („coś szybkiego", „bez mięsa") — w MVP tylko proste tekstowe filtrowanie po tytule i składniku (FR-013). Embeddings + LLM search to V2.
- **Aplikacja natywna iOS / Android (Capacitor wrap)** — tylko PWA. Capacitor wraca jeśli Web Share Target okaże się zawodny lub jeśli celujemy w App Store.
- **Offline-first** — przeglądanie zapisanych przepisów bez połączenia internetowego nie jest gwarantowane w MVP (PWA cache może działać best-effort, ale nie jest egzekwowane).

## Open Questions

1. **Feasibility FB Reels scraping**. Czy Playwright / yt-dlp / Facebook Graph API są w stanie niezawodnie wyciągnąć audio + screenshot z Reels w MVP, czy FB rate-limity / bot detection zmuszą nas do best-effort tylko? Do potwierdzenia spike'em (1-2 dni) PRZED startem developmentu. Owner: autor. By: przed sprintem 1.
2. **Precyzja konwersji miar US→metric**. Czy LLM jest wystarczająco dokładny dla konwersji niejednoznacznych ("1 cup of flour" = 120-150g w zależności od mąki), czy potrzebujemy biblioteki konwersji (np. `convert-units`) z explicit mapowaniem składników? Owner: autor. Decyzja po pierwszych 10-20 testach EN przepisów.
3. **Lista kategorii fixed taxonomy do potwierdzenia z mamą**. Czy 8 zaproponowanych (Obiady, Zupy, Desery, Śniadania, Przekąski, Wegetariańskie, Napoje, Inne) pokrywa jej typowe wzorce zapisywania? Brakuje może „Wypieki", „Sałatki", „Słoiki/przetwory"? Owner: autor (rozmowa z mamą). By: przed implementacją FR-008.
4. **Powiadomienia autora o nieudanym przepisie (FR-012)** — kanał: email? Slack? Manualny review w bazie? Do doprecyzowania w fazie planowania.

## Forward: tech-stack (informacyjne, NIE część PRD)

Notatki kierunkowe na fazę selekcji stosu technologicznego (nie zobowiązują — to dane wejściowe dla `/10x-tech-stack-selector`). Pomysł z ChatGPT plus dodatki z dyskusji:

- **Frontend**: Next.js PWA z Web Share Target API (PWA manifest + service worker).
- **Backend**: Next.js API routes lub Supabase Edge Functions; przetwarzanie asynchroniczne wymagane (job queue z możliwością retry — user wprost wspomniał „kolejkowanie do OCR").
- **DB + auth + storage**: Supabase (PostgreSQL + magic link auth + Storage dla screenshotów); RLS dla per-user isolation.
- **LLM**: GPT-4o-mini lub Claude Haiku 4.5 do ekstrakcji + tłumaczenia + kategoryzacji (jeden prompt, lub kilka małych). Dobór sterowany NFR „≤ 10 zł/m-c".
- **Transkrypcja**: Whisper API (OpenAI) dla audio z FB Reels / YouTube Shorts. Dla niemych Reels (recipe cards) — opcjonalnie OCR (`Tesseract.js` lub Vision API jako fallback) wpięty w kolejkę.
- **Scraping**: Firecrawl lub Jina AI Reader dla stron WWW; Playwright + screenshot fallback dla FB; yt-dlp dla YouTube.
- **Hosting**: Vercel (free tier dla MVP).

## Forward: technical-roadmap (informacyjne)

V2 features wynikające z MVP non-goals i dyskusji:
- Push notifications (FR-011 promote do must-have).
- Placeholder w liście przepisów (FR-010 promote do must-have).
- Wsparcie Instagram + TikTok.
- Współdzielenie rodzinne.
- Semantic search.
- Capacitor wrap dla iOS / App Store.
- Offline-first.
- „Co ugotować z tego co mam" + lista zakupów + plan tygodnia.
- Edycja przepisów po fakcie.

## User Stories

### US-01: Mama zapisuje przepis udostępniając link z Facebooka

- **Given** mama jest zalogowana w PWA ZapiszPrzepis na swoim telefonie (Google Pixel 9, Android), z aktywną sesją z jednorazowego setupu
- **When** widzi przepis na Facebooku (post lub Reel), klika systemowe „Udostępnij" i wybiera ZapiszPrzepis z listy aplikacji
- **Then** widzi w PWA krótkie potwierdzenie „Zapisałem — przepis pojawi się za chwilę" i może zamknąć aplikację; po 1-3 minutach, gdy ponownie otwiera aplikację, nowy przepis jest na liście — z poprawnym tytułem po polsku, zdjęciem/screenshotem, składnikami jako listą wypunktowaną, krokami i automatycznie przypisaną kategorią z fixed taxonomy

#### Acceptance Criteria

- Mama nie wpisuje żadnego tekstu w żadnym kroku przepływu (poza systemowym gestem „Udostępnij" znanym jej z WhatsApp/Messengera).
- Potwierdzenie odebrania udostępnienia (ekran „Zapisałem — przepis pojawi się za chwilę") pojawia się w < 1 sekundę.
- Gdy źródło to Reel/video, transkrypcja audio jest automatycznie wyciągana i służy jako wejście do ekstrakcji składników.
- Gdy oryginał jest po angielsku, finalna treść w aplikacji jest po polsku (mama nie widzi że została przetłumaczona).
- Gdy przepis zostanie zapisany i FB usunie oryginał nazajutrz, przepis w aplikacji nadal działa: zdjęcie/screenshot się otwiera, składniki i kroki są widoczne.
- Przepis ma znormalizowaną etykietę źródła („Facebook Reel"), a NIE surowy URL `facebook.com/watch/?v=…`.
- Składniki są wyświetlone jako klasyczna lista wypunktowana (UL), nawet jeśli źródło miało je w prozie tekstowej.
