# Przepisy jako pliki: odświeżanie i pilne zdjęcie strony

Strony `/przepis/{slug}` są plikami zapisanymi podczas builda. Cloudflare podaje je bez uruchamiania Workera, więc zmiany w bazie nie widać od razu.

## Jak zmiana trafia na stronę

1. Trigger w bazie podnosi `content_version`, gdy zmieni się przepis albo profil.
2. Cron Workera co 5 minut porównuje tę liczbę z `recipe-files-version.json` z ostatniego builda.
3. Gdy pliki są w tyle, cron woła deploy hook `RECIPE_FILES_DEPLOY_HOOK`: najwyżej raz na 10 minut i 12 razy na dobę (UTC).
4. Build trwa około 4-7 minut.

Zwykle zmiana lub usunięcie przepisu widać więc po około 10-15 minutach. Bez sekretu `RECIPE_FILES_DEPLOY_HOOK` pliki zostają stare aż do następnego builda `master`, dlatego `"all"` w `scripts/recipe-files.json` wymaga hooka.

Po 12 buildach w ciągu doby kolejna zmiana czeka do północy UTC albo do ręcznego Retry.

## Gdy baza nie odpowiada, build się nie udaje

Pliki przepisów powstają z bazy podczas builda. Jeśli lista przepisów się nie wczyta albo wyeksportuje się mniej niż 90% przepisów, `scripts/export-recipe-files.mjs` kończy się błędem i build pada. Workers Builds niczego wtedy nie wdraża, więc na produkcji zostaje ostatnia dobra wersja. Wcześniej skrypt wypisywał „skipped” i build przechodził bez plików; 2026-11-11 przy zablokowanym Supabase (402) dało to 404 na każdym przepisie, bo Worker też nie mógł ich wyrenderować.

- CI (`.github/workflows/ci.yml`) nie ma bazy, więc ustawia `RECIPE_FILES_EXPORT=skip`: build bez plików przepisów, tylko do pomiaru Workera. Nigdy nie ustawiaj tego w Workers Builds.
- Gdy produkcja już straciła pliki: Cloudflare → Workers & Pages → zapiszprzepis → Deployments → **Rollback** przy ostatniej dobrej wersji (token projektu nie ma do tego uprawnień). Wersja zawiera swoje pliki, więc przepisy wracają od razu.
- Przed scaleniem czegokolwiek do `master` sprawdź, czy Supabase odpowiada; każde scalenie to build produkcji.

## Automatyczna kontrola po wdrożeniu

Build z deploy hooka nikt nie ogląda, a GitHub Actions nie ma minut. Dlatego cron co 5 minut (`src/lib/post-deploy-check.ts`) sprawdza każdą nową wersję Workera raz: `/szukaj` i trzy najstarsze przepisy muszą odpowiedzieć 200, a każdy plik `/_next/static`, który wskazują, musi się załadować (nie 404 i nie HTML w miejscu CSS/JS). Nie sprawdza tras z Workera (`/`, `/login`): 503 tam to znany problem obciążenia, a kontrola nie ma go zaogniać.

- Wynik: wiersz w Observability (`post-deploy: version … ok` albo `… FAILED`) i rekord `deploy-check/last.json` w R2 (`zapiszprzepis-backups`).
- Nieudaną kontrolę powtarza następne uruchomienie crona, do 3 prób na wersję.
- `FAILED` = to samo co czerwony `pnpm smoke:prod`: Builds → Retry ostatniego builda `master`, potem `pnpm smoke:prod`.
- Kontrola nie zastępuje `pnpm smoke:prod` po zmianie sekretu: ten sam cron ją uruchomi, bo zmiana sekretu też tworzy wersję.

## Strona główna jako plik

`/` jest zapisywana jak przepisy, jako `public/index.html`. „Przepis dnia” jest w pliku zamrożony, więc `recipe-files-version.json` zapisuje też `day` (dzień warszawski zapisanej strony), a cron co 5 minut prosi o build po polskiej północy (w ramach tych samych limitów: raz na 10 minut, 12 na dobę). Gdy `/` nie wyeksportuje się, `day` to `null`, strona zostaje na Workerze i dziennego builda nie ma. Kategorie (`/przepisy/{kategoria}`) nadal idą przez Workera: czytają `?tag=` i `?strona=` po stronie serwera, więc plik odpowiadałby na każdy wariant adresu tą samą treścią.

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

**Zrobione 2026-11-06 22:02 UTC** (włączone w panelu za zgodą właściciela, sprawdzone `curl -I`: 301 na `https://`). Przed zmianą `http://zapiszprzepis.pl/przepis/zapiekanka` odpowiadał 200 bez przekierowania, bo `custom-worker.ts` (który robił to przekierowanie) nie działa na adresach podawanych z plików. Kroki poniżej to opis i sposób sprawdzenia lub cofnięcia.

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
