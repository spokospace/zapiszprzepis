---
project: "ZapiszPrzepis"
version: 1
status: draft
created: 2026-05-28
context_type: greenfield
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

Wgląd, na którym opiera się produkt: modele językowe i transkrypcja audio są dopiero teraz na tyle dobre i tanie, by jednym gestem systemowym "udostępnij" wyciągnąć przepis z dowolnego źródła (tekst, Reel, film) i zapisać jego trwałą lokalną kopię — tytuł, składniki, kroki, zdjęcie lub screenshot, transkrypcję, oryginalny URL. Istniejące rozwiązania (Pinterest, "Zapisz" na Facebooku, zakładki przeglądarki, dotychczasowe aplikacje kulinarne) są "link-first" — wszystkie polegają na tym, że źródło nadal istnieje. Ten produkt jest "archive-first": zapisuje KOPIĘ przepisu, a nie odnośnik do niego.

## User & Persona

Główna persona: **mama autora aplikacji**. Codzienna użytkowniczka smartfonu (Android), ale niedoświadczona technicznie — nie wpisuje ręcznie składników, nie wypełnia formularzy, nie zakłada kont, nie zarządza folderami ani tagami. Wzorzec dotarcia do produktu: ogląda przepis na telefonie (post / Reel / film), klika systemowe **„Udostępnij"** — tak jak udostępnia zdjęcia na WhatsApp lub Messenger — wybiera „ZapiszPrzepis" z listy aplikacji, i nie robi nic więcej. Cały dalszy proces (rozpoznanie źródła, pobranie zdjęcia/transkrypcja audio, ekstrakcja składników i kroków, tłumaczenie na polski jeśli oryginał był po angielsku, przypisanie kategorii) musi się wydarzyć automatycznie. Jej pierwsze zetknięcie z produktem nie powinno wymagać żadnego onboardingu poza instalacją aplikacji na ekranie głównym.

## Success Criteria

### Primary

- Mama otrzymuje link do przepisu na Facebooku (post, Reel, Story) lub na innym wspieranym źródle (blog kulinarny, YouTube), klika systemowe **„Udostępnij" → ZapiszPrzepis** i w ciągu ≤ 30 sekund widzi w aplikacji nowy przepis z tytułem, zdjęciem/screenshotem, składnikami, krokami i kategorią — bez wpisywania jakichkolwiek danych.

### Secondary

- Mama używa aplikacji **bez pomocy autora przez ≥ 30 dni z rzędu** (samodzielnie zapisuje przepisy, samodzielnie z nich gotuje).

### Guardrails

- **Trwałość kopii** — gdy oryginalne źródło zniknie (post FB usunięty, blog wygasł, Reel skasowany), zapisany przepis nadal jest w pełni dostępny w aplikacji (treść, zdjęcie/screenshot, transkrypcja).
- **Zero ręcznego wprowadzania danych** — mama NIGDY nie musi wpisywać tekstu poza jednorazowym setupem (autor robi go za nią). Brak formularzy do uzupełniania składników, brak wymuszania korekt po ekstrakcji.
- **Potwierdzenie przyjęcia w < 1 sekundę** — gdy mama kliknie „Udostępnij → ZapiszPrzepis", aplikacja musi natychmiast pokazać „Zapisuję…" i pozwolić jej zamknąć ekran (przetwarzanie jest asynchroniczne, ale potwierdzenie odebrania natychmiastowe).
- **Działa na jej Google Pixel 9 (Android)** — aplikacja musi być instalowalna na ekranie głównym i stabilnie odbierać systemowe gesty udostępniania na tym konkretnym urządzeniu.

## User Stories

### US-01: Mama zapisuje przepis udostępniając link z Facebooka

- **Given** mama jest zalogowana w aplikacji ZapiszPrzepis na swoim telefonie (Google Pixel 9, Android), z aktywną sesją z jednorazowego setupu
- **When** widzi przepis na Facebooku (post lub Reel), klika systemowe „Udostępnij" i wybiera ZapiszPrzepis z listy aplikacji
- **Then** widzi w aplikacji krótkie potwierdzenie „Zapisałem — przepis pojawi się za chwilę" i może zamknąć aplikację; po 1-3 minutach, gdy ponownie otwiera aplikację, nowy przepis jest na liście — z poprawnym tytułem po polsku, zdjęciem/screenshotem, składnikami jako listą wypunktowaną, krokami i automatycznie przypisaną kategorią z fixed taxonomy

#### Acceptance Criteria

- Mama nie wpisuje żadnego tekstu w żadnym kroku przepływu (poza systemowym gestem „Udostępnij" znanym jej z WhatsApp/Messengera).
- Potwierdzenie odebrania udostępnienia (ekran „Zapisałem — przepis pojawi się za chwilę") pojawia się w < 1 sekundę.
- Gdy źródło to Reel/video, transkrypcja audio jest automatycznie wyciągana i służy jako wejście do ekstrakcji składników.
- Gdy oryginał jest po angielsku, finalna treść w aplikacji jest po polsku (mama nie widzi że została przetłumaczona).
- Gdy przepis zostanie zapisany i FB usunie oryginał nazajutrz, przepis w aplikacji nadal działa: zdjęcie/screenshot się otwiera, składniki i kroki są widoczne.
- Przepis ma znormalizowaną etykietę źródła („Facebook Reel"), a NIE surowy URL `facebook.com/watch/?v=…`.
- Składniki są wyświetlone jako klasyczna lista wypunktowana (UL), nawet jeśli źródło miało je w prozie tekstowej.

## Functional Requirements

### Konto i autoryzacja

- FR-001: Mama (po jednorazowym setupie autora) korzysta z aplikacji bez konieczności logowania się przy każdym otwarciu — sesja jest długo-żyjąca. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: „sesja może wygasnąć po update PWA lub wyczyszczeniu cache — mama nagle bez dostępu". Rozwiązanie: FR utrzymane; dodaj guard w implementacji (silent refresh tokenu, backup magic link na email autora gdy sesja jednak padnie) — to nie zmienia FR, tylko ścieżkę implementacji.

### Zapisywanie przepisów

- FR-002: Mama może z dowolnej aplikacji na telefonie (FB, Chrome, Instagram, YouTube) udostępnić link do ZapiszPrzepis przez systemowy gest „Udostępnij" — tak jak udostępnia zdjęcie na WhatsApp. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: „niektóre aplikacje (Instagram, TikTok) udostępniają link wewnętrzny, którego backend nie otworzy". Rozwiązanie: FR utrzymane dla zakresu FR-004 (FB + YouTube + WWW); Instagram i TikTok są niewspierane w MVP (patrz Non-Goals). Dla linków wewnętrznych FB — fallback do screenshotu + og:image, ale tylko best-effort.
- FR-003: Po udostępnieniu linku aplikacja przyjmuje go natychmiast (potwierdza odebranie w < 1 sekundę), a samo przetwarzanie odbywa się asynchronicznie — typowo gotowe w ciągu 1-3 minut. Mama nie musi siedzieć przy ekranie; powiadomienie lub kolejne otwarcie aplikacji pokaże gotowy przepis. Priorytet: must-have
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

### Stan przetwarzania i błędy

- FR-010: Gdy przepis jest w trakcie zapisywania, mama widzi go w aplikacji jako placeholder „Zapisuję…"; po zakończeniu placeholder zostaje zastąpiony pełnym przepisem. Priorytet: **nice-to-have**
  > Sokrates: Użytkownik zdecydował (po pierwotnym Sokratesie o race conditions): „FR-010 to nie jest must-have". Rozwiązanie: PRZESUNIĘTE z must-have do nice-to-have. W MVP po udostępnieniu PWA pokazuje krótki komunikat „Zapisałem — przepis pojawi się na liście za chwilę" i można ją zamknąć; mama wraca do aplikacji, gotowy przepis jest na liście (lista odświeża się przy otwarciu). Placeholder + push (FR-011) razem wracają w V2.
- FR-011: Aplikacja może wysyłać powiadomienie „Dodano: <tytuł>" gdy przepis jest gotowy. Priorytet: **nice-to-have**
  > Sokrates: Użytkownik zdecydował: „na początek powiadomienia push nie są koniecznością". Rozwiązanie: FR-011 PRZESUNIĘTE z must-have do nice-to-have; wraca w V2. W MVP mama wraca do aplikacji ręcznie po chwili i widzi gotowy przepis na liście (FR-010 placeholder daje minimalny feedback wewnątrz aplikacji).
- FR-012: Gdy zapis się nie uda (niewspierane źródło, video za długie, FB zablokował dostęp), mama widzi czytelny komunikat. Może spróbować ponownie maksymalnie 3 razy; po 3 nieudanych próbach przycisk „spróbuj ponownie" znika, zostaje tylko „usuń"; autor jest powiadomiony (np. e-mailem) o nieudanym przepisie, by mógł zbadać przyczynę. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: „mama klika 'spróbuj ponownie' 10× na nigdy nie działającym źródle — frustracja, telefon do autora". Rozwiązanie: FR ROZSZERZONE o bounded retry (max 3) + powiadomienie autora przy permanentnym fail. Cap retry chroni mamę przed nieskończoną pętlą frustracji.

## Non-Functional Requirements

- Potwierdzenie odebrania udostępnienia (placeholder „Zapisuję…" widoczny w aplikacji) w **< 1 sekundę** od kliknięcia „Udostępnij → ZapiszPrzepis".
- Typowy czas od udostępnienia URL do gotowego, w pełni czytelnego przepisu na liście użytkownika **≤ 3 minuty p95**.
- Każdy zapisany przepis pozostaje w pełni dostępny i czytelny **przez ≥ 5 lat** od daty zapisu, nawet jeśli oryginalne źródło zostanie usunięte.
- Miesięczny koszt eksploatacji dla typowego użytkownika (~50 przepisów / miesiąc) **≤ 10 zł** brutto (suma kosztów AI, storage, hostingu, transferu, amortyzowanej infrastruktury per użytkownik).
- Aplikacja jest instalowalna na ekranie głównym telefonu (bez konieczności sklepu z aplikacjami) i poprawnie odbiera systemowe gesty udostępniania linków z innych aplikacji — na dwóch najnowszych wersjach głównych przeglądarek na Androidzie.
- **Żadne udostępnione żądanie nie ginie cicho** — każde poprawnie odebrane żądanie kończy się w aplikacji jednym z trzech stanów widocznych dla użytkownika: gotowy przepis, best-effort z notą o niekompletnej ekstrakcji, lub czytelny komunikat błędu z opcjami akcji.

## Business Logic

Dla każdego udostępnionego URL aplikacja samodzielnie ekstrahuje, normalizuje (język + miary + strukturę) i archiwizuje przepis tak, by oryginał mógł zniknąć bez utraty danych.

Wejście dla tej reguły to **jeden URL** — wszystko, co użytkownik widzi na ekranie udostępniania (post na Facebooku, Reel, link do bloga, film z YouTube). Wyjście to **strukturalny obiekt przepisu** widoczny dla użytkownika: tytuł po polsku, lista składników w postaci listy wypunktowanej, ponumerowane kroki, zdjęcie lub screenshot, znormalizowana etykieta źródła i kategoria z fixed taxonomy.

Reguła obejmuje cztery decyzje domenowe: (a) **klasyfikację** — przypisanie przepisu do jednej z ośmiu kategorii (Obiady, Zupy, Desery, Śniadania, Przekąski, Wegetariańskie, Napoje, Inne); (b) **normalizację języka** — gdy oryginał jest po angielsku, pełna treść trafia do mamy po polsku, z adaptowanymi nazwami składników (cilantro → kolendra) i metrycznymi miarami (cup → ml/g, °F → °C); (c) **strukturyzację** — jeśli źródło zawiera składniki w prozie tekstowej („dodaj szklankę mąki, jajko i mleko"), aplikacja rozpoznaje je i prezentuje jako odrębne pozycje listy; (d) **archiwizację** — równolegle z ekstrakcją zachowywany jest obraz reprezentatywny (zdjęcie z metadanych strony lub screenshot) oraz transkrypcja audio (dla filmów), tak by przepis pozostał czytelny po zniknięciu oryginału.

Użytkownik napotyka tę regułę raz na każde udostępnienie. Po kliknięciu „Udostępnij → ZapiszPrzepis" mama widzi krótkie potwierdzenie „Zapisałem — przepis pojawi się za chwilę", wraca do aplikacji po 1-3 minutach i otrzymuje gotowy, polskojęzyczny przepis bez konieczności jakichkolwiek poprawek.

## Access Control

Uwierzytelnianie bez haseł: jednorazowy link aktywacyjny wysyłany e-mailem. Setup mamy wykonuje autor aplikacji raz: wpisuje jej adres e-mail, klika link na jej telefonie, sesja jest długo-żyjąca i nie wygasa w trakcie normalnego użytkowania. Mama nigdy nie widzi ekranu logowania ani formularza rejestracji.

Każdy użytkownik ma **swoją osobną, prywatną skrzynkę przepisów**. Brak ról (administrator / członek / gość), brak współdzielenia, brak grup rodzinnych. Płaski model: jeden e-mail → jedno konto → jedna kolekcja przepisów widoczna tylko dla niej. Współdzielenie rodzinne („ZapiszPrzepis Family") wyraźnie poza zakresem MVP — wraca jako V2.

Nieuwierzytelniony użytkownik, który trafi na URL aplikacji, widzi tylko ekran „Wpisz e-mail, by otrzymać link" — żadnej treści przepisów, żadnego katalogu publicznego.

## Non-Goals

- **Współdzielenie przepisów między użytkownikami (ZapiszPrzepis Family)** — każdy użytkownik ma własny zbiór; brak zaproszeń, brak wspólnych folderów. Wraca w V2.
- **Wsparcie dla Instagram i TikTok** — w MVP tylko Facebook (posty + Reels/Video), YouTube i strony WWW. Instagram + TikTok mają trudniejszy share intent i wymagają osobnej pracy nad scraperem; V2.
- **Ręczna edycja przepisu po ekstrakcji** — brak ekranów „popraw składniki", „dodaj swój krok". Mama ufa AI, lub przepis zostaje jak jest. Pilnuje guardrail „zero data entry".
- **Funkcje wokół gotowania**: „co ugotować z tego co mam", lista zakupów, planowanie tygodnia, voice search — wszystkie wymienione w pomyśle V2. Inna apka, nie MVP.
- **Powiadomienia jako gwarantowany kanał informowania o gotowym przepisie** — FR-011 jest nice-to-have, nie must. Mama wraca do aplikacji ręcznie.
- **Placeholder „Zapisuję…" w liście przepisów** — FR-010 jest nice-to-have. Po share aplikacja pokazuje jeden krótki ekran potwierdzenia; lista przepisów jest aktualizowana przy następnym otwarciu.
- **Wyszukiwanie semantyczne** („coś szybkiego", „bez mięsa") — w MVP tylko proste tekstowe filtrowanie po tytule i składniku (FR-013). Wyszukiwanie semantyczne to V2.
- **Aplikacja natywna iOS / Android dystrybuowana ze sklepu z aplikacjami** — w MVP tylko wersja webowa instalowana na ekranie głównym. Wersja sklepowa wraca jako V2, jeśli pojawi się potrzeba.
- **Offline-first** — przeglądanie zapisanych przepisów bez połączenia internetowego nie jest gwarantowane w MVP (cache aplikacji może działać best-effort, ale nie jest egzekwowane).

## Open Questions

1. **Feasibility scrapingu Facebook Reels**. Czy istniejące narzędzia są w stanie niezawodnie wyciągnąć audio + screenshot z Reels w MVP, czy rate-limity i bot detection zmuszą nas do strategii best-effort? Do potwierdzenia spike'em (1-2 dni) PRZED startem developmentu. Owner: autor. By: przed sprintem 1.
2. **Precyzja konwersji miar US→metric**. Czy LLM jest wystarczająco dokładny dla konwersji niejednoznacznych ("1 cup of flour" = 120-150g w zależności od mąki), czy potrzebujemy biblioteki konwersji z explicit mapowaniem składników? Owner: autor. Decyzja po pierwszych 10-20 testach EN przepisów.
3. **Lista kategorii fixed taxonomy do potwierdzenia z mamą**. Czy 8 zaproponowanych (Obiady, Zupy, Desery, Śniadania, Przekąski, Wegetariańskie, Napoje, Inne) pokrywa jej typowe wzorce zapisywania? Brakuje może „Wypieki", „Sałatki", „Słoiki/przetwory"? Owner: autor (rozmowa z mamą). By: przed implementacją FR-008.
4. **Powiadomienia autora o nieudanym przepisie (FR-012)** — kanał: e-mail? Inny komunikator? Manualny review w bazie? Do doprecyzowania w fazie planowania.
