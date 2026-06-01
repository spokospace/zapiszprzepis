---
name: 10x-agents-md
description: >
  Generate an AGENTS.md onboarding document for AI coding agents working in
  this repository. Inspects the repo (package manifest, README, scripts,
  lint/test config, layout, commit history) and writes a concise contributor
  guide titled "Repository Guidelines". Use when the user invokes
  /10x-agents-md, asks to "create AGENTS.md", "write an agent onboarding
  doc", "generate contributor guide for agents", or similar. The output is
  optimized to be small, precise, reference-heavy, and ordered with critical
  rules at the top — so a future agent reads it once and stays unblocked.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
  - AskUserQuestion
---

# 10x Agents MD

Utwórz plik `AGENTS.md`, który będzie służył jako dokument wprowadzający dla agentów kodujących AI w tym repozytorium. Plik jest krótki, specyficzny dla repozytorium i ma strukturę, w której najważniejsze zasady pojawiają się na początku.

## Rozwiązanie wejścia

`$ARGUMENTS` jest opcjonalny. Może to być:

- pusty → zapisz do `AGENTS.md` w katalogu głównym repozytorium.
- ścieżka do katalogu → zapisz `AGENTS.md` w tym katalogu (przydatne dla zagnieżdżonych przewodników dla poszczególnych obszarów, np. `src/api/AGENTS.md`).
- pełna ścieżka pliku kończąca się na `.md` → zapisz tam dosłownie.

Jeśli plik docelowy już istnieje, **nie** nadpisuj go po cichu. Przejdź do przepływu aktualizacji w sekcji „Procedura → Ścieżka aktualizacji”. Domyślne zachowanie to edycja chirurgiczna, która zachowuje nadal prawidłową zawartość, a nie przepisanie.

## Wykrywanie zakresu — na poziomie repozytorium vs. na poziomie katalogu

Ta sama umiejętność może wytworzyć dwa istotnie różne dokumenty w zależności od tego, **skąd** jest wywoływana. Wykryj zakres przed odkryciem, aby szkic był skierowany na właściwą wysokość.

1. **Rozwiąż katalog docelowy.** Jeśli `$ARGUMENTS` określa ścieżkę, to jest to cel. W przeciwnym razie jest to bieżący katalog roboczy (`pwd`).
2. **Porównaj z katalogiem głównym repozytorium.** Uruchom `git rev-parse --show-toplevel`. Jeśli katalog docelowy jest równy katalogowi głównemu repozytorium → **zakres na poziomie repozytorium**. Jeśli jest to podkatalog (np. `src/components/`, `packages/api/src/routes/`, `app/api/`) → **zakres na poziomie katalogu**.

**Zakres na poziomie repozytorium.** Postępuj zgodnie z procedurą i „Strukturą wyjściową” poniżej w niezmienionej formie — dokument jest ogólnym przewodnikiem wprowadzającym (struktura projektu, polecenia kompilacji, brama CI, konwencje commitów itp.).

**Zakres na poziomie katalogu.** Całkowicie pomiń ramkę wprowadzającą do repozytorium. Czytelnik już zna repozytorium; potrzebuje zasad *tego* katalogu. Zmień orientację odkrywania i wyjścia:

- **Najpierw odkryj lokalnie.** Sprawdź pliki faktycznie znajdujące się obok celu: pliki źródłowe rodzeństwa, najbliższy `index.*`/`mod.rs`/`__init__.py`, współlokalizowane testy, plik README katalogu nadrzędnego, jeśli istnieje, oraz wszelkie zagnieżdżone konfiguracje (np. `tsconfig.json`, `.eslintrc`, manifesty tras), które nadpisują domyślne ustawienia na poziomie repozytorium. Konsultuj dokumenty z katalogu głównego repozytorium (`README.md`, `CLAUDE.md`) tylko w celu **rozwiązania konfliktów** lub pobrania pojedynczego kanonicznego odniesienia `@` — nie jako główne źródło.
- **Wywnioskuj lokalny wzorzec, czytając rodzeństwo.** Jaki kształt przyjmują istniejące pliki w tym katalogu? Układ plików komponentów, nazewnictwo (`PascalCase.tsx`, `kebab-case.ts`, `*.handler.ts`), eksporty domyślne vs. nazwane, konwencje prop/argumentów, gdzie znajdują się typy/style/testy względem jednostki, idiomy obsługi błędów, co jest importowane skąd. AGENTS.md zawiera zaobserwowaną konwencję, a nie ogólne porady.
- **Przeformułuj sekcje wokół jednostki lokalnej.** Zastąp sekcje na poziomie repozytorium sekcjami istotnymi dla katalogu. Przydatne wartości domyślne (dostosuj do tego, co jest):
  - *Dodawanie nowej \<jednostki\>* — konkretne kroki dla dominującego artefaktu w tym katalogu (komponent, handler trasy, migracja, hook, worker itp.), cytując jedno istniejące rodzeństwo jako kształt referencyjny za pomocą `@./<sibling-file>`.
  - *Układ plików i nazewnictwo* — wzorzec nazewnictwa, zasady współlokalacji (test obok źródła? style wbudowane? typy w pliku rodzeństwa?), polityka eksportu zbiorczego, jeśli istnieje.
  - *Lokalne konwencje* — kształt props/args, zasady stanu/przepływu danych, dozwolone importy (i zabronione — np. „komponenty w tym katalogu nie mogą importować z `src/server/`”), zasady dostępności lub i18n widoczne w rodzeństwie.
  - *Testowanie tej jednostki* — wzorzec testowy używany przez sąsiadów, jak uruchomić testy tylko tego katalogu.
  - *Pułapki* — specyficzne dla katalogu zasady „nigdy nie rób X” widoczne w rodzeństwie lub pobliskim fragmencie CLAUDE.md.
- **Pomiń sekcje na poziomie repozytorium.** Brak mapy struktury projektu najwyższego poziomu, brak listy pakietów monorepo, brak globalnego przeglądu kompilacji/CI, brak podsumowania konwencji commitów — te należą do głównego `AGENTS.md`. Jeśli czytelnik ich potrzebuje, podaj link raz: `Zobacz @AGENTS.md w katalogu głównym repozytorium, aby zapoznać się z zasadami obowiązującymi w całym repozytorium.`
- **Budżet długości maleje.** Celuj w **120–250 słów** treści dla przewodników na poziomie katalogu; powierzchnia jest mniejsza, a wypełnianie tutaj jest gorsze niż w katalogu głównym.

Zabezpieczenia jakości nadal obowiązują, z jednym zastąpieniem: zabezpieczenie 5 („Krytyczne zasady na początku”) staje się „Zasady lokalne na początku” — najbardziej wpływowa linia to ta, która zapobiega lądowaniu w tym katalogu pliku o niewłaściwym kształcie.

## Interaktywne podpowiedzi — niezależne od hosta

Ilekroć procedura mówi „zapytaj użytkownika”, użyj dowolnego narzędzia do interaktywnych pytań, które udostępnia agent hosta. Umiejętność jest niezależna od hosta; nie koduj na stałe nazwy narzędzia. Znane odpowiedniki (niepełna lista):

- Claude Code → `AskUserQuestion`
- Cursor → `ask_question`
- OpenAI Codex / Codex CLI → `request_user_input`
- Inne uprzęże → poszukaj dowolnego narzędzia, którego opis wspomina o zadawaniu użytkownikowi ustrukturyzowanego pytania z opcjami.

**Zasada samodzielnego odkrywania.** Przed pierwszym interaktywnym krokiem przeskanuj dostępne narzędzia pod kątem jednego pasującego do powyższych wzorców (nazwy zawierające `ask`, `question`, `input`, `prompt_user` itp., z parametrem `question` lub `prompt` i polem `options`/`choices`). Użyj pierwszego dopasowania. Jeśli żadne nie jest dostępne, wróć do zwykłej wiadomości konwersacyjnej, prosząc użytkownika o odpowiedź jedną z oznaczonych opcji — nie blokuj procedury.

Podaj, które narzędzie wybrałeś (lub że wróciłeś do zwykłego czatu) za pierwszym razem, gdy zadajesz pytanie, aby użytkownik mógł cię poprawić, jeśli istnieje lepsza opcja.

## Równoległe badania za pomocą subagentów (opcjonalnie)

Jeśli host udostępnia narzędzie do tworzenia subagentów / zadań, kroki odkrywania i różnicowania są czysto równoległe — są to głównie niezależne odczyty. Znane odpowiedniki (niepełna lista):

- Claude Code → `Agent` (z typami subagentów `Explore`/`general-purpose`)
- Cursor → subagenci w tle
- OpenAI Codex → narzędzie do delegowania zadań (jeśli dostępne)
- Inne uprzęże → poszukaj dowolnego narzędzia, które tworzy izolowanego agenta z własnym oknem kontekstu i zwraca podsumowanie.

**Zasada samodzielnego odkrywania.** Przed rozpoczęciem odkrywania sprawdź, czy takie narzędzie istnieje. Jeśli tak, rozdziel niezależne odczyty w **jednym wywołaniu wsadowym** (wielu subagentów w jednej wiadomości, a nie sekwencyjnie):

- jeden subagent czyta `README.md`, `CLAUDE.md`, istniejący `AGENTS.md`, indeks `docs/` najwyższego poziomu;
- jeden sprawdza manifest + konfiguracje lint/format/typ;
- jeden sprawdza konfigurację testów + przepływy pracy CI;
- jeden uruchamia zapytania historii git (konwencje commitów, ostatni dotyk na AGENTS.md, zakres różnic od `LAST_TOUCH`).

Każdy subagent powinien zwrócić **krótki ustrukturyzowany raport** (≤200 słów: tylko fakty, z cytatami `path:line`) — a nie pełny zrzut pliku. Główny agent następnie syntetyzuje AGENTS.md z tych raportów.

**Kiedy nie używać subagentów.** Pomiń rozgałęzienie, jeśli:

- repozytorium jest małe (poniżej ~20 plików najwyższego poziomu) — narzut przewyższa oszczędności;
- host nie obsługuje subagentów — wróć do sekwencyjnych odczytów w głównej pętli;
- większość odpowiednich plików została już załadowana w bieżącym kontekście — ponowne odczytywanie za pomocą subagenta tylko spala tokeny.

**Nie deleguj** kroku syntezy (tworzenia szkicu i sprawdzania zabezpieczeń jakości). Tworzenie szkicu wymaga utrzymania pełnego obrazu w jednym kontekście, aby wymusić budżet 200–400 słów, kolejność i politykę odniesień `@`.

## Czego ta umiejętność NIE robi

- Nie wymyśla faktów projektu. Każde twierdzenie w wynikach musi odnosić się do pliku, polecenia lub commita, który faktycznie sprawdziłeś.
- Nie osadza wieloliniowych fragmentów kodu ani konfiguracji. Zamiast tego użyj odniesień `@` do kanonicznych plików (np. `@package.json`, `@tsconfig.json`, `@docs/architecture.md`).
- Nie pisze ogólnych porad inżynierskich („pisz czysty kod”, „stosuj najlepsze praktyki”, „prawidłowo obsługuj błędy”). Jeśli zasady nie można sprawdzić w stosunku do różnicy, usuń ją lub przepisz konkretnie.
- Nie powtarza domyślnych ustawień frameworka, samouczków językowych ani niczego, co agent już wie z treningu. Tylko wiedza specyficzna dla projektu zasługuje na linię.
- Nie edytuje niepowiązanych plików. Umiejętność zapisuje jeden plik markdown i zatrzymuje się.

## Procedura

**Najpierw rozgałęź się na podstawie istnienia.** Przed odkryciem czegokolwiek innego sprawdź, czy rozwiązana ścieżka docelowa już istnieje (użyj `Read` lub `ls`). Jeśli tak, postępuj zgodnie z **Ścieżką aktualizacji** poniżej. Jeśli nie, postępuj zgodnie z **Ścieżką tworzenia**.

### Ścieżka tworzenia

1. **Odkryj.** Czytaj w tej kolejności, pomijając to, co nie istnieje:
   - `README.md`, `CLAUDE.md`, istniejący `AGENTS.md`, indeks `docs/` najwyższego poziomu.
   - Manifest: `package.json` (skrypty, obszary robocze, silniki) lub `pyproject.toml` / `Cargo.toml` / `go.mod` / `Gemfile` / odpowiednik.
   - Konfiguracje lint/format/typ: `.eslintrc*`, `oxlint*`, `biome.json`, `tsconfig.json`, `ruff.toml`, `.editorconfig`.
   - Konfiguracja testów: `vitest.config.*`, `jest.config.*`, `pytest.ini`, `playwright.config.*`, lokalizacje `*.test.*`.
   - CI: `.github/workflows/*` (jeden lub dwa pliki; wystarczy, aby poznać bramę).
   - Układ: dwa najwyższe poziomy drzewa (ograniczone `ls`/`find`), lista pakietów obszaru roboczego, jeśli monorepo.
   - Historia: `git log --oneline -n 30`, aby poznać konwencje wiadomości commitów; `git config remote.origin.url` dla celu PR.
2. **Wyodrębnij.** Z odkrycia zapisz dla siebie:
   - 1–3 polecenia, które agent uruchamia najczęściej (kompilacja, testowanie, lint, serwer deweloperski).
   - Kilka konwencji, które recenzent faktycznie oznaczyłby w recenzji PR (wzorce nazewnictwa, układ plików, styl prefiksu commita).
   - Jakiekolwiek twarde zasady „nigdy nie rób X” widoczne w CLAUDE.md, README lub walidatorach CI.
   - Gdzie znajdują się głębsze dokumenty, aby AGENTS.md mógł do nich wskazywać zamiast duplikować.
3. **Szkic.** Napisz plik zgodnie z „Strukturą wyjściową” poniżej.
4. **Samokontrola przed zapisaniem.** Uruchom pięć zabezpieczeń w „Zabezpieczeniach jakości”. Jeśli którekolwiek zawiedzie, popraw szkic, nie zapisuj jeszcze.
5. **Zapisz.** Pojedyncze wywołanie `Write` do rozwiązanej ścieżki. Potwierdź ścieżkę i liczbę słów użytkownikowi.

### Ścieżka aktualizacji

Uruchamiana, gdy plik docelowy już istnieje. Domyślnie jest to **edycja chirurgiczna**: zachowaj to, co jest nadal prawdziwe, napraw to, co jest nieaktualne, uzupełnij to, czego brakuje, i usuń to, co zostało usunięte z repozytorium. Nie przepisuj od zera, chyba że użytkownik o to poprosi.

1. **Zainwentaryzuj istniejący plik.**
   - `Read` cały plik.
   - Wymień jego bieżące sekcje (nagłówki H1/H2/H3) oraz zasady/polecenia pod każdą z nich.
   - Wyodrębnij każde odniesienie `@` i każdą względną ścieżkę lub nazwę pliku, którą cytuje.

2. **Datuj plik za pomocą git.**
   - `git log --follow --format="%h %ad %s" --date=short -- <path>` — pełna historia edycji pliku.
   - Zauważ **hash commita ostatniego dotyku** i datę. Nazwij to `LAST_TOUCH`.
   - Jeśli plik jest nieśledzony (`git ls-files --error-unmatch <path>` zawodzi), traktuj go jako świeżo utworzony: pomiń kroki git-diff i uruchom pełne odkrywanie ścieżki tworzenia, ale nadal zachowaj wszelkie oczywiście specyficzne dla projektu treści, które napisał użytkownik.

3. **Porównaj stan repozytorium od `LAST_TOUCH`.** Użyj tych sprawdzeń (pomiń te, do których plik nie odwołuje się):
   - `git diff --stat LAST_TOUCH..HEAD -- README.md CLAUDE.md docs/` — czy dokumentacja najwyższego poziomu została przeniesiona lub zmieniona?
   - `git diff LAST_TOUCH..HEAD -- package.json pyproject.toml Cargo.toml go.mod` (którykolwiek istnieje) — dla **skryptów**, **zależności**, **silników**, **obszarów roboczych**. Zwróć szczególną uwagę na blok `scripts`: zmienione/dodane/usunięte skrypty są najczęstszym źródłem nieaktualnej zawartości AGENTS.md.
   - `git diff LAST_TOUCH..HEAD -- .eslintrc* oxlint* biome.json tsconfig.json ruff.toml .editorconfig` — czy zmienił się zestaw narzędzi lint/format/typ?
   - `git diff LAST_TOUCH..HEAD -- vitest.config.* jest.config.* pytest.ini playwright.config.*` — czy zmienił się stos testowy lub układ?
   - `git diff --stat LAST_TOUCH..HEAD -- .github/workflows/` — czy zmieniła się brama CI?
   - `git log --oneline LAST_TOUCH..HEAD -- <commit-conventions-relevant-area>` i `git log --oneline -n 30` — czy obserwacja stylu commita w pliku nadal pasuje do najnowszej historii?
   - Dla każdego odniesienia `@` i ścieżki wymienionej w pliku: `ls`/`Read` ścieżkę. Jeśli już nie istnieje lub została zmieniona nazwa, ta linia jest nieaktualna.

4. **Sklasyfikuj każdą linię istniejącego pliku** do jednego z czterech kubełków:
   - **ZACHOWAJ** — nadal dokładne; cytowany plik/polecenie/ścieżka nadal istnieje w tej samej formie.
   - **AKTUALIZUJ** — kierunkowo poprawne, ale szczegół jest nieaktualny (zmieniony skrypt, przeniesiona ścieżka, zmienione narzędzie, zwiększona wersja). Zauważ dokładne zastąpienie.
   - **USUŃ** — bazowy plik/polecenie/konwencja już nie istnieje, lub zasada została sprzeczna z nowszym źródłem (CLAUDE.md, README), któremu bardziej ufasz.
   - **BRAKUJĄCE** — obecnie nie ma w pliku, ale powinno być (nowy pakiet najwyższego poziomu, nowy wymagany skrypt, nowa zasada „nigdy nie rób X” wprowadzona przez walidator CI, nowa konwencja commitów widoczna w `git log`).
   Zachowaj tę klasyfikację jako krótką tabelę, którą możesz pokazać użytkownikowi. Cytuj `path:line` (w istniejącym AGENTS.md) dla każdego wpisu AKTUALIZUJ/USUŃ i cytuj ścieżkę źródła prawdy (np. `package.json:42`) dla każdego wpisu AKTUALIZUJ/BRAKUJĄCE.

5. **Potwierdź zakres przed edycją.** Użyj narzędzia do interaktywnych pytań hosta raz (patrz „Interaktywne podpowiedzi — niezależne od hosta” powyżej) z tymi opcjami:
   - **Zastosuj proponowane aktualizacje** — wykonaj listę AKTUALIZUJ/USUŃ/BRAKUJĄCE jako ukierunkowane wywołania `Edit`; linie ZACHOWAJ nie są dotykane.
   - **Pokaż mi najpierw listę zmian** — wydrukuj tabelę klasyfikacji na czacie, bez edycji, a następnie zapytaj ponownie.
   - **Pełna regeneracja** — odrzuć istniejący plik i uruchom ścieżkę tworzenia. Używaj tylko wtedy, gdy istniejący plik jest w większości nieaktualny lub użytkownik wyraźnie chce czystej karty.
   - **Anuluj** — brak zmian.

6. **Edytuj chirurgicznie.** Dla wyboru „Zastosuj” preferuj wiele małych wywołań `Edit` (jedno na wpis AKTUALIZUJ/USUŃ/BRAKUJĄCE) zamiast pojedynczego przepisania `Write`. Zachowuje to głos autora w sekcjach ZACHOWAJ i tworzy możliwą do przejrzenia różnicę. Jeśli kolejność sekcji narusza zabezpieczenie „krytyczne zasady na początku” z zabezpieczeń jakości, a użytkownik zatwierdził aktualizacje, możesz przenosić całe sekcje — ale tylko sekcje, nigdy nie zmieniaj cicho sformułowania zasad.

7. **Ponownie uruchom zabezpieczenia jakości** na zaktualizowanym pliku. Obowiązuje tych samych pięć bram. Jeśli zabezpieczenie teraz zawiedzie z powodu aktualizacji (np. treść przekroczyła 400 słów po dodaniu BRAKUJĄCYCH), przytnij zawartość ZACHOWAJ, która stała się mało wartościowa, zamiast usuwać nową zawartość BRAKUJĄCĄ.

8. **Raport.** Potwierdź ścieżkę, nową liczbę słów i jednoliniowe podsumowanie tego, co zmieniło się w każdym kubełku (np. „3 zaktualizowane, 1 usunięty, 2 dodane; kolejność sekcji bez zmian”).

## Struktura wyjściowa

Tytuł dokumentu to `# Repository Guidelines`. Docelowa długość to **200–400 słów** treści. Użyj nagłówków Markdown do struktury. Dostosuj sekcje do tego, co faktycznie zawiera repozytorium — pomiń każdą sekcję, która byłaby pusta lub spekulatywna.

Uporządkuj sekcje według **wpływu na świeżego agenta**, a nie według tradycji. Krytyczne zasady i najczęściej używane polecenia idą na początku; mniej ważne informacje na końcu. Przydatna domyślna kolejność, w razie wątpliwości:

1. **Twarde zasady / Instrukcje specyficzne dla agenta** — lista „nigdy nie rób X” i wszelkie pułapki (uwzględnij tylko, jeśli repozytorium faktycznie je ma; w przeciwnym razie pomiń i pozwól konwencjom ponieść ciężar).
2. **Struktura projektu i organizacja modułów** — mapa katalogów najwyższego poziomu, gdzie znajdują się źródła/testy/zasoby, lista pakietów monorepo, jeśli dotyczy. Odwołuj się do głębszych dokumentów za pomocą `@path/to/doc.md` zamiast wstawiać je bezpośrednio.
3. **Polecenia kompilacji, testowania i rozwoju** — 3–6 poleceń, które agent faktycznie uruchomi, każde z jednoliniowym celem. Preferuj `pnpm <script>` / `make <target>` / itp. zamiast surowych wywołań narzędzi, gdy projekt je opakowuje.
4. **Styl kodowania i konwencje nazewnictwa** — wcięcia, wersja języka, wzorce nazewnictwa (z jednym krótkim przykładem wzorca, a nie blokiem kodu) oraz narzędzia lint/format, które je wymuszają.
5. **Wytyczne dotyczące testowania** — framework, gdzie znajdują się testy, wzorzec nazewnictwa, jak uruchomić pojedynczy test, wszelkie progi pokrycia, które repozytorium faktycznie sprawdza.
6. **Wytyczne dotyczące commitów i żądań ściągnięcia** — konwencja obserwowana w `git log` (np. widziane prefiksy Conventional Commits), oczekiwania dotyczące opisu PR, wymagane sprawdzenia CI.
7. **Wskazówki dotyczące bezpieczeństwa i konfiguracji** *(opcjonalnie)* — obsługa sekretów, lokalizacja pliku env, skrypty walidacyjne, które powodują błąd CI.
8. **Przegląd architektury** *(opcjonalnie, tylko jeśli nie został już objęty odniesieniem `@`)* — maksymalnie 3–6 punktów; w przeciwnym razie podaj link.

Rozpocznij plik krótkim akapitem (1–2 zdania) określającym, czym jest projekt i jaki jest główny stos — wystarczająco, aby agent lądujący w repozytorium po raz pierwszy miał punkt odniesienia. Bez misji, wprowadzeń zespołu ani wartości.

## Zabezpieczenia jakości (uruchamiane przed `Write`)

Każde zabezpieczenie jest twardą bramą. Jeśli którekolwiek zawiedzie, popraw szkic.

1. **Długość.** Treść ma 200–400 słów. Poniżej 200 oznacza, że pominąłeś szczegóły; powyżej 400 oznacza, że wypełniłeś lub włączyłeś to, co powinno być odniesieniem.
2. **Brak wieloliniowych fragmentów.** Brak bloków kodu dłuższych niż pojedyncza linia polecenia. Zastąp przykładowe komponenty / konfiguracje / migracje za pomocą `@path/to/file`. Krótkie jednoliniowe przykłady poleceń (`pnpm test`, `git rebase main`) są w porządku.
3. **Każda zasada jest sprawdzalna.** Przeczytaj ponownie każde zdanie i zadaj sobie pytanie: *czy recenzent mógłby zgłosić różnicę w stosunku do tego?* Jeśli nie, przepisz ją z konkretnym wzorcem, progiem lub nazwanym narzędziem. Usuń frazy takie jak „czysty kod”, „najlepsze praktyki”, „nowoczesne wzorce”, „bądź konsekwentny”, „prawidłowo obsługuj błędy”, „zachowaj prostotę”.
4. **Brak zbędnej wiedzy.** Usuń każdą linię, którą mógłbyś napisać bez otwierania repozytorium. Domyślne ustawienia frameworka, samouczki językowe i definicje typowych terminów nie zasługują na miejsce. Jeśli zasada duplikuje `README.md` / `package.json` / konfigurację lint, zastąp ją `@README.md` / `@package.json` / `@.eslintrc.json`.
5. **Krytyczne zasady na początku.** Pierwsza trzecia pliku musi zawierać zasady o najwyższym znaczeniu i najczęściej używane polecenia. Jeśli jedyna zasada „nigdy nie rób X” znajduje się na dole, przenieś ją na górę. Jeśli na górze znajduje się powitanie/misja/wartości, usuń je.

## Ton

Profesjonalny, instruktażowy, zwięzły. Druga osoba („Uruchom `pnpm test` przed wypchnięciem”) lub tryb rozkazujący („Umieść nowe handlery w `src/api/<feature>/`”). Bez języka marketingowego, bez emotikonów, bez ozdobnych separatorów.

## Po napisaniu

Zgłoś użytkownikowi:

- zapisaną ścieżkę pliku,
- liczbę słów w treści,
- jednoliniowe podsumowanie wybranej kolejności sekcji,
- przypomnienie: *przetestuj plik, uruchamiając prawdziwe zadanie z nową sesją agenta — dokumenty wprowadzające sprawdzają się dopiero przy następnym uruchomieniu.*

Nie proponuj dalszych działań, chyba że użytkownik o to poprosi.

## Przypadki brzegowe

- **Nie wykryto `README.md` i manifestu.** Zatrzymaj się i poinformuj użytkownika, że repozytorium wygląda na puste lub nieznane; poproś o jednoliniowy opis projektu przed sporządzeniem szkicu.
- **Monorepo z plikami README dla każdego pakietu.** Utwórz główny `AGENTS.md`, który wymienia pakiety i odwołuje się do każdego pliku README pakietu za pomocą `@`, zamiast duplikować szczegóły dla każdego pakietu. Zasugeruj zagnieżdżone `packages/<name>/AGENTS.md` dla każdego pakietu, którego zasady istotnie się różnią.
- **Istniejący bogaty `CLAUDE.md` w repozytorium.** Traktuj go jako autorytatywny materiał źródłowy. Nowy `AGENTS.md` powinien być bardziej zwięzłym, niezależnym od narzędzi agenta destylatem, który wskazuje na `@CLAUDE.md` w celu uzyskania szczegółów, a nie dosłowną kopią.
- **Istniejący `AGENTS.md` został edytowany ręcznie po ostatnim commicie.** `git diff HEAD -- <path>` pokaże niezacommitowane zmiany. Najpierw przeczytaj te zmiany i traktuj je jako ZACHOWAJ, chyba że bezpośrednio sprzeciwiają się zasadzie wymuszonej przez CI — użytkownik jest w trakcie edycji i nie wolno nadpisywać trwającej pracy.
- **`LAST_TOUCH` to początkowy commit repozytorium.** Zakres różnic staje się `LAST_TOUCH..HEAD` bez użytecznego sygnału. Wróć do sprawdzania bieżącego stanu repozytorium w stosunku do twierdzeń pliku, linia po linii, bez skrótu git-diff.
- **Plik istnieje, ale jest pusty lub jest stubem.** Pomiń ścieżkę aktualizacji — uruchom ścieżkę tworzenia i nadpisz, ponieważ nie ma treści autorskiej do zachowania.
- **Repozytorium bez historii commitów (`git log` puste).** Pomiń sekcję konwencji commitów, zamiast zgadywać; w sekcji PR zaznacz, że konwencja ma zostać zdefiniowana.
- **Repozytorium poliglota (brak pojedynczego manifestu).** Wybierz dominujący stos według liczby plików dla sekcji „Build/Test/Dev”; wspomnij o stosach drugorzędnych tylko wtedy, gdy mają własne polecenia, których agent będzie potrzebował.