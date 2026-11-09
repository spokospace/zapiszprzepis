# Wyniki testów i pomiarów

Dziennik pomiarów produkcji i prób rozwiązań. Nowe wpisy na górze, godziny w UTC. Każdy wpis mówi, co zmierzono, jak, wynik i czego wynik nie dowodzi.

Przed porównywaniem liczb: testy obciążeniowe rozdzielaj co najmniej 30 cichymi minutami, bo błędy trwają dłużej niż samo obciążenie. Pomiary zrobione kilka minut po sobie nie są porównywalne.

## 2026-11-09

### Zdjęcia: z Supabase Storage do Cloudflare R2 (przekroczony limit planu Free)

**Co:** Supabase ostrzegł (3 dni do 2026-11-11, potem błędy 402), że organizacja przekroczyła limity: pamięć 1,31 GB z 1,1 GB, transfer 11,4 GB z 5,5 GB. Zapytanie o `storage.objects` (Management API): cały bucket `recipe-images` to 3764 pliki, 1255,8 MB, średnio 342 KB; 506 plików JPEG ma ponad 500 KB i zajmuje 584 MB. Decyzja właściciela: zdjęcia nie mają być w Supabase, mają być kompresowane i cachowane.

**Jak:** bucket R2 `zapiszprzepis-images` z domeną `img.zapiszprzepis.pl`; skrypt `scripts/migrate-images-to-r2.ts` kopiuje każdy plik, JPEG/PNG powyżej 150 KB zamienia na WebP (długi bok do 1600 px, jakość 82), zapisuje z `Cache-Control: public, max-age=31536000, immutable`. Próba na co 40. pliku (95 plików): 33,8 MB → 11,9 MB (35%).

**Wynik:** skopiowane 3764 z 3764 plików. Pierwszy przebieg: 2724 plików, 1040 odrzuconych przez Supabase kodem 429 (zbyt szybkie pobieranie; po tym „Too many connections” przy listowaniu), więc dodałem ponawianie i obniżyłem równoległość z 6 do 3; drugi przebieg skończył bez błędów. Rozmiar po migracji ok. 459 MB (945 → 331 MB w pierwszym, 310 → 127 MB w drugim przebiegu) wobec 10 GB darmowego limitu R2.

**Nie dowodzi:** że produkcja wyświetla zdjęcia z R2 (adresy w bazie jeszcze wskazują Supabase, dopóki nie przepiszę ich po deployu), ani że transfer spadnie; to pokaże dopiero panel Usage Supabase kilka dni po przełączeniu. Kompresja nowych zdjęć w Workerze (binding Cloudflare Images) nie była jeszcze sprawdzona na produkcji.

### Powtórzone `<title>` przepisów: od 43 grup do zera (#745, #746, #749)

**Jak:** wszystkie adresy `/przepis/…` z `https://zapiszprzepis.pl/sitemap.xml`, pobrane po 8 naraz (to statyczne pliki), wyciągnięty `<title>` każdej strony i policzone grupy adresów o identycznym tytule. Te same kroki w trzech momentach.

**Wynik:**

| Kiedy | Stan | Grupy z tym samym tytułem | Adresy w tych grupach |
| --- | --- | --- | --- |
| 2026-11-06 (audyt SEO z Uper) | tytuł = `{title} · Zapisz Przepis` | 43 | 103 |
| 2026-11-09 09:13 (deploy `22a0996f`, #746) | domyślnie `{title} {description}`, gdy opis to krótki wariant | 7 | 16 |
| 2026-11-09 09:40 (deploy `083e3d81`) | do tego `meta_title` 13 przepisów, ustawione narzędziem MCP `recipes_set_meta_title` | 0 | 0 |

Ostatni pomiar: 926 adresów, 926 pobranych, 0 błędów. Wszystkie 13 przepisów pokazują nowe tytuły (np. `slonecznikowiec-3` → „Słonecznikowiec z karmelizowanym słonecznikiem · Zapisz Przepis”). `pnpm smoke:prod` po obu deployach: ✓.

**Po drodze: zapisy przepisów przez API nie działały od #722.** Pierwsze 13 wywołań `recipes_set_meta_title` (09:28) skończyło się błędem, choć próbne (`dry_run`) przeszły. W logach Supabase: `POST 400 /rest/v1/rpc/admin_set_meta_title_as`, `proxy_status: PostgREST; error=21000`. Rola `authenticator` ładuje `pg_safeupdate`, a wyzwalacz `bump_recipe_content_version()` z #722 robił `update public.recipe_files_state set content_version = content_version + 1` bez `WHERE`. Każdy insert, update i delete na `recipes` (i zmiana nazwy w `profiles`) przez API kończył się więc błędem od 2026-11-06: import 1214 z 2026-11-07 padł z „Database insert failed: UPDATE requires a WHERE clause”, a `content_version` stał na 1, więc automatyczne odświeżanie plików przepisów ani razu nie ruszyło. Ta sama funkcja wywołana bezpośrednio przez Management API działała (tam `safeupdate` nie jest ładowany), dlatego sprawdzenia migracji tego nie wykryły. Poprawka (#749, `where id`) wgrana przez Management API ok. 09:34; potem 13 zapisów przeszło, `content_version` 1 → 14, cron zamówił build o 09:35:39, a ponowiony import 1214 zakończył się przepisem 1115. Przegląd wszystkich funkcji w `public` na produkcji: innej zmiany bez `WHERE` nie ma; nowy test `src/lib/sql-safeupdate.test.ts` pilnuje tego w migracjach.

**Nie dowodzi:** że Google przyjął nowe tytuły (to widać dopiero w Search Console po ponownym zindeksowaniu), ani że tytuły są unikalne w obrębie wszystkich stron serwisu (liczone tylko `/przepis/…` z sitemapy, bez kategorii i profili). Nowy przepis o nazwie, która już jest, znowu może dać powtórzony tytuł, dopóki nie dostanie wariantu w opisie albo `meta_title`. Nie sprawdzałem, ile importów poza 1214 nie powiodło się od 2026-11-06 bez zapisanego błędu (np. przerwanych przed zapisem statusu).

## 2026-11-07

### Strona główna: przeskoki od podmiany czcionki i od nieznanego imienia (#744)

**Jak:** lokalny `next dev`, Playwright (Chromium headless, Pixel 7, szerokości 360/375/412/430/768/1280 px), sieć 400 KB/s + 150 ms, CPU ×4, konto QA `free` z zaślepioną odpowiedzią Supabase (`profiles_private` → imię „Mateusz”/„Ania”). Rejestrator `requestAnimationFrame` zapisywał przy każdej zmianie: tekst i wysokość `h1`, podtytuł, pozycję pola szukania i sekcji pod hero, liczbę wczytanych plików czcionki.

**Wynik przed poprawką:** przy 412 px z imieniem w cache nagłówek miał 3 wiersze (113 px) w pierwszej klatce i 2 wiersze (76 px) po wczytaniu czcionki: pole szukania skakało o 38 px. Przyczyna: `font-display: swap` i zapasowy Arial Bold, o ok. 11% szerszy niż Atkinson 800. Bez cache przy 375 px nagłówek ukryty miał 2 wiersze, a po imieniu 3 (+38 px); przy 768 px 1 wiersz zamiast 2 (+50 px).

**Wynik po poprawce:** plik czcionki jest preładowany (oba podzbiory, widoczny `fl:2` ok. 0,7 s nawet przy ograniczonej sieci), `font-display: optional`, zapasowa czcionka `Atkinson Fallback` z `size-adjust` (400: 98,5%, 600-700: 97%, 800: 89%), rezerwa wysokości nagłówka dla czytelnika bez cache (2 wiersze do 1023 px, 3 wiersze do 399 px). Z cache oraz bez cache: zero zmian wysokości nagłówka i pozycji sekcji w każdej mierzonej szerokości. `pnpm test:reflow`: 114 zielonych.

**Nie dowodzi:** pomiaru na prawdziwym telefonie (Android podstawia Roboto zamiast Arial, więc `size-adjust` jest tam przybliżeniem), ani zachowania przy imionach dłuższych niż „Mateusz” przy 360 px bez cache. Pierwsze wejście na nowym urządzeniu nadal czeka na imię z bazy (nagłówek ukryty z zarezerwowanym miejscem); pełne usunięcie wymagałoby zapisania imienia przy logowaniu po stronie serwera.

### Strona główna: skoki powitania i wiersza „Powiedz” (#737)

**Jak:** lokalny `pnpm dev` w oknie 375 px, `PerformanceObserver`/`layout-shift` po załadowaniu; gość oraz konto QA `free` (`/api/dev/login`). Dla konta zalogowanego ręcznie ustawiony wpis `zp-greeting` w `localStorage` z imieniem „Mateuszu”.

**Wynik:** po poprawce 0 wpisów `layout-shift` na stronie głównej: gość (wiersz „Powiedz, czego szukasz” 52 px jest od pierwszej klatki), zalogowany bez cache (nagłówek ukryty, potem tekst) i zalogowany z cache (`--zp-greeting` ustawione przed hydracją, nagłówek widoczny od razu; po odpowiedzi bazy tekst poprawiony bez przesunięcia). `pnpm test:reflow`: 114 testów zielonych.

**Nie dowodzi:** że nic nie miga na prawdziwym telefonie przy wolnej sieci (nie mierzyłem klatka po klatce ani na produkcji), ani że wpis o prawdziwym imieniu działa (konta QA nie mają imienia). Stan sprzed poprawki nie był zmierzony, tylko wyczytany z kodu.

### Czy Google widzi przepisy: Search Console i HTML pliku

**Jak:** tabela `search_console_daily` (kopia raportu Search Console, zapisywana przez cron Workera), wiersze `page` od 29.10 do 6.11. Osobno plik `public/przepis/zapiekanka.html` z lokalnego builda: dane `Recipe` w JSON-LD i miejsce, w którym stoi tekst składników.

**Wynik:** 338 różnych adresów `/przepis/…` miało wyświetlenia w Google w ciągu 9 dni (dziennie 30-157 adresów, 44-270 wyświetleń, 0-5 kliknięć). JSON-LD `Recipe` w pliku ma nazwę, opis, obraz, 7 składników i 7 kroków. Tekst składnika stoi też w samym HTML-u, w blokach `hidden`, które skrypt `$RC` odsłania (15 takich bloków), więc nie zależy od JavaScriptu przeglądarki w sensie dostępności tekstu w pliku.

**Nie dowodzi:** że Google indeksuje całą treść widoczną po wykonaniu skryptu. Nie miałem dostępu do Search Console dla `zapiszprzepis.pl` (konto serwisowe z moich instrukcji widzi tylko spoko.space, catalog.polo.blue i uper.pl), więc nie zrobiłem Inspekcji adresu URL ani nie widziałem, jaką wersję strony Google zapisał. Nie wiem, czy liczba kliknięć jest niska z powodu pozycji, czy treści. Dane z 6.11 są niepełne (30 adresów).

### Zdjęcia: liczby do decyzji o `/_next/image`

**Jak:** zapytanie tylko do odczytu o `storage.objects` przez Management API (token projektu).

**Wynik:** jeden bucket `recipe-images`: 3763 plików, 1255 MB razem. Średnio 342 KB na plik, mediana 209 KB, największy 5073 KB. Przy limicie 5 GB transferu w miesiącu daje to około 15 000 pobrań oryginału o średniej wielkości (około 500 dziennie), czyli około 4 razy tyle, ile jest plików w całym buckecie (15 000 / 3763). Dziś każde zdjęcie na liście i w przepisie idzie przez `/_next/image` na Workerze, a Supabase oddaje oryginał tylko przy trafieniu poza pamięć podręczną.

**Decyzja właściciela (2026-11-07):** opcja 1, zdjęcia zostają na `/_next/image` na Workerze. Opcje 2 i 3 zostają opisane poniżej jako zapas, gdyby obrazy okazały się przyczyną błędów limitu.

**Opcje:**

1. Zostawić `/_next/image` na Workerze: transfer z Supabase zależy od trafień w pamięć podręczną Cloudflare (zmniejszone obrazy, ale bez pomiaru, czy mniej niż w opcji 3), ale Worker dalej wykonuje te żądania (zasób CPU, nie liczony tu). Gdy zmniejszanie rzuci wyjątek albo zwróci 5xx, Worker przekierowuje na oryginał w Supabase i nie zapisuje tego przekierowania, więc powtarzające się błędy podają pełne obrazy i podnoszą transfer.
2. Zdjęcia bezpośrednio z Supabase, bez zmniejszania: Worker odciążony, ale lista 24 kart to około 8 MB oryginałów na wejście, więc 5 GB wystarczyłoby na około 600 wejść w miesiącu. To jest wyliczenie z samych rozmiarów: przy 100 pełnych wejściach na listę w miesiącu wychodzi około 0,8 GB, czyli poniżej limitu. Czy to za mało, zależy od ruchu w miesiącu, pamięci podręcznej przeglądarek i CDN oraz innego transferu z Supabase, których tu nie mierzyłem, więc opcji 2 nie wykluczam samymi liczbami.
3. Zmniejszone kopie zapisane raz przy imporcie (kilka szerokości w Supabase Storage) i podawane bezpośrednio: Worker odciążony, transfer zależy od rozmiaru kopii i liczby pobrań (30-60 KB na kartę to niepotwierdzony przykład; rozmiar kopii trzeba zmierzyć przed decyzją), ale wymaga migracji istniejących 3763 plików i zmian w imporcie.

**Nie dowodzi:** nie znam bieżącego zużycia transferu w Supabase ani liczby żądań `/_next/image` na dobę (GraphQL Workera nie dzieli po ścieżce). Przed wyborem opcji 3 trzeba odczytać z panelu Supabase (Usage → Egress) zużycie z tego miesiąca i z Cloudflare liczbę żądań obrazów; opcję 2 trzeba ocenić z tych samych danych o ruchu.

## 2026-11-06

### Przekroczenia limitów zasobów od 21:10 do 23:10 UTC: poprawka do stanu z 22:00

**Jak:** Cloudflare GraphQL, `exceededResources` po minutach, od 21:10 UTC do odczytu o ok. 23:10. Sam wynik nie wskazuje limitu przekroczonego w poszczególnych zdarzeniach (`exceededResources` obejmuje też inne limity niż CPU); że to limit CPU, potwierdza tylko treść błędu 1102, którą widziałem przy `/login` w moim smoke teście.

**Wynik:** 55 przekroczeń w pięciu minutach: 21:38 (3), 21:39 (1), 21:59 (9), 22:00 (23), 22:02 (19), wszystkie na wersji `89a871db`. Od 22:03 do odczytu 0, także po trzech nowszych wersjach (PR #731 i #732). W tym samym oknie 3039 udanych. Wpis z 22:00 mówił o 4 błędach, bo był odczytany przed 21:59.

**Przyczyny:** 22:02 (19) zbiega się z moim `pnpm smoke:prod` (`/login` 503 w 9 z 10 prób), a smoke test sam jest obciążeniem. 21:59-22:00 (32) nie mam czym wyjaśnić: w tych minutach tylko odczytywałem dane z API, bez ruchu na stronie. Nie znam adresów, bo GraphQL ich nie podaje.

**Nie dowodzi:** że błędy ustały dzięki #731 i #732: cisza po 22:03 to dwie godziny, nocą, i bez próby obciążenia. Nie wiem, czy 21:59-22:00 to ruch zewnętrzny (bot, analizator), czy skutek mojego włączenia HTTPS o 22:02 (zaczęło się wcześniej, więc raczej nie).

### Strona główna jako plik na produkcji (PR #732)

**Jak:** podgląd gałęzi przed scaleniem (nagłówki, treść, przeglądarka), po scaleniu i buildzie `master` pięć żądań `/` z tego komputera oraz `pnpm smoke:prod`. Plik wersji na produkcji: `{"version":1,"day":"2026-11-07"}`.

**Wynik:** `/` odpowiada 200 w 0,07-0,10 s (pierwsze żądanie 0,25 s), bez nagłówka `x-opennext`, z danymi `WebSite`. Na podglądzie strona w przeglądarce miała H1, kategorie, „Ostatnio dodane” i 5 kart, bez błędów w konsoli. `pnpm smoke:prod` przeszedł (`✓`: 3 strony po 10 prób, 19 plików, 30 przepisów).

**Nie dowodzi:** że „Przepis dnia” zmieni się po północy: dzienny build po polskiej północy jest w kodzie i testach jednostkowych, ale nie był jeszcze widziany na produkcji (do sprawdzenia po 23:00 UTC z zapasem na build: północ w Warszawie to zimą 23:00 UTC). Widok zalogowanego na stronie głównej z pliku nie był sprawdzany. Zwykłe żądanie `curl` to nie ruch: nie wiem, czy `/` wytrzyma szczyt, ale nie startuje już Workera. Kategorie dalej idą przez Workera.

### Always Use HTTPS włączone w strefie (22:02 UTC)

**Jak:** za zgodą właściciela przełącznik SSL/TLS → Edge Certificates → Always Use HTTPS włączony w panelu (token projektu nie ma uprawnień do ustawień strefy). Sprawdzenie `curl -I` po kilkunastu sekundach.

**Wynik:** `http://zapiszprzepis.pl/przepis/zapiekanka`, ten sam adres z `?x=1`, `http://www.zapiszprzepis.pl/` i `http://zapiszprzepis.pl/` odpowiadają 301 na `https://` z tą samą ścieżką i zapytaniem. Przed zmianą było 200. Wersja https nadal 200. Przełączenie zadziałało w ciągu około 20 sekund.

**Przy okazji (`pnpm smoke:prod` zaraz potem, czerwony):** `/` 8 z 10 prób 503, `/login` 9 z 10 prób 503, a krok „recipes” zgłosił, że sitemap nie zawiera adresów. Ręcznie chwilę później: `/` 200, `/przepis/zapiekanka` 200, `/sitemap.xml` 200, `/login` 503. Strony główna i `/login` idą przez Workera, więc to ten sam znany problem 1102, a nie skutek przekierowania (503, nie pętla przekierowań). To kilka minut po czterech błędach z 21:38.

**Nie dowodzi:** że przekierowanie nie ma żadnych skutków ubocznych (np. HSTS nie włączono, zostaje do osobnej decyzji). Czerwony smoke nie jest powtórzony po 30 cichych minutach, więc nie wiem, czy `/` i `/login` wracają same. Nie kontynuuję prób obciążających produkcję.

### Worker po przepisach i `/szukaj` jako plikach: stan o 22:00

**Jak:** Cloudflare GraphQL (`workersInvocationsAdaptive`), skrypt `zapiszprzepis`, okno od 12:15 do 22:00 UTC. Wersja `89a871db` (wdrożona 21:09), poprzednie wersje `78af6b56` (14:21) i `191b152b` (18:31).

**Wynik:** 4 przekroczenia limitu CPU (`exceededResources`), wszystkie w minutach 21:38 (3) i 21:39 (1) na wersji `89a871db`, czyli około 30 minut po wdrożeniu. Wcześniej w oknie 0. Pozostałe: 4142 udane, 74 rozłączenia klienta, 1 rozłączenie strumienia. Mediana CPU udanych 6,4 ms, p90 29,9 ms w tym ujęciu. Wcześniejszy odczyt „38,3 ms mediana, p90 264 ms” pochodzi z innego widoku panelu, więc liczb nie należy porównywać bez ustalenia, czym się różnią (kwantyle GraphQL liczą też crony i żądania zasobów).

**Nie dowodzi:** nie wiem, które adresy dały te 4 błędy (GraphQL nie podaje ścieżki; potrzebne Workers Logs), więc nie wiem, czy to strona główna, kategoria albo `/_next/image`. Cztery żądania nie wystarczą do wniosku o trendzie, ale kończą serię „0 błędów” z notatki wieczornej.

### Uper SEO: analiza sitemapy po plikach dla wszystkich przepisów i `/szukaj`

**Jak:** ten sam analizator właściciela co rano, 946 adresów, start po 17:54, eksport CSV o 18:04. Wersja `78af6b56`, od ostatniego wdrożenia minęło ponad 3,5 godziny. Dane o Workerze z Cloudflare GraphQL, odczyt o 18:05. Po analizie `pnpm smoke:prod`.

**Wynik:** 946 z 946 adresów odpowiedziało 200, bez błędów i bez ponowień, także 925 przepisów, 13 kategorii i strona główna. Rano było 6 błędów 503 na 444 sprawdzone adresy, a końcowy wynik tamtej analizy nie jest znany. `pnpm smoke:prod` przeszedł zaraz po analizie (`✓`).

Dane Cloudflare (wersja `78af6b56`, godzina):

| Godzina | Udane | Limit CPU | Rozłączenia |
|---|---|---|---|
| 17:00 (w tym analiza) | 210 | 0 | 0 |
| 18:00 (do odczytu o 18:05) | 4 | 0 | 0 |

Dla porównania rano, w godzinie analizy: 525 udanych, 82 przekroczenia limitu CPU, 24 rozłączenia.

**Przy okazji:** `/szukaj` jest w sitemapie, choć ma `noindex`. 43 grupy przepisów mają ten sam tytuł (np. „Ciasteczka owsiane” z sufiksami `-2`, `-3`, `-4` w adresie).

**Nie dowodzi:** analizator czyta tylko dokumenty HTML, bez zdjęć i bez nawigacji w aplikacji. Tylko około 20 z 946 adresów trafia do Workera, więc wynik nie mówi, że strona główna i kategorie wytrzymają większy ruch. Poranny wynik to stan odczytany w trakcie analizy, więc porównanie liczb jest przybliżone. Dane Cloudflare mogą być próbkowane, a godzina 18:00 jest niepełna. To jedna analiza, a nie seria.

### `/szukaj` jako plik na produkcji (PR #726)

**Jak:** scalenie o 14:09, build `master` gotowy o 14:12. Pięć żądań `/szukaj?q=ser`, ten sam przebieg gościa co na podglądzie (desktop i Pixel 7), `pnpm smoke:prod`.

**Wynik:** 0,08-0,10 s zamiast 0,50-1,40 s przed zmianą, bez nagłówka `x-opennext`, z nagłówkami bezpieczeństwa. Wyniki, „Pokaż kolejne”, kategoria, wejście w przepis i powrót działają, bez błędów w konsoli i bez poziomego przewijania. `pnpm smoke:prod` przeszedł.

**Nie dowodzi:** czas to samo pobranie pliku, a wyniki dochodzą osobnym zapytaniem: pełne otwarcie z wynikami zajęło 1,1 s na desktopie i 0,55 s na telefonie w pojedynczych próbach. Zalogowany był sprawdzony tylko na lokalnym dev. Uper SEO po tych zmianach jeszcze nie powtórzony.

### `/szukaj` jako plik: przed zmianą i skeleton

**Stan przed zmianą:** `/szukaj?q=ser` na produkcji, 3 żądania: 1,40 s, 1,27 s, 0,50 s, każde z renderem na Workerze. Samo `search_recipes` z przeglądarki 0,10-0,25 s. Próba jest mała, kierunek wyraźny.

**Skeleton:** `e2e/search-skeleton.spec.ts` mierzy zapisany plik i stan ładowania przy 360-1920 px. Pierwsza wersja nie zgadzała się z wynikami, choć wyglądała dobrze: zakładki miały 68 px zamiast 60, pole 56 zamiast 60, a lista lądowała 8-29 px obok. Rozmiary były zgadywane, pomiar je poprawił. Po poprawkach 6 z 6 przechodzi.

**Pomyłka po drodze:** tytuł karty nie zmieniał się na produkcyjnym buildzie, choć kod go ustawiał, bo tytuł strony dochodził później i go nadpisywał. Na serwerze deweloperskim wyglądało to podobnie, ale dopiero build to potwierdził. Tytuł ustawiamy teraz też po nadejściu wyników.

**Na podglądzie Cloudflare, jako plik (gość, desktop i telefon Pixel 7):** `/szukaj?q=ser` 5 żądań, 0,09-0,16 s, bez nagłówka `x-opennext`, z nagłówkami bezpieczeństwa. Wyniki, „Pokaż kolejne”, filtr kategorii, wejście w przepis i powrót działają, bez błędów w konsoli i bez poziomego przewijania. Zdjęcia kart się ładują.

**Konto QA na lokalnym dev:** „Moje” i „Ulubione” odpowiadają bez błędu (konto ma 0 przepisów i 0 ulubionych, więc lista jest pusta).

**Zaskoczenie:** planowaliśmy, że „Pokaż kolejne” i kategoria nie będą pytać bazy drugi raz, ale na podglądzie każde z nich dało 1 zapytanie. Link w obrębie aplikacji dostaje z pliku HTML zamiast danych Next.js, więc przeglądarka ładuje stronę od nowa. Działa poprawnie, a oszczędność dotyczy tylko nawigacji bez przeładowania.

**Nie dowodzi:** skeleton zakłada gościa z filtrem „Kategoria”. Zalogowany ma dodatkowy wiersz „Szukaj w:”, więc u niego lista przesuwa się po wczytaniu. Pusty `/szukaj` przez chwilę pokazuje karty skeletonu, bo plik nie zna adresu. Zdjęcia kart nadal idą przez `/_next/image` na Workerze, więc strona wyników nie jest w pełni wolna od Workera. Pełny dostęp w zakładce „Na blogach” nie był klikany, bo to płatne zapytanie.

### Wyszukiwarka: migracja wgrana na produkcję (PR #724)

**Jak:** migracja i test `supabase/tests/search_word_similarity.sql` w jednej transakcji o 13:19, potem przeładowanie schematu. Zapytania jako gość przez publiczne API, zakresy zalogowanego w bloku cofniętym wyjątkiem, ekran kontem QA na lokalnym dev (ta sama baza).

**Wynik:**
- Test przeszedł, nowy indeks jest, starego nie ma, wersja zarejestrowana.
- Gość: `pierogów` 3 wyniki, `sałatka z kurczakiem` 22, `ciasto z jabłkami` 14, `dyni` 3. Pełne żądanie z tego komputera 100-250 ms, razem z siecią.
- Gość pytający o „Moje” i „Ulubione” dostaje pustą listę, bez błędu uprawnień.
- Właściciel przepisów: „Moje” dla `ciasto` zwraca 140 (limit), „Ulubione” 3.
- Konto QA: `pierogów` w „Ulubionych” znalazło „Pierogi leniwe”. Serce usunięte po teście, ulubione QA znów puste.

**Nie dowodzi:** „Moje” nie było sprawdzone na ekranie, bo konto QA nie ma przepisów i nie wolno ich dodawać. Działanie na prawdziwym ruchu nie jest jeszcze zmierzone.

### Wyszukiwarka: próba `search_recipes` z podobieństwem (PR #724)

**Jak:** cała migracja w jednej transakcji zakończonej wyjątkiem, na danych produkcyjnych. Po próbie stary indeks był na miejscu, a nowego nie było. 171 zapytań wybranych ręcznie, bez logów prawdziwych wyszukiwań.

| | Dziś | Po zmianie |
|---|---|---|
| Zapytania bez wyniku | 40 | 6 |
| Wyniki bez słowa o tym samym początku | nie liczono w tym zestawie | 69 z 9564 |
| Czas, rzadkie słowo (`pierogów`) | nie mierzono | 4 ms |
| Czas, `ciasto z jabłkami` | 12 ms | 98 ms |

Zniknęły 34 wyniki: 33 dla `dyni` i 1 dla `zup`. W sprawdzonej próbce były to prawie same przepisy z budyniem.

**Nie dowodzi:** miara szumu zaniża wynik, bo patrzy tylko na początek słowa (`cukina` łapie „cukier”, a to się nie liczy). „Moje” i „Ulubione” nie były sprawdzone na zalogowanym koncie. Krótkie słowa są szerokie: `mak` 527 wyników (łapie „mąkę”), `pier` 705 (łapie „pieprz”).

**Status:** migracja wgrana, patrz wpis wyżej.

### Wyszukiwarka: Pagefind, dziś i `pg_trgm`

**Jak:** Pagefind 1.6 lokalnie, indeks z 925 przepisów (tytuł i składniki), `forceLanguage: pl`. Te same 90 zapytań w każdej opcji. `pg_trgm` to `word_similarity` z progiem 0,6 na tekście bez polskich znaków, zapytaniem tylko do odczytu.

| | Dziś | Pagefind | Pagefind po czyszczeniu indeksu | `pg_trgm` 0,6 |
|---|---|---|---|---|
| Zapytania bez wyniku | 29 | 3 | 1 | 6 |
| Wyniki przypadkowe | 20 z 2013 (1%) | 3031 z 11448 (26%) | 1955 z 10816 (18%) | 141 z 8051 (2%) |

Próg `pg_trgm` na 151 zapytaniach: 0,5 to 925 przypadkowych wyników i 1 puste zapytanie, 0,6 to 150 i 6, 0,7 to 42 i 18.

Pagefind: `żurek` 562 wyniki, prawie same przypadkowe; `kasza` 256, z czego 232 przypadkowe; „mak” łączy z „mąką”; `makron` 489. Pierwsze wyszukiwanie pobiera około 170 KB bez kompresji serwera, indeks ma 946 plików i 2,1 MB.

**Wniosek:** Pagefind odrzucony, bo polski stemming za mocno skraca słowa. Dalej poszło `pg_trgm`.

**Nie dowodzi:** zapytania wybrane ręcznie; miara szumu zaniża wynik także dla Pagefind.

### Wszystkie przepisy jako pliki (PR #723)

**Jak:** scalenie o 12:10, build `master` gotowy o 12:13. Losowa próbka 60 z 925 adresów z sitemapy, `pnpm smoke:prod`, przepis spoza pilotażu w przeglądarce.

**Wynik:** 60 z 60 odpowiedziało 200 bez Workera (brak nagłówka `x-opennext`). `pnpm smoke:prod` przeszedł. „Smażaniki z kiełbasą” wyświetlają się poprawnie, bez błędów w konsoli i bez poziomego przewijania.

**Nie dowodzi:** strona główna, kategorie, `/szukaj` i zapytania `.rsc` dalej idą przez Workera, więc tam 503 może wracać. Widok zalogowanego nie był sprawdzany. Uper SEO po wdrożeniu jeszcze nie powtórzony.

### Automatyczne odświeżanie plików

**Jak:** ręczne podbicie `content_version` z 0 na 1, bez zmiany treści przepisów, na 20 przepisach z pilotażu.

**Wynik:** podbicie 11:51:19, cron wywołał hook 11:55:39, nowe pliki na produkcji najpóźniej 11:57:54. `pnpm smoke:prod` przeszedł po tym buildzie.

**Nie dowodzi:** czasu builda dla wszystkich przepisów. Ten pierwszy build `master` trwał około 3 minut 40 sekund.

### Wyłącznik jednego adresu

**Jak:** tymczasowa reguła Single Redirect 302 na `/przepis/salatka-kongresowa`, przepis podawany z pliku.

| Adres | Wynik z regułą |
|---|---|
| zwykły, z `?x=1`, z `?_rsc=abc` | 302 na stronę główną |
| `http://` i `www.` | 302 na stronę główną |
| z `/` na końcu | 307 na adres bez ukośnika |
| inny przepis | 200 |

**Wynik:** reguła wygrywa z plikiem. Po jej usunięciu przepis wrócił z pełną treścią. Formularz Cloudflare domyślnie ustawia 301, trzeba wybrać 302. Instrukcja: [recipe-files.md](recipe-files.md).

### Uper SEO: analiza sitemapy przed plikami dla wszystkich

**Jak:** analizator sitemapy właściciela, 946 adresów, sam zwalnia przy obciążeniu. Wersja `10cf9b49`, 20 przepisów z plików.

**Wynik:** 6 błędów 503 na 444 sprawdzone adresy w chwili odczytu. W tym czasie przepis z pliku dał 200, a przepis z Workera i kategoria 1102. Końcowy wynik analizy nieznany.

Dane Cloudflare (wersja, godzina):

| Godzina | Wersja | Udane | Limit CPU | Rozłączenia |
|---|---|---|---|---|
| 08:00 | `10cf9b49` | 445 | 3 | 0 |
| 09:00 | `10cf9b49` (analiza) | 525 | 82 | 24 |
| 09:00 | `7467701b` (tuż po wdrożeniu) | 39 | 12 | 17 |
| 10:00 | `7467701b` (po ciszy) | 14 | 0 | 0 |

`pnpm smoke:prod`: 4 z 30 przepisów padło przed wdrożeniem, 12 z 30 tuż po nim, `✓` po 30 cichych minutach (10:14).

**Wniosek:** to najlepszy test z prawdziwego życia. Powtórzyć po każdej dużej zmianie.

### Eksport wszystkich przepisów do plików

**Jak:** eksport lokalny, potem build próbnej gałęzi w Cloudflare i próbka na jej podglądzie.

**Wynik:** 925 z 925 w 34 sekundy, 171 MB HTML, 1005 plików statycznych. Build w Cloudflare około 4 minut (szacunek z czasów wersji). 61 z 61 przepisów z próbki podanych bez Workera.

**Uwaga:** pierwszy build `master` z PR #722 padł po 15 minutach 38 sekundach na wysyłce do R2 (`zapiszprzepis-inc-cache`, timeout). Retry przeszedł w około 2 minuty. Przyczyna nieznana.

## 2026-11-05 i wcześniej

### Pilotaż: 20 przepisów jako pliki (PR #720)

**Jak:** 100 żądań w tempie około 3 na sekundę po 30 cichych minutach, wersja `10cf9b49`. Telefon: CPU 4x i wolne 4G, te same przepisy.

| | Pliki | Worker |
|---|---|---|
| 100 żądań | 100 z 100, mediana 0,09 s | 100 z 100, mediana 0,96 s |
| LCP | 1660 ms | 2156 ms |
| TBT | 191 ms | 243 ms |
| CLS | 0 | 0 |

**Nie dowodzi:** odporności na 503, bo w tym teście Worker też przeszedł wszystko. Później, w nocy, 150 przepisów na zmianę z plików i Workera przeszło 150 z 150 po obu stronach. Tempo 3 na sekundę było celem, realnie 1-2.

### Próba obciążeniowa przepisów na Workerze

**Jak:** 150 różnych przepisów po kolei, bez ponawiania i bez ciasteczek.

| Data | Wersja | Błędy na 150 |
|---|---|---|
| 2026-11-04 | przed #719 | 69 (12% w pierwszych 50, 84% w ostatnich 50) |
| 2026-11-05 | `9ee008cc` | 26 |
| 2026-11-05 | `e308ff40` (#719) | 62, potem 42, kilka minut po innych testach |

Mediana CPU udanego renderu: około 85 ms na `9ee008cc`, 45 ms na `e308ff40`, przy limicie 10 ms. Po serii 40 przepisów co 2 sekundy padło 16 z 40 na produkcji, a na adresie podglądu tej samej wersji 0 z 40. Po 30 cichych minutach produkcja przeszła 40 z 40.

**Nie dowodzi:** przyczyny utrzymywania się błędów po obciążeniu, wciąż nieznanej. Sam `pnpm smoke:prod` jest za krótki, żeby ocenić poprawkę: w jednej godzinie raz przeszedł, raz nie.
