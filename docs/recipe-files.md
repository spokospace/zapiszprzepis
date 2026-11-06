# Przepisy jako pliki: odświeżanie i pilne zdjęcie strony

Strony `/przepis/{slug}` są plikami zapisanymi podczas builda. Cloudflare podaje je bez uruchamiania Workera, więc zmiany w bazie nie widać od razu.

## Jak zmiana trafia na stronę

1. Trigger w bazie podnosi `content_version`, gdy zmieni się przepis albo profil.
2. Cron Workera co 5 minut porównuje tę liczbę z `recipe-files-version.json` z ostatniego builda.
3. Gdy pliki są w tyle, cron woła deploy hook `RECIPE_FILES_DEPLOY_HOOK`: najwyżej raz na 10 minut i 12 razy na dobę (UTC).
4. Build trwa około 4-7 minut.

Zwykle zmiana lub usunięcie przepisu widać więc po około 10-15 minutach. Bez sekretu `RECIPE_FILES_DEPLOY_HOOK` pliki zostają stare aż do następnego builda `master`, dlatego `"all"` w `scripts/recipe-files.json` wymaga hooka.

Po 12 buildach w ciągu doby kolejna zmiana czeka do północy UTC albo do ręcznego Retry.

## Pilne zdjęcie jednej strony

Dla sprawy prawnej albo danych, które nie mogą czekać na build. Sprawdzone 2026-11-06 na przepisie podawanym z pliku: reguła wygrywa z plikiem, działa w kilkadziesiąt sekund od zapisania i obejmuje też adresy z query string, HTTP i ukośnikiem na końcu (ten przez przekierowanie). Po jej usunięciu przepis wraca od razu.

1. Cloudflare → strefa `zapiszprzepis.pl` → Rules → Redirect Rules → Create rule (Single Redirect; plan Free ma 10 reguł).
2. Warunek: `URI Path` równa się `/przepis/{slug}`.
3. Akcja: Static, adres `https://zapiszprzepis.pl/`, kod 302 (domyślne 301 przeglądarki zapamiętują na stałe), bez zachowania query string. Wdróż.
4. Sprawdź:
   ```bash
   curl -sI https://zapiszprzepis.pl/przepis/{slug}
   ```
   Ma odpowiedzieć 302 z `Location: https://zapiszprzepis.pl/`.
5. Usuń albo ukryj przepis w bazie. Build usunie plik.
6. Gdy build się skończy, usuń regułę i sprawdź, czy adres odpowiada 404.

Reguła nie sięga do pamięci telefonu: kto otworzył przepis wcześniej, może mieć kopię w service workerze i zobaczy ją offline. Nie usuwa też zdjęć z magazynu.

Plik zniknie też bez reguły, po buildzie. Reguła skraca czas z kilkunastu minut do chwili jej zapisania.

## HTTP na HTTPS dla adresów z plików (do ustawienia w strefie)

Stan z 2026-11-06: `http://zapiszprzepis.pl/przepis/zapiekanka` odpowiada 200 bez przekierowania, bo `custom-worker.ts` (który robił to przekierowanie) nie działa na adresach podawanych z plików. Strefa nie ma włączonego „Always Use HTTPS”. Zmiana dotyczy całej strefy, więc robi ją właściciel.

1. Cloudflare → strefa `zapiszprzepis.pl` → SSL/TLS → Edge Certificates → **Always Use HTTPS** → włącz.
2. Sprawdź:
   ```bash
   curl -sI http://zapiszprzepis.pl/przepis/zapiekanka
   curl -sI http://www.zapiszprzepis.pl/
   ```
   Oba mają odpowiedzieć `301` z `Location: https://…`.
3. Sprawdź, że nic nie zapętla się z regułą kill switch (302 na `/` powyżej) i że `pnpm smoke:prod` przechodzi.

Opcjonalnie dodaj **Automatic HTTPS Rewrites** (SSL/TLS → Edge Certificates), jeśli gdzieś zostały adresy `http://` w treści. Cofnięcie: wyłącz przełącznik.

## Powrót do Workera

`[]` w `scripts/recipe-files.json` i build `master`: wszystkie przepisy znów idą przez Workera.
