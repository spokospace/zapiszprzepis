# Wyniki testów i pomiarów

Dziennik pomiarów produkcji i prób rozwiązań. Nowe wpisy na górze, godziny w UTC. Każdy wpis mówi, co zmierzono, jak, wynik i czego wynik nie dowodzi.

Przed porównywaniem liczb: testy obciążeniowe rozdzielaj co najmniej 30 cichymi minutami, bo błędy trwają dłużej niż samo obciążenie. Pomiary zrobione kilka minut po sobie nie są porównywalne.

## 2026-11-06

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

**Status:** migracja niewgrana, czeka na zgodę właściciela.

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
