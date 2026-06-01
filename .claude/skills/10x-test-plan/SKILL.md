---
name: 10x-test-plan
description: >
  Stateful, phased test-rollout orchestrator for existing products. Writes a
  durable phased rollout document at `context/foundation/test-plan.md`
  BEFORE handing off, then drives each rollout phase into
  /10x-new → /10x-research → /10x-plan → /10x-implement. Re-running the
  skill re-derives state from which artifacts exist and resumes from the
  next pending rollout phase. Once a rollout change is opened, follow the
  established research → plan → implement process: after each major phase,
  suggest the next natural command unless there is a clear blocker.
  Use when the user says "create test plan", "plan tests", "test
  strategy", "phased test rollout", "continue test rollout", "risk map
  for testing", "QA spec", "AI-native testing strategy", "stwórz plan
  testów", "strategia jakości". Use AFTER /10x-prd and /10x-roadmap.
  Brownfield only; greenfield needs a PRD first.
argument-hint: "[path ...] | --status | --refresh"
---

# 10x Test Plan — Stateful Phased Rollout Orchestrator

Ta umiejętność tworzy i zarządza plikiem `context/foundation/test-plan.md` jako **strategią stopniowego wdrażania testów**, a następnie uruchamia jedną fazę wdrażania na raz w łańcuchu zmian/badań/planowania/implementacji 10x. Przewodnik zaczyna się jako *plan* faz — każda faza ostatecznie otwiera swój własny folder `context/changes/<change-id>/` i wypełnia sekcje podręcznika (§6) w miarę realizacji. Umiejętność jest **stanowa**: każde wywołanie ponownie określa bieżący stan, sprawdzając, które artefakty istnieją, i wznawia pracę od następnej oczekującej fazy wdrażania. **Nie** wymusza powrotu do `/10x-test-plan` po każdym kolejnym etapie. Po otwarciu zmiany wdrożeniowej, ustalony proces to badanie → planowanie → implementacja: po każdej głównej fazie sugeruj następne naturalne polecenie, chyba że istnieje wyraźna blokada, korekta lub decyzja, która należy do `/10x-test-plan`.

`$ARGUMENTS`:

- **pusty** → określ stan i wykonaj następny oczekujący krok.
- **jedna lub więcej ścieżek** → źródła kontekstu dla Fazy 1 (PRD, notatki dotyczące zakresu, briefy). Usuń początkowe `@`, jeśli występuje.
- **`--status`** → wydrukuj status wdrożenia (gdzie jesteśmy, co dalej) bez wykonywania żadnej pracy.
- **`--refresh`** → otwórz nową zmianę `test-plan-refresh-<RRRR-MM-DD>`, aby zaktualizować istniejący przewodnik; nie edytuje przewodnika na miejscu.

## Maszyna stanów

Każde wywołanie uruchamia to drzewo decyzyjne. Każdy stan odpowiada na pytanie "który plik brakuje w tej chwili":

1. **Faza 0 — Warunki wstępne + wykrywanie stanu (zawsze działa).** Sprawdź znacznik projektu, rozgałęź na flagach `--status`/`--refresh`, a następnie sprawdź, czy istnieje `context/foundation/test-plan.md`.
2. **Jeśli przewodnik BRAKUJE**, uruchom ścieżkę zapisu od początku do końca:
   - Faza 1: Odkrycie (czytanie źródeł, skanowanie gorących punktów, profil bazy testowej).
   - Faza 2: Wywiad z użytkownikiem.
   - Faza 3: Synteza wstępnego briefu.
   - Faza 4: Napisz fazowy `test-plan.md`.
   - Następnie przejdź do Fazy 5.
3. **Jeśli przewodnik ISTNIEJE** (lub został właśnie napisany), przejdź do Fazy 5: przeczytaj przewodnik i znajdź pierwszą fazę wdrażania, której status nie jest `complete` — to jest bieżąca faza wdrażania.
4. **Faza 6 — Określ podstan dla bieżącej fazy wdrażania i przedstaw następne przekazanie**, na podstawie tego, które artefakty istnieją na dysku:
   - brak folderu zmiany → `/10x-new`
   - tylko `change.md` → `/10x-research`
   - `+ research.md` → `/10x-plan`
   - `+ plan.md` z oczekującymi elementami postępu → `/10x-implement`
   - `+ plan.md` w pełni ukończony → oznacz fazę wdrażania jako ukończoną w §3 i przejdź dalej (wróć do Fazy 5).
5. **Przekazanie** — skopiuj następne wywołanie do schowka, powiedz użytkownikowi, aby `/clear` i uruchomił je, a następnie ZATRZYMAJ.

Każde przekazanie jest **punktem ZATRZYMANIA** dla tej umiejętności. Użytkownik `/clear` i uruchamia zakolejkowane wywołanie. Po każdej głównej fazie niższego poziomu, ukończona faza powinna sugerować następne naturalne polecenie w procesie badanie → planowanie → implementacja, chyba że istnieje wyraźna blokada, korekta lub decyzja, która należy do `/10x-test-plan`.

## Zasady nośne

Trzy zasady, których przestrzega każde wywołanie; wszystkie trzy lądują w §1 artefaktu.

1. **Koszt × sygnał.** Każdy test, który dodaje wdrożenie — klasyczny lub AI-natywny — musi odpowiedzieć na jedno pytanie: *jaki jest najtańszy test, który daje prawdziwy sygnał dla tego ryzyka?* Nie promuj do e2e, ponieważ "czuje się bezpieczniej"; nie nakładaj modelu wizyjnego na deterministyczną różnicę, która już wykrywa regresję. Przekaż to do `/10x-plan` dla każdej fazy wdrażania.

2. **Obawy użytkowników są dowodem.** Ryzyka, przez które zespół przeszedł, mają taką samą wagę jak linie PRD lub dane z gorących punktów.

3. **Sygnał, nie wiedza.** Ta umiejętność odczytuje bazę kodu w poszukiwaniu *sygnału* — zmian w gorących punktach, profilu bazy testowej, znacznika projektu, języka/frameworka. **Nie** odczytuje w poszukiwaniu *wiedzy* — grafu wywołań, schematów, tłumaczenia błędów, która linia jest odpowiedzialna za awarię. Mapa ryzyka w §2 cytuje dowody (linie PRD, odpowiedzi z wywiadów, katalogi gorących punktów); nigdy nie twierdzi, że plik jest "miejscem, gdzie występuje awaria". Ten punkt zakotwiczenia jest wynikiem `/10x-research`, produkowanym podczas każdej fazy wdrażania. Umiejętność jest **autorem i weryfikatorem specyfikacji QA**, a nie audytorem kodu.

   Konsekwencja operacyjna: gdy skan gorących punktów wskazuje `src/lib/foo/` jako główny katalog, §2 może cytować "katalog gorących punktów `src/lib/foo/` — 12 commitów/30 dni" jako *dowód prawdopodobieństwa*. NIE MOŻE cytować "punkt zakotwiczenia: `src/lib/foo/bar.ts`" — graf wywołań w tym katalogu jest niezweryfikowany, dopóki nie zostanie uruchomione badanie.

## Kiedy używać, kiedy pominąć

**Użyj, gdy** projekt ma co najmniej PRD lub kilka zarchiwizowanych fragmentów, a użytkownik zamierza zainwestować w testy.

**Pomiń, gdy**:

- nie ma PRD, mapy drogowej ani zaimplementowanego kodu (najpierw uruchom `/10x-shape` → `/10x-prd`);
- użytkownik chce dodać **jeden** test do pojedynczego pliku — to jest obszar `/10x-tdd`, a nie wdrożenie;
- użytkownik chce skonfigurować hooki, MCP lub CI YAML w izolacji — mogą one stać się fazami wdrażania, ale samodzielne zadanie konfiguracyjne to inna umiejętność.

## Związek z innymi umiejętnościami

| Umiejętność              | Rola                                                                                   |
|--------------------|----------------------------------------------------------------------------------------|
| `/10x-shape`, `/10x-prd`, `/10x-roadmap` | W górę strumienia. Tworzy PRD/mapę drogową, którą konsumuje odkrycie.      |
| `/10x-stack-assess` | W górę strumienia (brownfield). Identyfikuje istniejącą bazę testową.                             |
| `/10x-new` → `/10x-research` → `/10x-plan` → `/10x-implement` | Łańcuch w dół strumienia, wywoływany raz na fazę wdrażania. `/10x-test-plan` uruchamia łańcuch; po każdej głównej fazie, aktywna umiejętność niższego poziomu sugeruje następne naturalne polecenie w ustalonym procesie badanie → planowanie → implementacja, chyba że jest zablokowana. `/10x-research` jest **powierzchnią ekstrakcji wiedzy** — odczytuje kod, śledzi grafy wywołań i tworzy punkty zakotwiczenia plik:linia, które ten plan celowo pomija. |
| `/10x-tdd`         | Siostrzana. Odczytuje podręcznik (§6) podczas dodawania pojedynczego testu.                            |

---

## Faza 0 — Warunki wstępne + wykrywanie stanu (zawsze działa)

Ta faza uruchamia się przy każdym wywołaniu.

### Krok 0.1 — Wykryj znacznik projektu

Potwierdź, że jest to prawdziwy katalog główny projektu, znajdując jego manifest ekosystemu w dowolny sposób pasujący do repozytorium — nie ma ustalonego polecenia. Poszukaj w pobliżu katalogu głównego konwencjonalnych znaczników dla danego stosu (np. `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Gemfile`, `composer.json`, `*.csproj`, `pubspec.yaml` lub odpowiedników frameworków). PRD w `context/foundation/` również liczy się jako prawidłowy punkt początkowy.

Jeśli nie znaleziono znacznika projektu, wydrukuj:

```
No project markers found in the current directory. /10x-test-plan needs an
existing project (or at least a PRD). If you're at the idea stage, run
/10x-shape and /10x-prd first.
```

…i ZATRZYMAJ.

### Krok 0.2 — Rozgałęź na `--status` / `--refresh`

- **`--status`**: przeczytaj przewodnik, jeśli istnieje, wydrukuj tabelę statusu wdrożenia (nazwa fazy → status → folder zmiany, jeśli istnieje) i ZATRZYMAJ bez wykonywania pracy. Przydatne, gdy użytkownik nie jest pewien, gdzie skończył.
- **`--refresh`**: przejdź do ścieżki odświeżania (koniec tej umiejętności). Nie modyfikuje istniejącego przewodnika na miejscu.

### Krok 0.3 — Sprawdź, czy przewodnik istnieje

```bash
test -f context/foundation/test-plan.md && echo "EXISTS" || echo "MISSING"
```

- **BRAKUJE** → przejdź do Fazy 1 (pełne odkrycie → napisz przewodnik).
- **ISTNIEJE** → przejdź do Fazy 5 (przeczytaj przewodnik, określ bieżącą fazę wdrażania, przekaż).

To jest nośna gałąź. Wszystko w dół strumienia zależy od jej poprawności, więc zawsze jawnie sprawdzaj istnienie pliku; nigdy nie wnioskuj z wcześniejszej historii rozmów.

---

## Faza 1 — Odkrycie (tylko gdy przewodnik brakuje)

Przeczytaj, co istnieje; nie wymyślaj. Dla każdego wejścia, zapisz ścieżkę pliku, który faktycznie przeczytałeś; jeśli fakt pojawia się w briefie początkowym lub przewodniku, musi on pochodzić z jednego z tych źródeł.

### Źródła do odkrycia (pomiń to, czego brakuje)

Jawne ścieżki z `$ARGUMENTS` są **zawsze odczytywane**, niezależnie od tego, gdzie się znajdują. Poniższe wartości domyślne są przeszukiwane tylko wtedy, gdy nie zostały już dostarczone za pomocą argumentów.

| Źródło | Domyślna ścieżka | Co wyodrębnić |
|---|---|---|
| Dokumenty typu PRD | `context/foundation/prd.md` + ścieżki dostarczone w argumentach | Użytkownicy, główne przepływy, cele poboczne, zasady biznesowe, zależności, metryka sukcesu |
| Mapa drogowa | `context/foundation/roadmap.md` + mapa drogowa dostarczona w argumentach | Nadchodzące fragmenty, co jest "następne" (zwiększa prawdopodobieństwo) |
| Zarchiwizowane fragmenty | `context/archive/*/plan.md` + plany fragmentów dostarczone w argumentach | Co jest już zaimplementowane (bieżąca powierzchnia ryzyka) |
| Stos technologiczny | `context/foundation/tech-stack.md` + notatka o stosie dostarczona w argumentach, LUB wykryj za pomocą manifestu | Język, framework, środowisko uruchomieniowe, używany już runner testów |
| Briefy / notatki dotyczące zakresu | tylko dostarczone w argumentach — brak ustalonej wartości domyślnej | Ograniczenia, cele poboczne, wskazówki dotyczące ryzyka, które nigdy nie trafiły do PRD |
| Istniejące AGENTS.md / CLAUDE.md | katalog główny repozytorium | Twarde zasady i konwencje, które ograniczają wybory testowe |
| Istniejąca konfiguracja testowania | `vitest.config.*`, `jest.config.*`, `playwright.config.*`, `pytest.ini`, itd. | Jaka infrastruktura testowa już istnieje |
| Narzędzia MCP sesji | bieżąca lista narzędzi hosta/sesji | Dokumenty/wyszukiwanie MCP, które mogą ugruntować rekomendacje wrażliwe na stos |

### Czytaj źródła

Najpierw przeczytaj jawne `$ARGUMENTS`, a następnie odpowiednie wartości domyślne, które nie zostały jeszcze objęte argumentem. Użyj równoległych odczytów lub subagentów, gdy host sprawia, że jest to tanie, ale zachowaj tę samą umowę wyjściową dla każdego źródła:

1. **Typ źródła** — PRD-podobne, mapa drogowa, stos technologiczny, zarchiwizowany fragment, brief, zasady AGENTS, konfiguracja testów lub inne.
2. **2–4 fakty istotne dla ryzyka** — scenariusze awarii, które źródło implikuje.
3. **Twarde ograniczenia** — zasady "nie wolno", blokady frameworków, linie zgodności.
4. **Uczciwe luki** — jeśli źródło jest puste/nie na temat/skąpe, powiedz to jawnie.

Zwróć zwięzłe notatki z cytatami `path:line`. **Nie** deleguj Fazy 3 (synteza briefu).

### Profil bazy testowej (zawsze działa)

Przed otwarciem wywiadu, zbuduj jednowierszową intuicję istniejącej bazy testowej, aby Faza 2 nie zadawała pustych pytań ("co wydaje się niedostatecznie przetestowane?" to nonsens, gdy nic nie jest testowane). Sklasyfikuj projekt do jednego z trzech kubełków.

Wykryj bazę testową w dowolny sposób pasujący do stosu, który faktycznie znaleziono w Fazie 1 — nie ma ustalonego polecenia. Użyj rzeczywistej konfiguracji runnera testów projektu i konwencji plików testowych (np. konfiguracje `vitest`/`jest`/`playwright` i `*.test.*`/`__tests__/` dla JS-TS; `pytest`/`pyproject.toml` i `test_*.py` dla Pythona; `*_test.go` dla Go; odpowiedniki frameworków w przeciwnym razie) i wyklucz katalogi dostawców/kompilacji. Cel to dwa fakty: czy istnieje konfiguracja runnera testów i z grubsza ile rzeczywistych plików testowych istnieje i gdzie się grupują.

Sklasyfikuj:

- **`none`** — nie znaleziono konfiguracji testów ORAZ mniej niż 3 pliki testowe. Projekt faktycznie nie ma zestawu testów.
- **`sparse`** — konfiguracja istnieje, ale mniej niż ~15 plików testowych, lub pliki testowe grupują się tylko w jednym obszarze, podczas gdy reszta bazy kodu jest pusta.
- **`meaningful`** — konfiguracja + rzeczywisty zestaw testów (~15+ plików testowych rozłożonych po całej bazie kodu). Projekt ma kulturę testowania; nadal może mieć luki.

Zachowaj werdykt (jeden wiersz: kubełek + krótkie uzasadnienie, takie jak "vitest skonfigurowany, 4 pliki testowe wszystkie w `packages/api/`") dla §4 (Stos) przewodnika i dla wywiadu w Fazie 2, aby na nim rozgałęzić.

### Ugruntowanie stosu wspomagane przez MCP (zawsze działa)

Przed rekomendowaniem narzędzi testowych, narzędzi AI-natywnych, hooków, automatyzacji przeglądarki, bram CI lub warstw testowych specyficznych dla frameworka, sprawdź narzędzia MCP/narzędzia dostępne w **bieżącej sesji**. Jest to krok ugruntowujący, a nie wymóg użycia każdego narzędzia.

Szukaj konkretnie narzędzi, które mogą zmniejszyć liczbę przestarzałych lub ogólnych porad dotyczących stosu:

- **MCP z dokumentacją techniczną**, takie jak Context7, dokumentacja frameworków/bibliotek, dokumentacja dostawców lub dokumentacja pakietów. Użyj ich najpierw do dokładnych API, aktualnych wskazówek dotyczących frameworków, konfiguracji testów specyficznych dla wersji oraz przestarzałych/zmienionych poleceń.
- **MCP do wyszukiwania/odkrywania**, takie jak Exa.ai. Użyj ich, gdy nie jest znana właściwa oficjalna strona, podczas porównywania bieżącego wsparcia narzędzi lub podczas sprawdzania, czy funkcja testowania/MCP jest aktualna, w wersji zapoznawczej, przestarzała lub ograniczona regionalnie/przez dostawcę.
- **MCP przeglądarki/środowiska uruchomieniowego**, takie jak Playwright/automatyzacja przeglądarki. Zauważ, czy są dostępne jako możliwa warstwa testowa lub weryfikacyjna, ale rekomenduj je tylko wtedy, gdy dodają sygnał poza tańsze testy deterministyczne.
- **MCP dostawcy/platformy**, takie jak GitHub, Linear, Cloudflare, Supabase, Vercel lub narzędzia baz danych. Zauważ możliwości tylko do odczytu, które mogłyby wspierać przyszłe bramy jakości, inspekcję logów, tworzenie problemów lub weryfikację środowiska.

Zasada wykrywania niezależna od hosta:

1. Sprawdź dostępne nazwy/opisy narzędzi udostępnione agentowi w tej sesji. Jeśli host ma powierzchnię do odkrywania narzędzi, zapytaj ją o terminy takie jak `docs`, `Context7`, `Exa`, `search`, `browser`, `Playwright`, `github`, `cloudflare`, `database` oraz wykryte nazwy frameworków/środowisk uruchomieniowych.
2. Nie wymyślaj MCP z przykładów. Jeśli Context7 lub Exa.ai nie są dostępne w tej sesji, napisz "not available in current session" zamiast zakładać dostęp.
3. Użyj oficjalnej dokumentacji za pośrednictwem MCP dokumentacji, jeśli jest dostępna. Użyj MCP wyszukiwania, aby znaleźć aktualną oficjalną dokumentację lub najnowsze strony statusu, a następnie preferuj źródło pierwotne nad blogami.
4. Zastosuj tę samą granicę **sygnał, nie wiedza**, co w pozostałej części Fazy 1: dokumentacja/wyszukiwanie MCP może potwierdzić, że narzędzie jest obsługiwane, aktualne lub odpowiednie dla wykrytego stosu. Nie lokalizują one punktów zakotwiczenia kodu dla konkretnych awarii; to pozostaje zadaniem `/10x-research`.

Zachowaj krótką notatkę `Stack grounding tools` dla §4 i briefu początkowego:

```markdown
**Stack grounding tools (current session):**
- Docs: <Context7 / framework docs MCP / none> — <what was checked or why skipped>; checked: <YYYY-MM-DD>
- Search: <Exa.ai / web search MCP / none> — <what was checked or why skipped>; checked: <YYYY-MM-DD>
- Runtime/browser: <Playwright MCP / browser tool / none> — <possible use, or "not used">; checked: <YYYY-MM-DD>
- Provider/platform: <GitHub/Cloudflare/Supabase/etc. / none> — <quality-gate relevance, or "not used">; checked: <YYYY-MM-DD>
```

Jeśli żadne użyteczne MCP nie są dostępne, kontynuuj z lokalnymi dowodami manifestu/konfiguracji i wyraźnie to zaznacz w §4. Brak dostępu do MCP nie może blokować wdrożenia.

### Skan gorących punktów (historia git)

Uruchom skan gorących punktów historii git z ostatnich 30 dni, **ograniczony tylko do głównych katalogów bazy kodu projektu**. **Częstotliwość zmian jest jednym z najsilniejszych sygnałów prawdopodobieństwa**. Skanowanie całego repozytorium zagłusza sygnał w szumie, którego nikt nie pisze ręcznie.

#### Krok 1 — Zidentyfikuj katalog(i) główny(e) głównej bazy kodu

Zlokalizuj katalogi, które zawierają ręcznie napisany kod aplikacji, w dowolny sposób pasujący do stosu znalezionego w Fazie 0 — nie ma ustalonego polecenia. Poszukaj konwencjonalnych katalogów głównych źródeł dla tego ekosystemu (np. `src`/`app`/`lib` dla JS-TS, katalog pakietu dla Pythona, `cmd`/`internal`/`pkg` dla Go, członkowie obszaru roboczego dla Rust, `src`/`app` dla PHP) i przestrzegaj układów obszarów roboczych monorepo. Wyklucz katalogi dostawców, generowane i wyjściowe kompilacji (`node_modules`, `dist`, `build`, `.next`, `target`, `coverage`, `vendor` i tym podobne). Celem jest zestaw ścieżek, gdzie zmiany odzwierciedlają rzeczywiste autorstwo, a nie szum narzędzi.

#### Krok 2 — Potwierdź zakres z użytkownikiem

> Detected main-codebase scopes for the hot-spot scan: `<scope 1>`, `<scope 2>`, `<scope 3>`. Excluding docs, fixtures, archive, build output. **Accept**, or paste an **override** list.

Jeśli wykrycie nic nie zwróci, wróć do katalogu głównego repozytorium z domyślną listą wykluczeń i wyraźnie poinformuj użytkownika. Nigdy nie skanuj wszystkiego po cichu.

#### Krok 3 — Uruchom skanowanie

Użyj potwierdzonych zakresów, aby zebrać najczęściej zmieniane ręcznie pisane pliki i katalogi z ostatnich 30 dni. Wyklucz pliki blokad, migawki, kod dostawców, kod generowany i dane wyjściowe kompilacji. Dokładne polecenie zależy od hosta i stosu; dane wyjściowe muszą zawierać:

- użyta lista zakresów;
- najczęściej zmieniane pliki, jeśli to przydatne;
- najczęściej zmieniane katalogi, najlepiej pogrupowane wokół głębokości 2–3;
- czy historia w zakresie ma wystarczający sygnał.

**Zabezpieczenie przed niewystarczającą historią.** Jeśli log git w zakresie zwraca mniej niż 5 commitów w ciągu ostatnich 30 dni, pomiń skanowanie i zanotuj w punkcie kontrolnym Fazy 1: "Skan gorących punktów: niewystarczająca historia git — oceny prawdopodobieństwa w przewodniku będą opierać się wyłącznie na mapie drogowej i wywiadzie z użytkownikiem."

Zachowaj wynik jako krótką notatkę, którą Fazy 2, 3 i 4 konsumują.

### Punkt kontrolny

Podsumuj dane wejściowe dla użytkownika w ≤12 liniach: `ścieżka → sklasyfikowany-typ → 1-liniowy zarys → [argument | domyślny]`, plus 3-liniowe podsumowanie gorących punktów. Potwierdź przed przejściem do Fazy 2.

## Faza 2 — Wywiad z użytkownikiem (tylko gdy przewodnik brakuje)

Faza 1 ujawnia, co mówią dokumenty. Faza 2 ujawnia, co użytkownik wie, czego dokumenty nigdy nie uchwycą: przeszłe incydenty, obawy, obszary, które zmienia bez pewności, oraz wyraźne instrukcje dotyczące tego, czego *nie* testować. Traktuj jego odpowiedzi z taką samą wagą jak linie PRD lub dane z gorących punktów — ryzyko zakotwiczone w "użytkownik obawia się Y, awaria pojawiłaby się w `<pliku>`" jest ugruntowane, o ile plik wytrzymuje badanie.

Pomiń wywiad tylko wtedy, gdy użytkownik wyraźnie o to poprosi. Ostrzeż raz, że wdrożenia oparte wyłącznie na dokumentach odzwierciedlają to, co podkreśla PRD, co rzadko jest tym, czego zespół faktycznie obawia się zepsuć.

### Przeprowadź

Zadawaj **jedno pytanie na raz**, warunkowane poprzednią odpowiedzią — nie jako formularz. Zawsze łącz pytanie z **2–3 krótkimi, konkretnymi przykładami**, aby użytkownik mógł poczuć kształt odpowiedzi, której oczekujesz (i rozpoznać, kiedy jego sytuacja się różni). Przykłady to rusztowanie, a nie opcje — jasno określ, że użytkownik powinien odpowiedzieć własnymi słowami. Po każdej odpowiedzi, powtórz ją w jednej linii, aby użytkownik mógł tanio poprawić błędne odczyty. Następnie zadaj następne.

Użytkownik może odpowiedzieć "pomiń" na każde pytanie. Jeśli trzy lub więcej zostanie pominiętych, przerwij wywiad, zanotuj, że wdrożenie będzie opierać się wyłącznie na dokumentach, i przejdź do Fazy 3 z jednowierszowym ostrzeżeniem.

### Pięć pytań

Każde pytanie poniżej zawiera przykładowe odpowiedzi. Przeczytaj je użytkownikowi jako część monitu; dostosuj przykłady do domeny projektu, gdy istnieje oczywiste dostosowanie (np. dla produktu rozliczeniowego, użyj przykładów związanych z rozliczeniami).

1. **"Co najbardziej martwi Cię w przypadku awarii tego produktu — niezależnie od tego, co mówią dokumenty?"**
   - np. "Płacący użytkownik otrzymuje 403 i nie może uzyskać dostępu do treści, za które zapłacił."
   - np. "Webhook ze Stripe przychodzi dwukrotnie i podwójnie obciążamy."
   - np. "Cichy błąd utraty danych w potoku importu, którego nikt nie zauważa przez tydzień."

2. **"Gdzie już wcześniej sparzyłeś się w tej bazie kodu, lub podobnej?"**
   - np. "W zeszłym kwartale migracja przebiegła pomyślnie w środowisku testowym i uszkodziła wiersze produkcyjne."
   - np. "Refaktoryzacja oprogramowania pośredniczącego uwierzytelniania wylogowała użytkowników na 30 minut."
   - np. "Wysłaliśmy kompilację, w której w katalogu brakowało połowy lekcji i nikt nie zauważył tego przez dzień."

3. **"Który obszar zmieniasz najczęściej bez poczucia pewności?"**
   - np. "Logika blokowania lekcji — każda poprawka to jak ruletka."
   - np. "Routing Cloudflare Worker — działa lokalnie, psuje się na produkcji."
   - np. "Skrypt przesyłania R2 — uruchamiam go i modlę się."

4. **"Co dziś wydaje się niedostatecznie przetestowane, a o co cicho się martwiłeś?"** *(zobacz warunkowe przepisanie poniżej, jeśli profil bazy testowej to `none`)*
   - np. "Ścieżka ponawiania webhooka — mamy jeden test szczęśliwej ścieżki i to wszystko."
   - np. "Granice błędów — istnieją, ale nigdy nie widziałem, żeby zadziałały w teście."
   - np. "Wszystko, co dotyczy pieniędzy — pokrycie jest słabe, a wpływ jest poważny."

5. **"Na co NIE chciałbyś wydawać budżetu na testy, nawet jeśli podręcznik mówi, żeby to testować?"**
   - np. "Wewnętrzne narzędzia administracyjne — pięciu zaufanych użytkowników, mały promień rażenia."
   - np. "Generowane klienty TypeScript — generator jest testem."
   - np. "Testy migawkowe interfejsu użytkownika dla stron marketingowych — ciągle się psują i nic nie wykrywają."

Jeśli odpowiedź użytkownika na jedno pytanie w pełni pokrywa następne, potwierdź nakładanie się i przejdź dalej. Pięć tur to limit, a nie kwota.

### Warunkowe przepisanie dla Q4 na podstawie profilu bazy testowej

Profil bazy testowej z Fazy 1 decyduje, jak (lub czy) zadać Q4:

- **`meaningful`** — zadaj Q4 tak, jak jest napisane. Użytkownik ma testy; "niedostatecznie przetestowane" to spójne pojęcie.
- **`sparse`** — przeformułuj: *"Masz kilka testów w `<obszarze>`, ale większość bazy kodu jest pusta. Gdzie jest luka, która najbardziej Cię przeraża?"* i zaoferuj te same przykłady.
- **`none`** — **pomiń Q4**. Nie ma nic do niedostatecznego przetestowania *względnie*. Powiedz użytkownikowi wyraźnie: *"Pomiń pytanie o 'niedostatecznie przetestowane' — nie ma jeszcze znaczącego zestawu testów, więc odpowiedź brzmiałaby 'wszystko'. Faza 1 wdrożenia uruchomi runner testów."* Nie licz tego jako pominięcia zainicjowanego przez użytkownika w kierunku progu przerwania.

**Opcjonalne przygotowanie do Q3.** Jeśli skan gorących punktów wygenerował użyteczną listę, a odpowiedź użytkownika na Q3 jest niejasna, pokaż 3 najczęściej występujące katalogi gorących punktów i zapytaj, czy któryś z nich pasuje. Nigdy nie zaczynaj od listy; nigdy nie pozwól, aby nadpisała jasną odpowiedź ustną.

### Zapisz

Zachowaj odpowiedzi jako ustrukturyzowaną notatkę (w pamięci; przekazaną do briefu i przewodnika):

```markdown
**User-stated concerns (Phase 2 interview):**

| # | Question | User answer (paraphrase OK) | Implied risk(s)                            |
|---|----------|------------------------------|---------------------------------------------|
| 1 | Worries most         | "Paid user gets a 403 instead of their content." | API gating regression on lesson endpoint |
| 2 | Burned before        | "Catalog build silently dropped lessons last month." | Strict ref resolution at build time |
| 3 | Change without confidence | (skipped) | — |
| 4 | Under-tested today   | "The webhook retry path." | Billing webhook idempotency |
| 5 | Do NOT spend on      | "Internal admin tools — we trust the small set of users." | Negative space note |
```

## Faza 3 — Synteza wstępnego briefu (tylko gdy przewodnik brakuje)

Tylko w pamięci. Brief napędza Fazę 4 i jest źródłem prawdy dla struktury wdrożenia.

```markdown
# Seed Brief (in-memory)

## 1. Top risks (5–7): | # | Risk (failure scenario) | Impact | Likelihood | Source(s) — evidence, not anchors |
## 2. Hot-spots (top 5 files + top 5 directories, scope list) — used as likelihood evidence, not as failure-location anchors
## 3. User-stated concerns (verbatim from Phase 2)
## 4. Stack notes (detected test infra, or "none yet"; include Stack grounding tools checked in current session)
## 5. Risk response guidance: | Risk # | What would prove protection | Must challenge | Context needed | Likely cheapest layer | Anti-pattern to avoid |
## 6. Proposed rollout phases (3–5): | # | Phase name | Goal | Risks covered | Test types | Order rationale |
```

Ilustracyjne wiersze faz: "Pokrycie ścieżki krytycznej" (najtańsza warstwa dla największych ryzyk), "Integracja wokół gorących punktów" (moduły o dużej zmienności), "Warstwa AI-natywna" (tylko jeśli dodaje sygnał, którego klasyczne testy tanio nie wykrywają), "Okablowanie bram jakości" (zablokuj dno).

### Wskazówki dotyczące reagowania na ryzyko (obowiązkowe)

Dla każdego z głównych ryzyk dodaj wiersz odpowiedzi przed zaproponowaniem faz wdrażania. Jest to pomost między "zidentyfikowaliśmy ryzyko" a "umiejętność niższego poziomu wie, jak je zaatakować". Zachowaj oparcie na dowodach: użyj sygnału PRD/wywiadu/archiwum/gorących punktów i ograniczeń stosu, ale nie wymyślaj punktów zakotwiczenia plików.

Każdy wiersz odpowiada na:

- **Co udowodniłoby ochronę** — obserwowalne zachowanie lub tryb awarii, który użyteczny test musi wykryć. Sformułuj to jako zachowanie użytkownika/biznesu, a nie "pokryj funkcję X".
- **Musi zakwestionować** — oczywiste, ale niebezpieczne założenie, którego agent nie powinien akceptować po cichu. Przykłady: "logowanie szczęśliwej ścieżki oznacza, że dostęp do płatnych treści działa", "pusta odpowiedź oznacza brak treści", "ponowienie zakończyło się sukcesem, ponieważ końcowy status to 200", "wygenerowany schemat równa się kontraktowi produktu".
- **Wymagany kontekst** — co `/10x-research` musi ugruntować przed planowaniem: punkt wejścia, stan trwały, granica zewnętrzna, tłumaczenie błędów, kształt uwierzytelniania/sesji, gwarancja kolejności, zasada idempotencji, dane fixture/źródła prawdy itp.
- **Prawdopodobnie najtańsza warstwa** — jednostkowa, integracyjna, kontraktowa, e2e, deterministyczna różnica wizualna, przegląd AI-natywny, hook lub ręczny dymkowy. Jest to hipoteza do zweryfikowania przez `/10x-research`, a nie polecenie.
- **Anty-wzorzec do uniknięcia** — jeden konkretny tryb awarii w przyszłym teście: lustro implementacji, tylko szczęśliwa ścieżka, asercja skopiowana z logiki produkcyjnej, nadmierne mockowanie wewnętrznych elementów, kruche założenie kolejności, migawka bez znaczenia, e2e, gdzie integracja by to wykryła, lub warstwa AI-natywna nad deterministycznym sygnałem.

Jeśli ryzyko nie może wygenerować tego wiersza, nie jest ono wystarczająco wykonalne dla wdrożenia. Przeformułuj je lub usuń przed Fazą 4.

### Soczewka nadużyć / bezpieczeństwa (obowiązkowa, gdy ma zastosowanie)

Jeśli produkt posiada uwierzytelnianie, płatności lub akceptuje jakiekolwiek dane wejściowe od użytkownika, lista N największych ryzyk musi zawierać co najmniej jeden **scenariusz nadużycia** — szczęśliwa ścieżka wyklucza atakującego, więc te scenariusze prawie nigdy nie pojawiają się samodzielnie w wywiadzie z Fazy 2. Przed sfinalizowaniem briefu, sprawdź zestaw ryzyk pod kątem tych klas i dodaj wiersz, jeśli produkt faktycznie ujawnia powierzchnię:

- **Autoryzacja/dostęp** — IDOR i kontrole własności: czy punkt końcowy weryfikuje, czy *ten zasób należy do Ciebie*, a nie tylko *jesteś zalogowany*?
- **Niezaufane dane wejściowe** — wstrzykiwanie i zgodność walidacji po stronie serwera (serwer nie może ufać klientowi).
- **Wyciek tajemnic/PII** — klucze, tokeny lub dane osobowe wyciekające do logów, treści błędów lub pakietu front-endowego.
- **Nadużycie zasobów** — ominięcie limitu szybkości, kosztowne operacje w pętli, masowe wyzwalanie efektów ubocznych (np. zalewanie linkami magicznymi).

Są to zwykłe scenariusze awarii oceniane na tych samych osiach wpływu × prawdopodobieństwa, cytowane z tymi samymi zasadami dowodów — nie jest to oddzielny framework i nigdy nie jest to punkt zakotwiczenia pliku. Jeśli produkt ma te powierzchnie, a mapa nie zawiera żadnych wierszy nadużyć, jest to luka do zamknięcia, a nie znak, że produkt jest bezpieczny.

### Kalibracja wpływu × prawdopodobieństwa

Oceń obie osie w skali High / Medium / Low (patrz `references/test-plan-schema.md` §2 dla rubryki), aby kolejność była powtarzalna. Najpierw chroń High × High. Scenariusze o wysokim wpływie × niskim prawdopodobieństwie (np. awaria dostawcy chmury) zazwyczaj należą do obserwacji/alertów, a nie testów — zanotuj to zamiast wypełniać mapę. Nie wymyślaj drobniejszych gradacji; celem jest obronna kolejność, a nie fałszywa precyzja.

### Przejście weryfikacyjne (obowiązkowe)

Przed pokazaniem briefu użytkownikowi, przejdź przez każde z N największych ryzyk i zastosuj perspektywę konsultanta QA. Trzy sprawdzenia dla każdego ryzyka:

1. **"Czy to jest wada, czy opisuję implementację?"** Jeśli złamanie ryzyka wymagałoby najpierw *dodania* zabezpieczenia (np. "brak ścieżki awaryjnej", gdy taka ścieżka nie istnieje), ryzyko jest spekulatywne — usuń je lub przeformułuj, aby testować to, co *istnieje* (np. "ścieżka awarii zwraca czysty 5xx, nie udaje sukcesu, nie zapisuje do bazy danych"). Spekulatywne ryzyka, które przetrwają do §2, zmuszają `/10x-research` do wymyślenia kodu pod testem lub oznaczenia ryzyka do rewizji; oba marnują cykl.

2. **"Czy ten wiersz cytuje plik jako punkt zakotwiczenia?"** Usuń wszystko w kolumnie Source, co wygląda jak `src/foo/bar.ts:42` lub `<moduł>` (konkretny symbol). Zastąp to dowodem, który *podniósł* ryzyko — numerem pytania z wywiadu, linią PRD, **katalogiem** gorących punktów. Jeśli po usunięciu nie pozostały żadne dowody, ryzyko jest nieuzasadnione i musi zostać usunięte lub poparte prawdziwym cytatem z wywiadu/PRD.

3. **"Czy zalecana odpowiedź wykryłaby prawdziwą regresję, czy tylko zwiększyłaby pokrycie?"** Odrzuć wskazówki dotyczące odpowiedzi, które mówią tylko "dodaj testy jednostkowe", "pokryj moduł", "przetestuj szczęśliwą ścieżkę" lub "potwierdź bieżące dane wyjściowe". Prawidłowa odpowiedź nazywa zachowanie/tryb awarii, kontekst, który `/10x-research` musi zweryfikować, i co najmniej jeden anty-wzorzec do uniknięcia. Najbardziej niebezpiecznym anty-wzorcem dla testów pisanych przez AI jest **problem wyroczni**: asercja, której oczekiwana wartość została zaczerpnięta z implementacji pod testem, a nie z niezależnego źródła (wymagań, kontraktu, wywiadu). Taki test jest tautologiczny — zatwierdza bieżące zachowanie, w tym bieżące błędy, i nigdy nie może zawieść z właściwego powodu. Sformułuj komórkę "Co udowodniłoby ochronę" jako zachowanie użytkownika/biznesu właśnie po to, aby test niższego poziomu czerpał swoją wyrocznię z ryzyka, a nie z kodu, który czyta.

Oba sprawdzenia uruchamiają się po cichu — w ten sposób brief jest czyszczony, a nie jest to krok widoczny dla użytkownika. Jeśli ryzyko zostanie usunięte lub przeformułowane, zanotuj to w jednowierszowej podsekcji "Challenger findings" na końcu briefu, aby użytkownik mógł zobaczyć, co zostało usunięte i dlaczego.

Pokaż (wyczyszczony) brief; poproś o **Akceptuj** / **Edytuj** / **Anuluj**.

## Faza 4 — Napisz fazowy `test-plan.md` (tylko gdy przewodnik brakuje)

Napisz **jeden plik**: `context/foundation/test-plan.md`, zgodnie z `references/test-plan-schema.md`. Schemat jest stały; treść dostosowuje się do briefu.

Dwa punkty egzekwowania, które schemat jasno określa — nie rozluźniaj ich:

- **§1 Strategia musi zawierać zasadę #3** ("Ryzyka to scenariusze, a nie lokalizacje kodu"). Skopiuj z schematu; nie parafrazuj.
- **§2 Kolumna źródłowa to dowód, a nie punkty zakotwiczenia.** Dozwolone: linie PRD/mapy drogowej/archiwum, numer pytania z wywiadu, katalogi gorących punktów z liczbą zmian, ograniczenia stosu technologicznego. Zabronione: `plik:linia`, nazwy funkcji, nazwy schematów, nazwy modułów. Jeśli wiersz ryzyka w projekcie nie ma nic w kolumnie Source po usunięciu zabronionych punktów zakotwiczenia, wiersz jest nieuzasadniony — usuń go lub dołącz prawdziwy cytat z wywiadu/PRD przed zapisaniem.

Sekcja nośna to **§3 Stopniowe wdrażanie** — orkiestrator odczytuje tę tabelę statusu przy każdym kolejnym wywołaniu. Słownictwo statusu (literały parsera): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`. Orkiestrator nadpisuje komórki Status i Change-folder w miarę postępu wdrażania; reszta wiersza jest zamrożona do czasu `--refresh`.

Zachowaj wskazówki dotyczące reagowania na ryzyko z briefu w napisanym planie:

- Wiersze ryzyka w §2 pozostają zwięzłe i zawierają tylko dowody.
- §2 musi również zawierać tabelę `Risk Response Guidance` ze schematu dla każdego z głównych ryzyk. Zawiera ona intencję odpowiedzi, a nie punkty zakotwiczenia.
- Cele faz w §3 powinny mówić, jaką ochronę faza ma udowodnić, a nie tylko jaki typ testu doda.
- §4 Stack musi zawierać notatkę o ugruntowaniu MCP/docs/search z Fazy 1, w tym daty `checked:` i "not available in current session", gdzie to stosowne.
- Wypełniacze w §6 powinny nazywać przyszły wzorzec podręcznika według zachowania/trybu awarii, gdy to możliwe, np. "TBD — patrz §3 Faza 1 dla wzorca odmowy dostępu do płatnych treści/regresji", a nie tylko "testy jednostkowe TBD".

Nie dodawaj punktów zakotwiczenia plików ani kodu testowego, aby zachować te wskazówki. Plan powinien zawierać intencję odpowiedzi; `/10x-research` dostarcza punkty zakotwiczenia, a `/10x-plan` przekształca odpowiedź w podfazy.

Po napisaniu, przejdź bezpośrednio do Fazy 5 (użytkownik już zatwierdził brief).

---

## Faza 5 — Przeczytaj przewodnik, zlokalizuj bieżącą fazę wdrażania

Przeczytaj §3 i znajdź pierwszy wiersz, którego Status nie jest `complete` — to jest **bieżąca faza wdrażania**. Jeśli każdy wiersz jest `complete`, przejdź do "Wszystkie fazy ukończone". Wyodrębnij: numer fazy (N), nazwę fazy, objęte ryzyka, typy testów i folder zmiany (jeśli istnieje) — te dane zasilają poniższe bloki argumentów bezpośrednich.

## Faza 6 — Określ podstan i przedstaw następne przekazanie

Wyodrębnij podstan z artefaktów na dysku dla bieżącego wiersza §3: folder zmiany, `research.md`, `plan.md` i niezaznaczone elementy `## Progress` w `plan.md`.

Przed wybraniem przekazania, w razie potrzeby uzgodnij przestarzały status §3 z dysku:

- `research.md` istnieje, a §3 nadal mówi `change opened` → zaktualizuj na `researched`.
- `plan.md` istnieje, a §3 nadal mówi `change opened` lub `researched` → zaktualizuj na `planned`.
- `plan.md` istnieje z oczekującym postępem, a §3 nie jest `implementing` → zaktualizuj na `implementing` przed przekazaniem do `/10x-implement`.
- `plan.md` Postęp jest w pełni `[x]` → zaktualizuj na `complete` i kontynuuj do Przekazania E.

To leniwe uzgadnianie wspiera ustalony proces badanie → planowanie → implementacja: umiejętności niższego poziomu nie muszą wracać tutaj tylko po to, aby zmieniać etykiety statusu.

Mapuj stan na jedno z pięciu przekazań. Każde z nich drukuje następne wywołanie, kopiuje je do schowka, a następnie ZATRZYMUJE. Dla stanów już w procesie niższego poziomu, ładunek przekazania przypomina aktywnej umiejętności, aby zasugerowała następne naturalne polecenie po zakończeniu, zamiast wracać tutaj w celu routingu.

### Zasada kontynuacji w dół strumienia

Po zakończeniu każdej głównej fazy niższego poziomu, sugeruj następne naturalne polecenie w ustalonym procesie `/10x-research` → `/10x-plan` → `/10x-implement`, chyba że istnieje wyraźna blokada, korekta lub brakująca decyzja. Następne polecenie powinno zawierać tylko bezpośredni parametr, którego potrzebuje teraz następna umiejętność. Nie proś użytkownika o ponowne uruchomienie `/10x-test-plan` tylko po to, aby odkryć już znany następny krok.

Wróć do `/10x-test-plan`, gdy sam plan testów wymaga uwagi: przeniesienie poprawek badawczych, uzgodnienie zakończonej fazy wdrożenia, wybór następnej fazy wdrożenia, `--status` lub `--refresh`.

### Przekazanie A — Brak folderu zmiany (Status `not started`)

Zaproponuj identyfikator zmiany z nazwy fazy wdrażania (kebab-case, z prefiksem `testing-`). Np. "Critical-path coverage" → `testing-critical-path-coverage`. Potwierdź z użytkownikiem, a następnie zaktualizuj §3 (Status → `change opened`, Change folder → wybrany identyfikator) **przed** przekazaniem, aby wznowienie działało, jeśli sesja umrze.

Następnie uruchom **Rytuał Przekazania** z:

```
/10x-new <change-id>
```

…bezpośrednio po tym blokiem intencji jako argumentem:

```
Open a change folder for rollout Phase <N> of context/foundation/test-plan.md: "<phase name>".
Risks covered: <list from §2>. Test types planned: <list from §3>.
Risk response intent: <for each covered risk, one line from §2 Risk Response Guidance describing the behavior or failure mode this phase must prove protected>.
After creating the folder, follow the downstream continuation rule.
```

### Przekazanie B — `change.md` istnieje, brak `research.md` (Status `change opened`)

Uruchom Rytuał Przekazania z:

```
/10x-research
```

…bezpośrednio po tym zapytaniem badawczym o takim kształcie:

```
Ground rollout Phase <N> of context/foundation/test-plan.md.

Risks to verify: <Risk #X, #Y from §2>.
Risk response guidance to verify, not blindly accept:
- <Risk #X>: prove <observable behavior/failure mode>; challenge <obvious assumption>; avoid <anti-pattern>.
- <Risk #Y>: prove <observable behavior/failure mode>; challenge <obvious assumption>; avoid <anti-pattern>.
Hot-spot directories that raised these risks (likelihood evidence — NOT anchors): <dir 1, dir 2 from §1 scope>.
Stack: <from §4>.

The test plan carries evidence and response intent, not code anchors. For each risk, ground the real failure path in code, quote relevant lines, verify or correct the response guidance, locate existing tests, identify the cheapest useful test layer, and flag speculative risks or misleading hot-spot evidence.

Write findings to context/changes/<change-id>/research.md.
Then follow the downstream continuation rule.
```

Jeśli użytkownik wróci tutaj po badaniu, zaktualizuj status wiersza §3 przewodnika na `researched` przed kontynuowaniem. Uruchom również **sprawdzenie przeniesienia po badaniu** (patrz poniżej). Ten powrót służy głównie do poprawek; szczęśliwa ścieżka powinna być kontynuowana zgodnie z zasadą kontynuacji w dół strumienia.

### Sprawdzenie przeniesienia po badaniu

Po wylądowaniu `research.md` i przed przedstawieniem Przekazania C, przeczytaj nowy plik badawczy i poszukaj dwóch rodzajów ustaleń:

1. **Korekty punktów zakotwiczenia** — badanie wykryło, że awarie występują w katalogu/obszarze innym niż ten, który kolumna Source w §2 cytowała jako dowód gorącego punktu (np. §2 cytowało `src/lib/schemas/` jako dowód gorącego punktu dla ryzyka dryfu odpowiedzi, ale badanie pokazuje, że schemat odpowiedzi faktycznie znajduje się w `src/lib/openrouter.ts`). Cytat gorącego punktu jest mylący.
2. **Potwierdzenia spekulatywnych ryzyk** — badanie oznaczyło ryzyko jako "opisujące implementację, nic do zepsucia" i zaproponowało usunięcie/przeformułowanie.
3. **Korekty wskazówek dotyczących odpowiedzi** — badanie zweryfikowało, że planowana odpowiedź nie wykryłaby awarii, wybrało tańszą warstwę lub stwierdziło, że wymienione założenie "musi zakwestionować" było błędne.

Jeśli którykolwiek z nich jest obecny, zapytaj użytkownika:

> Research surfaced corrections to the test plan §2:
> - [list each finding in one line]
>
> Backport into `context/foundation/test-plan.md` §2 now (Source column, risk wording, or Risk Response Guidance only — never adds file anchors), or defer to `--refresh`?

Jest to JEDYNA dozwolona edycja na miejscu w §1/§2 poza `--refresh`. Edycja zmienia cytat źródłowy, sformułowanie ryzyka lub komórki wskazówek dotyczące reagowania na ryzyko, nigdy nie dodaje punktu zakotwiczenia plik:linia (zasada #3 nadal obowiązuje).

### Przekazanie C — `research.md` istnieje, brak `plan.md` (Status `researched`)

Uruchom Rytuał Przekazania z:

```
/10x-plan
```

…bezpośrednio po tym monitem planistycznym o takim kształcie:

```
Plan rollout Phase <N> of context/foundation/test-plan.md. Read research.md
and change.md fully. Risks covered: <list>. Test types: <list>. Hot-spot scope:
<from §1>.

Risk response guidance from the test plan and research:
- <Risk #X>: prove <behavior/failure mode>; required context <grounded fact from research>; anti-pattern to avoid <specific anti-pattern>.
- <Risk #Y>: prove <behavior/failure mode>; required context <grounded fact from research>; anti-pattern to avoid <specific anti-pattern>.

Plan sub-phases by cost × signal and risk priority. Each test sub-phase must state behavior asserted, regression caught, research source, edge/error/boundary case, and anti-pattern avoided. Challenge happy paths, avoid implementation mirrors, keep grounding explicit, date any AI-native guidance, and make the final sub-phase update §6 with the cookbook patterns shipped.

Then follow the downstream continuation rule.
```

Jeśli użytkownik wróci tutaj po napisaniu `plan.md`, zaktualizuj status §3 na `planned`. Ten powrót nie jest wymagany na szczęśliwej ścieżce; `/10x-plan` powinien postępować zgodnie z zasadą kontynuacji w dół strumienia.

### Przekazanie D — `plan.md` istnieje z oczekującym postępem (Status `planned` lub `implementing`)

Znajdź pierwszy niezaznaczony wiersz w `## Progress` i wyodrębnij jego numer podfazy, np. `N.M` z `- [ ] N.M <tytuł>`.

Uruchom Rytuał Przekazania z:

```
/10x-implement <change-id> phase <N>
```

(Nie jest potrzebny bezpośredni argument; `/10x-implement` odczytuje plan bezpośrednio.)

Zaktualizuj status §3 przewodnika na `implementing` przy pierwszym przejściu; pozostaw go na `implementing` dla kolejnych podfaz.

### Przekazanie E — `plan.md` Postęp w pełni `[x]` (Status `complete`)

Faza wdrażania jest zakończona. Zaktualizuj status §3 na `complete`. Następnie **wróć do Fazy 5** — znajdź następną oczekującą fazę wdrażania, przedstaw jej Przekazanie A. Nie wychodź, dopóki:

- Wszystkie wiersze §3 są `complete` → wydrukuj podsumowanie zakończenia (patrz "Wszystkie fazy ukończone" na dole tej umiejętności).
- Użytkownik chce się tutaj zatrzymać → po zaktualizowaniu statusu, wydrukuj krótkie podsumowanie i ZATRZYMAJ.

Użyj `AskUserQuestion` po oznaczeniu jako ukończone:

> Rollout Phase <N> is complete. Proceed to Phase <N+1>, or stop here?
>
> - **Continue to Phase <N+1>** — I'll present the `/10x-new` handoff for the next phase.
> - **Stop here** — I'll print a status snapshot and exit. Re-run `/10x-test-plan` to resume.

---

## Rytuał Przekazania

Każde przekazanie (A–D) drukuje następne wywołanie, kopiuje je do schowka, gdy host obsługuje dostęp do schowka, a następnie zatrzymuje się. Dla przekazań A–C, następne wywołanie to polecenie slash, po którym natychmiast następuje blok intencji/zapytania/monitu jako argument polecenia; nie zakładaj, że polecenie `/10x-*` niższego poziomu poprosi o parametry po uruchomieniu. Dla przekazania D, wywołanie jest tylko poleceniem, ponieważ `/10x-implement` odczytuje plan bezpośrednio. Późniejsze wywołanie `/10x-test-plan` ponownie określa stan z dysku i uzgadnia wszelkie przestarzałe statusy §3.

### Krok 1 — Drukuj

```
─────────────────────────────────────────────────────────────────────
Next step: <human-readable description>

Copied invocation (✓ copied to clipboard):

<exact command> <intent/query/prompt block, if any>

Then /clear and paste the copied invocation. After that phase completes, continue with the next natural command suggested by the active skill unless it reports a blocker.
─────────────────────────────────────────────────────────────────────
```

### Krok 2 — Kopiuj do schowka

Użyj narzędzia schowka hosta, jeśli jest dostępne. Jeśli nie, pozostaw wydrukowane wywołanie jako źródło prawdy.

### Krok 3 — ZATRZYMAJ

Nie czekaj na potwierdzenie. Zadanie umiejętności dla tego wywołania jest zakończone.

---

## Tryb `--status`

Pomiń całą logikę faz; przeczytaj przewodnik, jeśli jest obecny, i wydrukuj kompaktowy status wdrożenia. Przykładowy wynik:

```
Test rollout status — context/foundation/test-plan.md

| # | Phase                       | Status        | Change folder                                  | Next action                                  |
|---|-----------------------------|---------------|------------------------------------------------|-----------------------------------------------|
| 1 | Critical-path coverage      | complete      | context/changes/testing-critical-path-coverage/ | —                                             |
| 2 | Integration around hot-spots | implementing  | context/changes/testing-integration-hotspots/  | /10x-implement testing-integration-hotspots phase 3 |
| 3 | AI-native layer             | not started   | —                                              | /10x-new testing-ai-native-layer              |
| 4 | Quality-gates wiring        | not started   | —                                              | (waits for Phase 3 to land)                   |

Currently at: Phase 2, sub-phase 3 of 5.
```

Jeśli przewodnik brakuje, wydrukuj:

```
No test-plan.md found at context/foundation/. Run /10x-test-plan
without --status to start the rollout.
```

…i ZATRZYMAJ.

## Tryb `--refresh`

Uruchamiany, gdy użytkownik wywoła `/10x-test-plan --refresh` lub gdy przewodnik jest przestarzały (np. data `checked:` zalecanego narzędzia jest starsza niż 3 miesiące). Odświeżanie **nie edytuje przewodnika na miejscu** — otwiera nowy folder zmiany `test-plan-refresh-<RRRR-MM-DD>`:

1. Uruchom Fazy 1+2 od nowa — gorące punkty i obawy to jedyne uczciwe wyzwalacze odświeżania.
2. Zsyntetyzuj brief o zakresie odświeżania: co jest dziś w przewodniku, co jest przestarzałe, czego brakuje.
3. Przekaż do `/10x-new` z tym briefem (standardowy Rytuał Przekazania).
4. Łańcuch działa normalnie; końcowa podfaza planu aktualizuje status §3 i wzorce podręcznika §6, ale nigdy nie przepisuje §1/§2 bez wyraźnej instrukcji użytkownika.

---

## Interaktywne monity — niezależne od hosta

Zawsze, gdy ta umiejętność mówi *"zapytaj użytkownika"*, użyj dowolnego narzędzia do interaktywnych pytań, które udostępnia host (np. `AskUserQuestion`, `ask_question`, `request_user_input`). Przed pierwszym interaktywnym krokiem, przeskanuj dostępne narzędzia w poszukiwaniu takiego z parametrem `question` i polem `options`/`choices`; użyj pierwszego dopasowania. Jeśli żadne nie istnieje, wróć do zwykłej konwersacyjnej wiadomości z oznaczonymi opcjami.

## Wszystkie fazy ukończone

Gdy pętla zakończy się, a każdy wiersz §3 ma status `complete`:

```
Rollout complete — every phase in context/foundation/test-plan.md is now `complete`.

What landed:
- <N> rollout phases shipped
- <N> change folders archived (see context/archive/ for history)
- context/foundation/test-plan.md now reflects what is actually tested,
  how to add new tests by area, and the gates that are wired

Refresh cadence: re-run /10x-test-plan --refresh when a new top-3 risk
surfaces, a tool's `checked:` date is > 3 months old, the tech stack changes,
or §7 negative-space no longer matches what the team believes.
```

Następnie zasugeruj test dymkowy: otwórz nową sesję agenta i zapytaj "Przeczytaj zasady projektu i `context/foundation/test-plan.md`. Co powinienem najpierw przetestować dla nowego punktu końcowego `<obszar>`, i dlaczego?" Agent powinien nazwać wzorzec podręcznika, lokalizację i najtańszy typ testu. Jeśli wybierze losowy plik, plik zasad nie wskazuje jeszcze na `context/foundation/`.

## Czego ta umiejętność NIE robi

- Nie pisze kodu testowego, nie konfiguruje hooków/MCP/CI YAML ani nie edytuje AGENTS.md. Te rzeczy lądują poprzez fazy wdrażania niższego poziomu.
- Nie wymyśla ryzyk — każde ryzyko pochodzi z PRD, mapy drogowej, archiwum, gorących punktów lub wywiadu z Fazy 2.
- Nie wywołuje automatycznie umiejętności niższego poziomu. Każde przekazanie zatrzymuje się w schowku i czeka, ale każda ukończona faza niższego poziomu powinna sugerować następne naturalne polecenie w ustalonym procesie badanie → planowanie → implementacja, chyba że istnieje wyraźna blokada.
- **Nie odczytuje bazy kodu w poszukiwaniu wiedzy.** Zmiany w gorących punktach, liczba baz testowych, znacznik projektu, wykrywanie frameworka — tak. Grafy wywołań, treści schematów, logika tłumaczenia błędów, "który plik jest odpowiedzialny za tę awarię" — nie. Ta ekstrakcja to zadanie `/10x-research`, uruchamiane dla każdej fazy wdrażania na aktualnym kodzie. Jeśli kiedykolwiek poczujesz pokusę, aby zacytować `src/foo/bar.ts:42` w §2, przekroczyłeś granicę — zatrzymaj się i pozwól, aby badanie to zrobiło. (Patrz "Zasady nośne" §3.)

## Ton

Profesjonalny, instruktażowy, zwięzły. Tryb rozkazujący. Bez języka marketingowego. Bez emotikonów (pojedynczy ✓ w potwierdzeniu schowka jest funkcjonalny).

## Przypadki brzegowe

- **Brak PRD, archiwum lub mapy drogowej.** Pyta użytkownika o kanoniczne źródła kontekstu; jeśli żadne nie zostaną podane, przewodnik opiera się w dużej mierze na wywiadzie z Fazy 2 i skanowaniu gorących punktów.
- **Stos poliglota.** Wybierz dominującą powierzchnię testową według liczby plików dla zakresu gorących punktów; wspomnij o drugorzędnych stosach w §2, jeśli są odpowiedzialne za główne ryzyko.
- **Brak istniejącej infrastruktury testowej.** §4 mówi "jeszcze brak"; pierwsza faza wdrażania uruchamia runner + pierwszy test integracyjny dla Ryzyka #1.
- **Brownfield z bogatymi istniejącymi testami.** Badanie podkreśla, co NIE jest pokryte; §6 obejmuje zarówno to, co istnieje, jak i to, co dodaje wdrożenie.
- **Przewodnik w języku innym niż angielski.** Napisz treść w żądanym języku; zachowaj słownictwo statusu §3 w języku angielskim, aby parser nadal działał.
- **Porzucony plan (Status `planned`/`implementing`, użytkownik chce pominąć).** Zapytaj jawnie; jeśli potwierdzono, oznacz jako `complete` z jednowierszową notatką o pominięciu i przejdź dalej. Nigdy nie przechodź dalej po cichu.
