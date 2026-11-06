# Wyniki testów i pomiarów

Dziennik pomiarów produkcji i prób rozwiązań. Nowe wpisy na górze, godziny w UTC. Każdy wpis mówi, co zmierzono, jak, wynik i czego wynik nie dowodzi.

Przed porównywaniem liczb: testy obciążeniowe rozdzielaj co najmniej 30 cichymi minutami, bo błędy trwają dłużej niż samo obciążenie. Pomiary zrobione kilka minut po sobie nie są porównywalne.

## 2026-11-06

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
