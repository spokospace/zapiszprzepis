---
name: 10x-shape
description: >
  Facilitate a structured discovery conversation that turns an idea —
  greenfield or brownfield — into shape-notes.md, the input to /10x-prd.
  Auto-detects context type from project markers in cwd (brownfield) or
  absence thereof (greenfield) and adapts all six discovery phases
  accordingly. Use when the user is starting a new project from scratch OR
  shaping a meaningful change to an existing system (new module, significant
  feature, architectural improvement). Trigger phrases: "new project",
  "from scratch", "starting an app", "od pomysłu", "shape an idea",
  "brainstorm a product", "greenfield", "I have an idea", "existing project",
  "brownfield", "istniejący projekt", "zmiana w projekcie".
  Use BEFORE /10x-prd, not in place of it.
argument-hint: "[freeform idea]"
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - Skill
---

# Shape: Ułatwianie odkrywania (Greenfield i Brownfield) przed /10x-prd

Ta umiejętność jest początkiem łańcucha bootstrap. Dla greenfield: `/10x-shape → /10x-prd → 10x-tech-stack-selector → bootstrapper`. Dla brownfield: `/10x-shape → /10x-prd → 10x-stack-assess → 10x-health-check`. Jej jedyne zadanie: przeprowadzić użytkownika od "Mam pomysł" (greenfield) lub "Chcę zmienić ten system" (brownfield) do ustrukturyzowanego pliku `context/foundation/shape-notes.md`, który `/10x-prd` może przekształcić w PRD zgodny z zablokowanym schematem.

Umiejętność ta jest **facylitatorem**, a nie generatorem treści. NIGDY nie pisze wizji, wymagań funkcjonalnych, reguł logiki biznesowej ani żadnych innych treści domenowych, których użytkownik nie powiedział. Jej wartość tkwi w kształcie pytań i ich kolejności, a nie w oferowanych odpowiedziach.

Zablokowany schemat, do którego dostosowują się zarówno ta umiejętność, jak i `/10x-prd`, znajduje się w `references/prd-schema.md` (względem tego SKILL.md). Przeczytaj go przed wytworzeniem jakiegokolwiek artefaktu i sprawdź ponownie przy każdym zapisie punktu kontrolnego.

## Kiedy używać, kiedy pominąć

**Użyj, gdy**: użytkownik opisuje nowy pomysł na projekt (greenfield), znaczącą zmianę w istniejącym systemie — nowy moduł, istotną funkcję, ulepszenie architektury (brownfield) lub produkt, który chce odbudować od podstaw. Użyj również, gdy istniejący `context/foundation/shape-notes.md` jest niekompletny i wymaga wznowienia. Umiejętność automatycznie wykrywa typ kontekstu na podstawie znaczników projektu w bieżącym katalogu roboczym i odpowiednio dostosowuje się.

**Pomiń, gdy**: projekt ma już PRD lub zestaw ADR (użyj zamiast tego `/10x-frame` lub `/10x-plan`), lub użytkownik rozważa pojedynczy błąd / refaktoryzację / małą funkcję w istniejącej bazie kodu, która nie wymaga pełnego PRD (użyj `/10x-frame`). W przypadku projektów brownfield, gdzie użytkownik chce ukształtować znaczącą zmianę, ta umiejętność JEST właściwym punktem wyjścia.

## Relacje z innymi umiejętnościami

- `/10x-init` — tworzy szkielet `/context` (`changes/`, `archive/`, `foundation/`) oraz uniwersalne pliki README w każdym z nich. `/10x-shape` wymaga istnienia `context/foundation/`; jeśli go brakuje, deleguje do `/10x-init` za pomocą narzędzia `Skill` (Krok 0 poniżej).
- `/10x-prd` — konsumuje `shape-notes.md`. Przekazanie to zapis do schowka `## Step 8`.
- `/10x-frame` — do *przeformułowania* problemów o małym zakresie w istniejących systemach, gdzie pełne PRD jest przesadą. `/10x-shape` jest przeznaczony do większych zmian brownfield (nowe moduły, znaczące funkcje), które wymagają ustrukturyzowanego odkrywania i PRD.
- `/10x-stack-assess` — następny po `/10x-prd` dla projektów brownfield. Ocenia istniejący stos pod kątem bram jakości.
- `/10x-health-check` — następny po `/10x-stack-assess` dla brownfield. Audytuje stan istniejącego projektu.
- `/10x-plan` — następny po `/10x-prd`, nigdy nie wywoływany bezpośrednio stąd.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli jako argument podano swobodny pomysł** (np. `/10x-shape aplikacja z przepisami, która sugeruje posiłki z tego, co jest w lodówce`), zapisz go dosłownie jako **pomysł początkowy**. Nie parafrazuj. Przejdź do Kroku 0.
2. **Jeśli podano ścieżkę pliku** (np. `/10x-shape @notes/idea.md`), przeczytaj go W CAŁOŚCI i użyj jego zawartości jako pomysłu początkowego. Przejdź do Kroku 0.
3. **Jeśli nic nie podano**, odpowiedz:

```
Pomogę Ci ukształtować pomysł w ustrukturyzowane notatki, które /10x-prd może
przekształcić w prawdziwe PRD — niezależnie od tego, czy zaczynasz od zera
(greenfield), czy kształtujesz zmianę w istniejącym systemie (brownfield).

Proszę podziel się:
1. Pomysłem początkowym — co chcesz zbudować lub zmienić, własnymi słowami?
2. (Opcjonalnie) Wszelkimi wstępnymi notatkami, szkicami lub linkami, które
   powinienem przeczytać.

Wskazówka: przekaż pomysł w linii — `/10x-shape aplikacja z przepisami, która
     wykorzystuje zawartość lodówki`
     lub dla brownfield — `/10x-shape dodaj silnik rekomendacji do mojej
     aplikacji z przepisami`
```

Następnie poczekaj.

## Proces

### Krok 0: Sprawdź warunek wstępny 10xWorkflow

Sprawdź szkielet 10xWorkflow, testując dwie ścieżki:

```bash
test -d context/foundation
```

Jeśli istnieje, przejdź do Kroku 0.5.

Jeśli brakuje, projekt nie został zainicjowany dla 10xWorkflow. Zapytaj:

AskUserQuestion:
- question: "Ten katalog nie jest zainicjowany dla 10xWorkflow (brakuje context/foundation/). Uruchomić /10x-init teraz?"
  header: "Inicjalizacja?"
  options:
  - label: "Tak — uruchom /10x-init (Zalecane)"
    description: "Tworzy szkielet /context (changes/, archive/, foundation/) z plikami README, a następnie kontynuuje kształtowanie."
  - label: "Nie — zatrzymaj tutaj"
    description: "Wyjdź bez zmian. Będziesz musiał zainicjować, zanim shape będzie mógł działać."
  multiSelect: false

W przypadku "Tak": wywołaj `/10x-init` za pomocą narzędzia **Skill** (NIE za pomocą Bash). Gdy `/10x-init` zwróci wynik, ponownie sprawdź warunek wstępny; jeśli teraz przejdzie, kontynuuj do Kroku 0.5. W przypadku "Nie": wydrukuj "Zatrzymywanie. Uruchom `/10x-init`, gdy będziesz gotowy, a następnie ponownie wywołaj `/10x-shape`." i ZATRZYMAJ.

Nie duplikuj logiki szkieletu `/10x-init`. Narzędzie `Skill` jest poprawną ścieżką delegacji.

### Krok 0.5: Wykrywanie wznowienia

Przed rozpoczęciem od nowa, sprawdź poprzednią sesję:

```bash
test -f context/foundation/shape-notes.md
```

Jeśli brakuje, przejdź do Kroku 1 z nową sesją.

Jeśli istnieje, przeczytaj plik W CAŁOŚCI. Przeanalizuj blok frontmatter `checkpoint:` zgodnie z odniesieniem do schematu (`references/prd-schema.md`, sekcja "shape-notes.md checkpoint format"). Wyodrębnij: `current_phase`, `phases_completed`, `frs_drafted`, `quality_check_status`.

Podsumuj, co znalazłeś:

```
Znaleziono poprzednią sesję kształtowania w context/foundation/shape-notes.md:

  Projekt:                 [z pola project w frontmatter, lub "(bez nazwy)"]
  Bieżąca faza:            [N — Nazwa fazy]
  Ukończone fazy:          [lista]
  Wymagania funkcjonalne (FRs) sporządzone do tej pory: [liczba]
  Status kontroli jakości: [oczekujące | ostrzeżenie | zaakceptowane]
```

Następnie zapytaj:

AskUserQuestion:
- question: "Jak chcesz postąpić?"
  header: "Wznowić?"
  options:
  - label: "Wznów od Fazy [następna] (Zalecane)"
    description: "Kontynuuj od miejsca, w którym zakończyła się poprzednia sesja. Ukończone fazy są podsumowywane, a nie odtwarzane."
  - label: "Rozpocznij od nowa"
    description: "Zarchiwizuj istniejący shape-notes.md do context/foundation/archive/ i rozpocznij nową sesję."
  - label: "Anuluj"
    description: "Wyjdź bez zmian."
  multiSelect: false

W przypadku "Wznów": przejdź bezpośrednio do następnej niedokończonej fazy (Krok `current_phase` + (1, jeśli bieżąca jest w `phases_completed`, w przeciwnym razie 0)). NIE uruchamiaj ponownie ukończonych faz — tylko podsumuj każdą z nich użytkownikowi w 1-2 zdaniach ("Faza 1 uchwycona: <jednolinijkowy problem>; Faza 2 uchwycona: <jednolinijkowa persona>; …"), aby miał kontekst tego, co już zostało ustalone.

W przypadku "Rozpocznij od nowa": przenieś istniejący plik do `context/foundation/archive/shape-notes-<RRRR-MM-DD-GGMM>.md` (utwórz katalog archiwum, jeśli go brakuje), a następnie przejdź do Kroku 1 z nową sesją.

W przypadku "Anuluj": ZATRZYMAJ bez zmian.

### Krok 0.7: Wykrywanie typu kontekstu

Przed wejściem w pętlę odkrywania, określ, czy jest to sesja greenfield czy brownfield. Wykrywanie odbywa się raz; wynik (`context_type`) jest zapisywany w frontmatter shape-notes.md i steruje zachowaniem fazy przez resztę sesji.

**Automatyczne wykrywanie**: oceń bieżący katalog roboczy w trzech poziomach sygnałów. Pojedynczy plik manifestu nie wystarczy — pusty katalog `npm init -y` nie powinien wywoływać brownfield.

```bash
# Poziom 1 (silny): kontrola wersji z historią
git log --oneline -1 2>/dev/null && echo "T1:git-history"

# Poziom 2 (średni): pliki lockfile dowodzą, że nastąpiło rzeczywiste rozwiązanie zależności
ls package-lock.json yarn.lock pnpm-lock.yaml Cargo.lock poetry.lock go.sum Gemfile.lock composer.lock 2>/dev/null | while read f; do echo "T2:$f"; done

# Poziom 3 (słaby): same pliki manifestu — może to być świeża inicjalizacja
ls package.json Cargo.toml pyproject.toml go.mod Gemfile composer.json 2>/dev/null | while read f; do echo "T3:$f"; done

# Dodatkowe sygnały (potwierdzają, ale nie wywołują samodzielnie): katalogi źródłowe, konfiguracje frameworków, CI
ls -d src/ app/ lib/ .github/ .gitlab-ci.yml Dockerfile tsconfig.json next.config.* vite.config.* 2>/dev/null | while read f; do echo "B:$f"; done
```

```powershell
# PowerShell (Windows) — użyj tego bloku zamiast powyższego bloku bash w powłokach Windows.
# NIE pozwól, aby translator bash→PowerShell przepisał blok bash: wzorzec `while read f; do echo "B:$f"`
# tworzy dosłowny ciąg "B:$f", który Windows interpretuje jako dysk `B:`, wywołując
# monit o uprawnienia dla nieistniejącego dysku.

# Poziom 1 (silny): kontrola wersji z historią
if (git log --oneline -1 2>$null) { "T1:git-history" }

# Poziom 2 (średni): pliki lockfile dowodzą, że nastąpiło rzeczywiste rozwiązanie zależności
@('package-lock.json','yarn.lock','pnpm-lock.yaml','Cargo.lock','poetry.lock','go.sum','Gemfile.lock','composer.lock') |
  Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { "T2:$_" }

# Poziom 3 (słaby): same pliki manifestu — może to być świeża inicjalizacja
@('package.json','Cargo.toml','pyproject.toml','go.mod','Gemfile','composer.json') |
  Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { "T3:$_" }

# Dodatkowe sygnały (potwierdzają, ale nie wywołują samodzielnie): katalogi źródłowe, konfiguracje frameworków, CI
@('src','app','lib','.github','.gitlab-ci.yml','Dockerfile','tsconfig.json') |
  Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { "B:$_" }
Get-ChildItem -Path . -Filter 'next.config.*' -File -ErrorAction SilentlyContinue |
  ForEach-Object { "B:$($_.Name)" }
Get-ChildItem -Path . -Filter 'vite.config.*' -File -ErrorAction SilentlyContinue |
  ForEach-Object { "B:$($_.Name)" }
```

Punktacja:
- **Trafienie Poziomu 1** (istnieje historia git) → silny sygnał brownfield
- **Trafienie Poziomu 2** (istnieje plik lockfile) → silny sygnał brownfield
- **Poziom 1 + Poziom 2** → brownfield o wysokiej pewności
- **Tylko Poziom 3** (manifest, brak lockfile, brak git) → niejednoznaczne — może to być świeża inicjalizacja `npm init`
- **Brak sygnałów** → greenfield

Logika decyzji:
- **Dowolne trafienie Poziomu 1 lub Poziomu 2** → proponuj `context_type: brownfield`
- **Tylko Poziom 3** → proponuj brownfield, ale zaznacz niejednoznaczność: "Znalazłem plik manifestu, ale brak pliku lockfile lub historii git — może to być świeżo zainicjowany projekt, a nie prawdziwy brownfield."
- **Brak sygnałów** → proponuj `context_type: greenfield`

Wydrukuj, co zostało wykryte:

- **Brownfield o wysokiej pewności** (T1 lub T2):
  ```
  Wygląda na istniejący projekt:
    [lista wykrytych sygnałów, np. "historia git (47 commitów)", "package-lock.json", "katalog src/"]
  Będę działać w trybie brownfield — skupiając się na tym, co istnieje, co się zmienia,
  i co musi zostać zachowane.
  ```

- **Niejednoznaczne** (tylko T3):
  ```
  Znalazłem [plik manifestu], ale brak pliku lockfile lub historii git — może to być
  świeżo zainicjowany projekt lub prawdziwy brownfield. Zaproponuję tryb brownfield,
  ale przełączę na greenfield, jeśli zaczynasz od zera.
  ```

- **Greenfield** (brak sygnałów):
  ```
  Nie znaleziono znaczników projektu w tym katalogu — będę działać w trybie greenfield,
  co zakłada, że zaczynasz od zera.
  ```

Następnie potwierdź z użytkownikiem:

AskUserQuestion:
- question: "Wykryty kontekst: [greenfield|brownfield]. Czy to poprawne?"
  header: "Kontekst"
  options:
  - label: "[Greenfield|Brownfield] — poprawne (Zalecane)"
    description: "[Opis trybu automatycznie wykrytego]"
  - label: "[Inny tryb] — nadpisz"
    description: "Przełącz na [inny tryb] zamiast tego."
  multiSelect: false

Zapisz potwierdzony `context_type` do frontmatter shape-notes.md (obok `checkpoint:`) natychmiast. Ta wartość jest kluczowa dla automatycznego routingu `/10x-prd`.

W przypadku wznowienia (Krok 0.5), jeśli shape-notes.md ma już `context_type:` w frontmatter, pomiń automatyczne wykrywanie — tryb jest zablokowany z poprzedniej sesji.

### Wzorzec odkrywania (dotyczy każdego z poniższych Kroków 1–6)

Każda faza odkrywania przebiega według tej samej pętli. Zinternalizuj to przed przeczytaniem kroków dla poszczególnych faz; treść dla poszczególnych faz to to, o co pytać, a nie jak pytać.

Wzorzec to **BMAD-Facilitator + GSD-Gray-Area + mattpocock-recommended-answer + Socrates challenge**:

1. **Rozpocznij fazę** jednolinijkowym stwierdzeniem, co ta faza wytwarza, i jednym otwartym pytaniem, aby wywołać pierwszą próbę użytkownika. (Postawa facylitatora BMAD: nigdy nie generuj treści samodzielnie.)
2. **Wyprowadź 3-5 szarych obszarów** jako decyzje wielokrotnego wyboru, gdy pierwsza próba użytkownika zawiera niejasności. Użyj AskUserQuestion. Każda opcja to rzeczywista pozycja z kompromisem, a nie symbol zastępczy. (Odkrywanie szarych obszarów GSD.)
3. **Oznacz zalecaną opcję** jako "(Zalecane)" w etykiecie i umieść ją na pierwszym miejscu. Zawsze dołącz opcję "Nie jestem pewien / nie zdecydowałem". (mattpocock-recommended-answer, łagodzenie zmęczenia.)
4. **Zablokuj decyzję z powrotem u użytkownika** jako jednolinijkowe podsumowanie, które potwierdza, zanim zapiszesz na dysku.
5. **Zapisz sekcje fazy** do `shape-notes.md` i zwiększ `checkpoint.current_phase` oraz `checkpoint.phases_completed` zgodnie ze schematem.

**Twarde zasady**:

- NIGDY nie generuj treści, których użytkownik nie powiedział. Jeśli sekcja potrzebuje wartości, której użytkownik nie podał, zapytaj — nie wymyślaj. Wyjątkiem jest formatowanie mechaniczne (numeracja FR-NNN, nagłówki sekcji, szkielet frontmatter).
- NIGDY nie zobowiązuj się z góry do stosu (framework, baza danych, platforma hostingowa, rodzina języków). PRD zawiera tylko priorytety na poziomie produktu — `product_type`, `target_scale`, `timeline_budget`. Kwestie związane ze stosem są zbierane po `/10x-prd`.
- NIGDY nie używaj języka 10xDevs / kohorty / certyfikacji w dostarczanym wyniku. Mechanika tutaj to uniwersalne wskaźniki dobrze zdefiniowanego projektu. Artefakt skierowany do użytkownika jest ogólną umiejętnością kształtowania.

### Krok 1: Wizja i problem

Ta faza tworzy sekcje `## Vision & Problem Statement` i `## User & Persona` (tylko główna persona) w `shape-notes.md`. Dwie sekcje, a nie jedna, ponieważ persona wiąże problem. **Brownfield** tworzy również sekcję `## Current System`.

#### Tryb greenfield

Rozpocznij od: "Zacznijmy od bólu. W jednym lub dwóch zdaniach — kto go odczuwa, w jakim momencie go odczuwa, ile go to dziś kosztuje?"

Słuchaj. Powtórz trzy komponenty oddzielnie:

```
Ból:         [dosłowny problem]
Osoba:       [kto go odczuwa — nazwij rolę, a nie "użytkowników"]
Moment:      [kiedy go odczuwają — sytuacja, która wywołuje ból]
Koszt dziś:  [co obecnie robią i ile to kosztuje]
```

Jeśli którykolwiek z czterech jest niejasny ("wszyscy", "zawsze", "dużo bólu"), zakwestionuj go pytaniem Sokratesa: "Co musiałoby być prawdą, aby to był zły problem do rozwiązania?" lub "Kogo konkretnie widziałeś, kto doświadczył tego w ostatnim miesiącu?"

Następnie wyprowadź szare obszary (użyj AskUserQuestion z 2-4 pytaniami, **multiSelect dla pytań, gdzie wiele pozycji może współistnieć**):

- Kategoria bólu — jaki to rodzaj bólu? (tarcie w przepływie pracy / brak możliwości / dane uwięzione gdzieś / paraliż decyzyjny / narzut koordynacji / inne)
- Wgląd — co użytkownik wie, czego nie wie status quo? (użyj Sokratesa: "Jeśli twój pomysł jest oczywisty, dlaczego to nie zostało zbudowane?")
- Zakres głównej persony — kto dokładnie? (konkretna rola w organizacji / osoby w wielu organizacjach / pojedynczy nazwany użytkownik, w tym ty / nisza hobbystyczna / nie jestem pewien)

#### Tryb brownfield

Rozpocznij od: "Zacznijmy od obecnego systemu. W kilku zdaniach — co istnieje dzisiaj, kto tego używa i jaki jest punkt bólu lub brakująca funkcja, która napędza tę zmianę?"

Słuchaj. Powtórz pięć komponentów oddzielnie:

```
Obecny system:  [co istnieje — nazwij produkt/usługę/moduł]
Stos technologiczny: [języki, frameworki, infrastruktura, o których wspomina użytkownik]
Użytkownicy:    [kto tego używa dzisiaj — nazwij role, a nie "użytkowników"]
Ból / luka:     [co jest nie tak lub czego brakuje — wyzwalacz tej zmiany]
Musi zostać zachowane: [co NIE MOŻE się zepsuć — istniejące zachowanie, integracje, dane]
```

Jeśli użytkownik nie potrafi sprecyzować "musi zostać zachowane", zakwestionuj go: "Gdyby ta zmiana coś zepsuła jutro, co by cię zaalarmowało?" lub "Co twoi obecni użytkownicy zauważyliby najpierw?"

Następnie wyprowadź szare obszary:

- Kategoria zmiany — jaki to rodzaj zmiany? (nowy moduł / znacząca funkcja / ulepszenie architektury / migracja / integracja / inne)
- Wgląd — co użytkownik wie o obecnym systemie, co sprawia, że ta zmiana nie jest oczywista? (Sokrates: "Dlaczego to nie zostało jeszcze zrobione?")
- Zakres głównej persony — tak samo jak w greenfield

Najpierw napisz sekcję `## Current System` (sekcja tylko dla brownfield — opisuje, co istnieje), następnie `## Vision & Problem Statement` (przeformułowane jako delta: co się zmienia i dlaczego), a następnie `## User & Persona`.

#### Oba tryby

Zablokuj przechwyconą treść, dopasowując strukturę sekcji schematu. Dołącz do `shape-notes.md`. Zwiększ `checkpoint.current_phase: 2` i dodaj `1` do `checkpoint.phases_completed`.

### Krok 2: Persona i kontrola dostępu

Ta faza tworzy sekcję `## Access Control`. Persona została przechwycona w Kroku 1; tutaj pytamy, jak persona dociera do produktu.

#### Tryb greenfield

Rozpocznij od: "Jak ta osoba dostaje się do aplikacji? Logowanie, profil lokalny, klucz dostępu, brak autoryzacji w ogóle?"

Użyj AskUserQuestion z opcjami zaczerpniętymi z najczęstszych form:

- Logowanie (e-mail + hasło / OAuth / bezhasłowe) (Zalecane dla wielu użytkowników web/mobile)
- Profil lokalny (dane znajdują się na urządzeniu, brak serwera) (Zalecane dla solo / zorientowanych na prywatność)
- Klucz dostępu (link lub token; brak tworzenia konta)
- N/A — pojedynczy użytkownik, pojedyncze urządzenie, brak separacji

Jeśli odpowiedź jest inna niż N/A, zadaj jedno pytanie uzupełniające dotyczące separacji ról: czy jest to płaski model użytkownika, czy istnieją role (np. administrator / członek / gość), które widzą różne rzeczy? Sokrates: "Jaki jest najmniejszy model dostępu, który nadal sprawiłby, że MVP byłby użyteczny?"

#### Tryb brownfield

Rozpocznij od: "Opisz obecne uwierzytelnianie i role użytkowników w tym systemie. Jak użytkownicy logują się dzisiaj i jakie role istnieją?"

Słuchaj. Następnie zapytaj, co się zmienia:

- "Czy model uwierzytelniania zmienia się w ramach tej pracy?" (tak — opisz / nie — pozostaw bez zmian)
- "Czy dodawane są nowe role, czy istniejące granice ról się przesuwają?" (tak — opisz / nie — pozostaw bez zmian)

Jeśli użytkownik powie, że uwierzytelnianie się nie zmienia, zapisz obecny model uwierzytelniania jako `## Access Control` z notatką: `Nie planowane zmiany — obecny model zachowany.` Jeśli planowane są zmiany, przechwyć zarówno obecny model, jak i planowane zmiany.

Sokrates: "Jaka jest najmniejsza zmiana dostępu, która nadal sprawiłaby, że ta funkcja byłaby użyteczna bez zakłócania istniejących użytkowników?"

#### Oba tryby

Zapisz przechwyconą treść jako blok `## Access Control` zgodnie ze schematem. Zwiększ `checkpoint.current_phase: 3` i dodaj `2` do `checkpoint.phases_completed`.

### Krok 3: Dyscyplina MVP

Ta faza tworzy szkic bloku `## Success Criteria` (podsekcje Primary / Secondary / Guardrails zgodnie ze schematem) i inicjuje pole `timeline_budget` w frontmatter.

#### Tryb greenfield

Rozpocznij od: "Naszkicuj najmniejszy, kompleksowy przepływ użytkownika, który udowodni, że ten produkt działa. Przeprowadź mnie przez pierwszą sesję, klik po kliku."

Słuchaj. Gdy użytkownik opisze przepływ, powtórz go jako sekwencję numerowaną ("1. użytkownik otwiera aplikację, 2. użytkownik robi X, 3. użytkownik widzi Y, …") i zapytaj: "Gdybyś miał trzy tygodnie pracy po godzinach, czy możesz dostarczyć ten przepływ?"

**Powierzchnia kosztów zakresu**: jeśli przepływ ma więcej niż ~6 odrębnych akcji użytkownika przed wytworzeniem wartości, LUB własne oszacowanie użytkownika przekracza ~3 tygodnie pracy po godzinach, LUB przepływ wymaga wielu integracji / usług zewnętrznych / niestandardowej infrastruktury przed jakimkolwiek widocznym dla użytkownika zyskiem, wyraźnie przedstaw koszt. Celem jest świadomy wybór, a nie egzekwowanie — dłuższe terminy są ważne, ale użytkownik powinien je świadomie wybrać:

```
Ta pierwsza wersja jest większa niż to, co zazwyczaj jest dostarczane w trzy
tygodnie pracy po godzinach. Pułapka greenfield polega na niedostarczeniu
niczego, ponieważ pierwsza wersja była zbyt duża, aby ją ukończyć. Dwie
ważne ścieżki stąd:

  Zmniejsz zakres — utrzymuj krótki termin. Typowe posunięcia:
    - Odrzuć [zidentyfikowany drogi element] dla v1; dodaj go w v2, gdy
      cokolwiek będzie działać.
    - Zastąp [zidentyfikowaną integrację] wersją ręczną / zakodowaną na
      teraz.
    - Zmniejsz liczbę użytkowników do jednego (siebie) dla v1.

  Zobowiąż się do dłuższego terminu — ponieś koszt. MVP na wiele tygodni
  jest wykonalne, ale wymaga stałego zaangażowania, ciężkiej pracy przez
  wiele wieczorów lub weekendów oraz tolerancji na okresy, w których
  postęp wydaje się niewidoczny. Większość projektów greenfield, które
  przekraczają swoje pierwsze oszacowanie, umiera nie z powodu samej pracy,
  ale z powodu luki między oczekiwanym a rzeczywistym wysiłkiem.
```

Użyj AskUserQuestion z trzema opcjami:

- **Zmniejsz zakres (Zalecane)** — wybierz to, jeśli powyższy koszt jest nowością; wznowimy ten krok z mniejszym pierwszym przepływem.
- **Zobowiąż się do dłuższego terminu — rozumiem, że będzie to wymagało stałego wysiłku** — wybierz to tylko, jeśli naprawdę przemyślałeś, jak wygląda wielotygodniowe zaangażowanie po godzinach i podchodzisz do tego z otwartymi oczami.
- **Wznów Krok 3 z innym pierwszym przepływem** — wybierz to, jeśli żadna opcja nie pasuje i chcesz ponownie naszkicować MVP od podstaw.

Jeśli użytkownik wybierze "Zobowiąż się do dłuższego terminu":

1. Przechwyć jego szacowane `mvp_weeks` (zapytaj, jeśli nie zostało jeszcze podane).
2. Dołącz linię `## Timeline acknowledgment` pod blokiem budżetu czasowego w shape-notes, która zapisuje: szacowane tygodnie, że użytkownik wyraźnie zaakceptował koszt stałego wysiłku i datę. Format: `Potwierdzono dnia <RRRR-MM-DD>: <N>-tygodniowe MVP wymaga stałego zaangażowania; użytkownik zaakceptował.`
3. Kontynuuj bez dalszego narzekania — potwierdzenie jest bramą, powtarzające się ostrzeżenia nie.

#### Tryb brownfield

Rozpocznij od: "Opisz najmniejszą inkrementalną zmianę, która udowodni, że to ulepszenie działa. Przeprowadź mnie przez to, jak zmienia się doświadczenie użytkownika — co robią inaczej po dostarczeniu tej zmiany?"

Słuchaj. Powtórz jako numerowaną sekwencję delta: "1. użytkownik otwiera [istniejącą funkcję], 2. teraz widzi [nową rzecz], 3. może [nowa możliwość]…"

Następnie zadaj dwa pytania specyficzne dla brownfield:

- "Jaki jest zasięg rażenia tej zmiany? Które istniejące funkcje, integracje lub przepływy danych mogą się zepsuć?" (Sokrates: "Co istniejący użytkownik zauważyłby najpierw, gdyby ta zmiana poszła źle?")
- "Gdybyś miał trzy tygodnie pracy po godzinach, czy możesz dostarczyć tę zmianę?" (ta sama dyscyplina czasowa co w greenfield)

**Powierzchnia kosztów zakresu**: ta sama logika co w greenfield, ale przeformułowana:

```
Ta zmiana jest większa niż to, co zazwyczaj jest dostarczane w trzy tygodnie
pracy po godzinach. Pułapka brownfield polega na rozpoczęciu dużej zmiany w
istniejącym systemie i pozostawieniu jej niedokończonej — częściowo
zmodyfikowany kod jest gorszy niż oryginalny. Dwie ścieżki:

  Zmniejsz zakres — znajdź najmniejszy fragment, który udowodni, że zmiana
  działa. Typowe posunięcia:
    - Ogranicz do jednego przypadku użycia / jednej roli użytkownika na
      początku.
    - Zachowaj istniejące zachowanie jako awaryjne; dodaj nową ścieżkę
      obok.
    - Odrzuć [zidentyfikowaną drogą integrację] dla v1.

  Zobowiąż się do dłuższego terminu — tak samo jak w greenfield: stały
  wysiłek, zaakceptowany.
```

Te same opcje AskUserQuestion co w greenfield.

#### Oba tryby

Gdy przepływ jest zablokowany, przechwyć go jako kryterium sukcesu `### Primary` (działający przepływ = produkt/zmiana zadziałała). Zapytaj jeszcze raz o `### Secondary` (1 miły dodatek) i `### Guardrails` (1-2 rzeczy, które nie mogą się zepsuć — prywatność, minimalna wydajność, UX). W przypadku brownfield, guardrails powinny wyraźnie obejmować istniejące zachowanie, które musi zostać zachowane.

Ustaw `timeline_budget.mvp_weeks` (greenfield) lub `timeline_budget.delivery_weeks` (brownfield) w szkielecie frontmatter na liczbę podaną przez użytkownika — 1, jeśli zakres został zmniejszony, w przeciwnym razie na potwierdzone oszacowanie.

Zapisz blok `## Success Criteria`. Zwiększ `checkpoint.current_phase: 4` i dodaj `3` do `checkpoint.phases_completed`.

### Krok 4: Wymagania funkcjonalne i historie użytkowników

Ta faza tworzy sekcje `## Functional Requirements` i `## User Stories`.

#### Tryb greenfield

Rozpocznij od: "Teraz przejdźmy do konkretów. Z naszkicowanego przepływu MVP, co aktor musi *być w stanie* zrobić? Wymień możliwości — sformatuję je jako FR."

Przechwyć każdą możliwość jako pojedynczą linię FR zgodnie z formatem schematu:

```
- FR-NNN: [Aktor] może [możliwość]. Priorytet: must-have | nice-to-have
```

`NNN` to trzycyfrowa liczba z wiodącymi zerami, zaczynająca się od `001`. Domyślny `Priorytet: must-have` dla wszystkiego w przepływie MVP; zapytaj wyraźnie, jeśli jakakolwiek możliwość jest `nice-to-have`.

#### Tryb brownfield

Rozpocznij od: "Teraz przejdźmy do konkretów. Z opisanej zmiany, jakie możliwości są dodawane, modyfikowane lub zachowywane? Wymień je — sformatuję je jako FR z kategorią zmiany."

Przechwyć każdą możliwość z dodatkowym tagiem `Change:`:

```
- FR-NNN: [Aktor] może [możliwość]. Priorytet: must-have | nice-to-have. Zmiana: new | modified | preserved
```

- `new` — możliwość, która nie istnieje w obecnym systemie
- `modified` — istniejąca możliwość, której zachowanie się zmienia
- `preserved` — istniejąca możliwość, która musi nadal działać bez zmian (defensywne FR — wyraźnie zaznacza zachowanie)

Poproś użytkownika, aby pomyślał o zachowanych FR: "Które istniejące możliwości muszą wyraźnie przetrwać tę zmianę? Wyraźne zaznaczenie zachowania zapobiega przypadkowym uszkodzeniom." Jeśli użytkownik zidentyfikuje zachowane FR, przechwyć je — staną się one FR-ami ochronnymi dla PRD brownfield.

#### Oba tryby

Grupuj tematycznie z podnagłówkami `###`, jeśli liczba FR przekracza ~6 (np. `### Uwierzytelnianie`, `### Dopasowywanie przepisów`, `### Trwałość`).

Po przechwyceniu FR, poproś użytkownika o przetłumaczenie co najmniej **głównej ścieżki przepływu MVP** (greenfield) lub **głównej ścieżki zmiany** (brownfield) na historię użytkownika `### US-01:` z Given/When/Then zgodnie ze schematem. Każda dodatkowa historia użytkownika jest opcjonalna, ale zalecana dla każdego FR, które ma nieoczywiste kryteria akceptacji.

Zaktualizuj `checkpoint.frs_drafted` do liczby wpisów FR-NNN.

Zwiększ `checkpoint.current_phase: 4.5` i przejdź bezpośrednio do rundy Sokratesa (NIE oznaczaj fazy 4 jako ukończonej w `phases_completed`, dopóki runda Sokratesa nie zapisze z powrotem).

### Krok 4.5: Runda wyzwań Sokratesa

Jest to dedykowana runda wsadowa — dokładnie jedno wyzwanie na każde FR przechwycone w Kroku 4, ani więcej, ani mniej.

Dla każdego FR-NNN w kolejności dokumentu, zapytaj:

```
FR-NNN: [Aktor] może [możliwość]. Priorytet: ...
Co musiałoby być prawdą, aby to FR było błędne — tzn. aby jego dostarczenie
zaszkodziło produktowi zamiast mu pomóc? LUB: jaki jest najsilniejszy
kontrargument przeciwko włączeniu tego do MVP?
```

Użyj AskUserQuestion dla każdego FR z 2-4 opcjami sformułowanymi jako wiarygodne kontrargumenty (zaczerpnięte z domeny FR — nie ogólne). Zawsze dołącz opcję "Brak kontrargumentu; pozostaje tak, jak napisano" jako OSTATNIĄ opcję (nie pierwszą), aby pytanie zmuszało użytkownika do rozważenia wyzwania przed jego odrzuceniem.

Przechwyć każdą odpowiedź użytkownika jako blok cytatu `> Socrates:` pod odpowiednim FR w `shape-notes.md`:

```
- FR-001: Użytkownik może zapisać przepis do ulubionych. Priorytet: must-have
  > Sokrates: Rozważono kontrargument: "ulubione duplikują listę przepisów,
  > jeśli przepisów jest już niewiele." Rozwiązanie: zachowano; ulubione są
  > między sesjami, główna lista jest na lodówkę.
```

Jeśli runda Sokratesa skłoni użytkownika do zmiany FR (np. podzielenia na dwa, obniżenia priorytetu do nice-to-have, całkowitego usunięcia), zaktualizuj linię FR na miejscu i ponownie wyemituj `checkpoint.frs_drafted`.

Gdy każde FR ma blok cytatu Sokratesa, dodaj `4` do `checkpoint.phases_completed`, zwiększ `checkpoint.current_phase: 5`.

### Krok 5: Logika biznesowa i właściwości jakościowe

Ta faza tworzy sekcje `## Business Logic` i `## Non-Functional Requirements`. **Brownfield** tworzy również sekcję `## Constraints & Preserved Behavior`. Encje i pola celowo NIE są przechwytywane jako oddzielna sekcja — wyłaniają się z FR i Historii Użytkowników (odpowiednio Kroki 4 i 4 tej umiejętności) i są przypinane podczas dalszego wyboru stosu / planowania implementacji.

#### Tryb greenfield

Rozpocznij od: "Opisz regułę działania w JEDNYM zdaniu — decyzję domenową, którą podejmuje Twoja aplikacja, odróżniającą ją od ogólnej listy CRUD."

Jeśli użytkownik potrafi sformułować jednolinijkową regułę, przechwyć ją jako pierwszą linię `## Business Logic`. Następnie poproś o ≤ 3 akapity wyjaśniające, jakie dane wejściowe reguła konsumuje (jako dane wejściowe widoczne dla użytkownika, a nie komponenty systemowe), jaki jest jej wynik i jak użytkownik napotyka ją w przepływie produktu. NIE nazywaj komponentów ani aktorów, którzy wykonują obliczenia — to są dalsze wybory architektoniczne. Sformułuj regułę tak, jakby implementacja była nieznana.

**Wykrywanie antywzorca pustego CRUD**: jeśli "logika biznesowa" użytkownika sprowadza się do "użytkownicy mogą dodawać, przeglądać, aktualizować i usuwać rekordy" bez żadnej reguły, którą sama aplikacja stosuje (brak rekomendacji, priorytetyzacji, klasyfikacji, walidacji, punktacji, przepływu pracy, obliczeń), wyraźnie to zaznacz:

```
To, co opisałeś, to lista CRUD — a to znany antywzorzec greenfield.
CRUD bez decyzji domenowej oznacza, że aplikacja nie dostarcza wartości,
której użytkownik nie mógłby uzyskać z arkusza kalkulacyjnego lub pliku
notatek. Produkt jest pusty.

Prawdziwa reguła domenowa odpowiada na pytanie "co aplikacja decyduje za
użytkownika?". Typowe formy:

  - Rekomendacja:  aplikacja sugeruje elementy na podstawie stanu użytkownika
  - Priorytetyzacja: aplikacja porządkuje elementy według domniemanej
                    pilności / ważności
  - Klasyfikacja:  aplikacja taguje elementy według kategorii / sentymentu /
                   jakości
  - Walidacja:     aplikacja sprawdza elementy pod kątem reguły domenowej i
                   sygnalizuje problemy
  - Punktacja:     aplikacja ocenia elementy, aby użytkownik mógł je
                   porównać
  - Przepływ pracy: aplikacja przenosi elementy przez stany z regułami
                    przejścia
  - Obliczenia:    aplikacja oblicza wartość na podstawie danych
                   wejściowych dostarczonych przez użytkownika

Jaką regułę stosuje TWOJA aplikacja?
```

Użyj AskUserQuestion z powyższymi kształtami reguł jako opcjami wielokrotnego wyboru (plus "Chcę dodać regułę — daj mi chwilę do namysłu" i "I tak buduję to jako czysty CRUD — zapisz to"). Jeśli użytkownik wybierze regułę, wróć do jednolinijkowego pytania. Jeśli zaakceptuje etykietę pustego CRUD, zapisz ją jako `# TODO: reguła domenowa — patrz Otwarte Pytania` zgodnie ze schematem i dodaj wpis do bieżącego bloku `## Open Questions` w shape-notes.md.

#### Tryb brownfield

Rozpocznij od: "Jaka jest istniejąca reguła domenowa — decyzja, którą Twój obecny system podejmuje za użytkownika? Następnie: czy ta zmiana dodaje nową regułę, modyfikuje istniejącą, czy jest tylko infrastrukturalna (brak zmiany reguły)?"

Słuchaj. Sklasyfikuj odpowiedź:

- **Dodaje nową regułę domenową** — przechwyć jak w greenfield (jednolinijkowa reguła dla nowej możliwości).
- **Modyfikuje istniejącą regułę** — najpierw przechwyć obecną regułę ("System obecnie robi X"), następnie zmianę ("Ta zmiana modyfikuje ją, aby robiła Y"). Obie linie trafiają do `## Business Logic`.
- **Tylko infrastrukturalna** — zmiana nie dotyka logiki domenowej (np. migracja, poprawa wydajności, integracja). Zapisz: "Brak zmiany logiki domenowej. Jest to zmiana infrastrukturalna/techniczna." Pomiń sprawdzanie pustego CRUD — nie dotyczy to pracy infrastrukturalnej brownfield.

Po logice biznesowej, przechwyć ograniczenia i zachowane zachowanie jako `## Constraints & Preserved Behavior`:

- "Jakie istniejące integracje, API lub kontrakty danych musi respektować ta zmiana?"
- "Czy wiążą się z tym migracje danych? Co dzieje się z istniejącymi danymi?"
- "Jakie gwarancje kompatybilności wstecznej są potrzebne?"

#### Oba tryby

Po zablokowaniu logiki biznesowej (lub zarejestrowaniu jej braku), zadaj jedną rundę pytań dotyczących wymagań niefunkcjonalnych: "Czy istnieją cechy, które aplikacja musi spełniać na swojej zewnętrznej granicy — co użytkownik, operator lub regulator mógłby zmierzyć bez inspekcji implementacji? Pomyśl o: czasie odpowiedzi, jak postrzega go użytkownik, zobowiązaniach dotyczących prywatności, dostępności, wsparciu przeglądarek/urządzeń, oknach retencji." Dla brownfield, dodaj: "Czy istnieją istniejące, obserwowalne z zewnątrz zachowania lub SLA, które nie mogą ulec pogorszeniu?"

Przechwyć jako punkty `## Non-Functional Requirements` zgodnie ze schematem. Każde NFR łączy właściwość z mierzalnym celem (lub binarnym zobowiązaniem) i unika nazywania mechanizmu, strategii egzekwowania, miejsca uruchomienia lub udogodnień UI — to są dalsze wybory. Jeśli użytkownik sformułuje NFR mechanicznie ("limitowanie szybkości na IP", "spinner podczas ładowania", "zapytanie Postgres < 50ms"), odzwierciedl to w formie obserwowalnej z zewnątrz przed przechwyceniem ("uwierzytelnianie jest odporne na ataki credential stuffing bez blokowania użytkowników z błędami wprowadzania"; "ciągła widoczna informacja zwrotna podczas każdej operacji > 2s"; "postrzegana przez użytkownika odpowiedź < 800ms p95").

NIE pytaj "jakie encje użytkownik tworzy, odczytuje, aktualizuje lub usuwa?" — encje nie są problemem PRD. Rzeczowniki, którymi manipuluje produkt, pojawiają się w FR (Krok 4) i Historiach Użytkowników. Jeśli pytanie na poziomie pola wydaje się konieczne do wyjaśnienia reguły biznesowej, skieruj je do `## Open Questions` w celu dalszego rozwiązania, a nie do przechwytywania modelu danych.

Dołącz `5` do `checkpoint.phases_completed`, zwiększ `checkpoint.current_phase: 6`.

### Krok 6: Ramowanie produktu

Ta faza tworzy sekcję `## Non-Goals` oraz pola frontmatter na poziomie produktu (`product_type`, `target_scale`, `timeline_budget`).

Frontmatter PRD dotyczy tylko poziomu produktu. Kwestie związane ze stosem — skład zespołu, preferencje językowe, listy technologii do unikania, tryb/region/budżet wdrożenia, kształt potoku CI/CD — oraz zobowiązania architektoniczne — decyzje implementacyjne, strategia testowania, plan wdrożenia — NIE są częścią PRD. Są one zbierane po `/10x-prd`, po zablokowaniu kształtu produktu. Zadawanie ich teraz zachęca użytkownika do nadmiernego zobowiązania przed wyborem stosu, a odpowiedzi zazwyczaj wymagają ponownego rozważenia po wybraniu stosu.

#### Tryb greenfield

Rozpocznij od: "Ostatnia faza — ustalmy kilka szczegółów ramowania, a następnie sprecyzujmy, czego ten MVP wyraźnie NIE robi. Nie wybieramy tutaj frameworków, wdrożenia ani planów testów/CI — to nastąpi później, gdy stos zostanie wybrany."

Zadaj użytkownikowi te trzy krótkie pytania ramujące, PO JEDNYM (oddzielne AskUserQuestion dla każdego pytania, a nie pojedynczy blok z wieloma pytaniami). Sformułuj każde pytanie prostym językiem, jak sugerowano poniżej — NIE drukuj nazw pól, takich jak `product_type` lub `target_scale`, w tekście pytania ani w etykietach opcji. Wewnętrznie mapuj odpowiedź użytkownika na podstawowe pole frontmatter.

1. **Jaki rodzaj rzeczy budujesz?**
   - Opcje: "Strona internetowa lub aplikacja webowa" / "API lub usługa backendowa" / "Narzędzie wiersza poleceń" / "Aplikacja mobilna" / "Aplikacja desktopowa" / "Biblioteka lub SDK" / "Potok danych" — plus opcja swobodnego tekstu.
   - Mapuj wybraną etykietę na `product_type`: web-app / api / cli / mobile / desktop / library / data-pipeline / other.

2. **Z grubsza, ile osób będzie tego używać, gdy będzie już działać?**
   - Opcje: "Tylko ja, lub garstka" / "Dziesiątki do stu" / "Do dziesięciu tysięcy" / "Więcej niż dziesięć tysięcy".
   - Mapuj wybraną etykietę na `target_scale.users`: small / medium / large / enterprise.
   - Po odpowiedzi, zadaj krótkie pytanie Sokratesa: "Jak zmieniłaby się twoja reguła domenowa przy 100-krotnie większej skali?" Przechwyć wszelkie spostrzeżenia jako jednolinijkową notatkę w sekcji Vision w shape-notes, jeśli pojawi się coś nowego.

3. **Dwa szybkie pytania dotyczące terminów.**
   - Zapytaj w jednej rundzie: "Czy masz twardy termin, do którego dążysz? Jeśli tak, jaka data — jeśli nie, po prostu powiedz 'bez terminu'." (Mapuj na `timeline_budget.hard_deadline`: data ISO lub `null`.)
   - Następnie: "Czy będzie to praca po godzinach, czy część twojej pracy dziennej?" (Mapuj na `timeline_budget.after_hours_only`: bool.)
   - `timeline_budget.mvp_weeks` zostało już zablokowane w Kroku 3 — nie pytaj ponownie.

#### Tryb brownfield

Rozpocznij od: "Ostatnia faza — ustalmy kilka szczegółów ramowania i czego ta zmiana wyraźnie NIE robi. Nie zmieniamy tutaj stosu — te decyzje zapadają później."

Dla brownfield, pytania dotyczące ramowania produktu stają się bramkami "czy to się zmienia?" tak/nie plus przechwytywanie ograniczeń:

1. **Czy zmienia się typ produktu?**
   - Jeśli istniejący system to aplikacja webowa i ta zmiana tego nie zmienia → zapisz `product_type` bez zmian z notatką: `Brak zmian — istniejący [typ].`
   - Jeśli zmiana wprowadza nową powierzchnię produktu (np. dodanie CLI do aplikacji webowej) → przechwyć nowy `product_type` obok istniejącego.

2. **Czy zmienia się baza użytkowników?**
   - Ten sam wzorzec: zapisz obecny `target_scale` i czy zmiana na niego wpływa. Jeśli zmiana otwiera system na nowych użytkowników lub inną skalę, przechwyć deltę.

3. **Terminy** — te same dwa pytania co w greenfield (`hard_deadline`, `after_hours_only`). `timeline_budget.delivery_weeks` zostało już zablokowane w Kroku 3.

Po ramowaniu, dodaj: "Jakie ograniczenia narzuca istniejący system na tę zmianę? Pomyśl o: oknach wdrożenia, istniejących wymaganiach CI/CD, kompatybilności wstecznej z obecnymi konsumentami API, istniejącym monitoringu/alertowaniu." Przechwyć w `## Constraints & Preserved Behavior` (rozszerz sekcję utworzoną w Kroku 5).

#### Oba tryby

Po zablokowaniu ramowania produktu, uruchom **jedną** rundę wielokrotnego wyboru Non-Goals. Kształt to lista do unikania z wielokrotnym wyborem — ale ukierunkowana na unikanie *zakresu* (możliwości, których MVP nie zbuduje / zmiana nie dotknie, wymiary jakości, do których nie będzie dążyć), a nie unikanie technologii. Zapytaj:

```
Czego ten [MVP/zmiana] wyraźnie NIE robi? Wybierz wszystko, co powinno być
wykluczone *teraz*, aby nie wkradło się później. Zarówno niefunkcjonalne
cele (możliwości, których nie zbudujemy/zmienimy), jak i niefunkcjonalne
cele (wymiary jakości, do których nie będziemy dążyć) należą tutaj.
```

Użyj AskUserQuestion z `multiSelect: true` i 3-5 opcjami zaczerpniętymi z domeny użytkownika — NIE ogólnymi. Przykłady (generuj ponownie dla każdego projektu):

- "Unikaj: budowania własnego [algorytmu domenowego — np. rekomendacji, planowania, punktacji]" — silne unikanie zakresu; wymuś decyzję kupić-czy-zbudować teraz.
- "Unikaj: [drogiego elementu infrastruktury — np. lokalnego LLM, synchronizacji w czasie rzeczywistym, wielu regionów]" — silne unikanie zakresu; brak kształtuje przepływ danych.
- "Unikaj: [drugorzędnej persony — np. współdzielonych talii, przestrzeni roboczych zespołu, funkcji administracyjnych]" — wyraźne zablokowanie pojedynczego najemcy.
- "Unikaj: [wymiaru jakości — np. offline-first, pełne WCAG-AA, opóźnienie poniżej 100 ms]" — wyraźny niefunkcjonalny cel.
- Dla brownfield: "Unikaj: [zmiany istniejącego systemu — np. migracji bazy danych, przepisywania uwierzytelniania, zmiany celu wdrożenia]" — wyraźny niefunkcjonalny cel istniejącego systemu.
- "Inne (ty mi powiedz)" — przechwytywanie swobodnego tekstu.

Dołącz wybrane elementy do `## Non-Goals` zgodnie ze schematem (jednolinijkowe uzasadnienie dla każdego). Jeśli pojawią się unikania technologii (np. "unikaj: PHP", "unikaj: monorepo"), NIE dodawaj ich do `## Non-Goals` — przechwyć je w treści shape-notes pod blokiem `## Forward: tech-stack` (informacyjne, nie część schematu PRD), aby następny krok łańcucha mógł je podjąć.

**NIE** pytaj o decyzje implementacyjne, strategię testowania ani plan wdrożenia i CI/CD w tej umiejętności. Te kwestie znajdują się po wyborze stosu / ocenie stosu. Jeśli użytkownik dobrowolnie poda treści o takim kształcie, przechwyć je w shape-notes pod `## Forward: technical-roadmap` (informacyjne; nie sekcja PRD), aby dalsza umiejętność mogła je podjąć.

Dołącz `6` do `checkpoint.phases_completed`, zwiększ `checkpoint.current_phase: 7`. Przejdź bezpośrednio do Kroku 7.

### Krok 7: Zamknięcie miękkiej bramki kontrolnej

Ta faza uruchamia pasek jakości dla wszystkiego, co zostało przechwycone. Jest to **miękka bramka**: ostrzega, ale pozwala na nadpisanie.

Odczytaj bieżący `shape-notes.md` i sprawdź każdy z poniższych elementów. Dla każdego oznacz `obecny` lub `brakujący/słaby`:

1. **Kontrola dostępu** — blok `## Access Control` istnieje z nietrywialną wartością (nie tylko pusty placeholder).
2. **Logika biznesowa (reguła jednolinijkowa)** — `## Business Logic` zaczyna się od pojedynczego zdania deklaratywnego (nie akapitu, nie "TBD"). Dla zmian infrastrukturalnych brownfield, "Brak zmiany logiki domenowej" jest ważne.
3. **Artefakty projektu** — sam `shape-notes.md` istnieje z prawidłowym punktem kontrolnym frontmatter. (To jest zawsze obecne w tym momencie.)
4. **Potwierdzenie kosztów czasowych** — albo `timeline_budget.mvp_weeks` / `delivery_weeks` ≤ 3, ALBO blok `## Timeline acknowledgment` istnieje w shape-notes, zapisujący, że użytkownik zaakceptował koszt stałego wysiłku w Kroku 3. Dłuższe terminy są ważne; bramka polega na tym, że koszt został przedstawiony i zaakceptowany, a nie na tym, że termin jest krótki.
5. **Non-Goals** — blok `## Non-Goals` istnieje z co najmniej jednym wpisem.
6. **Zachowane zachowanie** *(tylko brownfield)* — blok `## Constraints & Preserved Behavior` istnieje i wyraźnie nazywa, co nie może się zepsuć. Pomiń to sprawdzenie dla sesji greenfield.

NIE sprawdzaj `## Testing Strategy`, `## Deployment & CI/CD` ani `## Implementation Decisions` — nie są one częścią schematu PRD. Znajdują się one po wyborze stosu / ocenie stosu, a nie w PRD.

Wydrukuj tabelę wyników:

```
═══════════════════════════════════════════════════════════
  KONTROLA JAKOŚCI
═══════════════════════════════════════════════════════════

  Kontrola dostępu:           [obecny | brakujący — opisz]
  Logika biznesowa:           [...]
  Artefakty projektu:        obecny
  Potwierdzenie kosztów czasowych: [obecny | brakujący — opisz]
  Non-Goals:                [...]
  Zachowane zachowanie:       [obecny | brakujący — opisz | n/a (greenfield)]

═══════════════════════════════════════════════════════════
```

Dla każdego `brakującego/słabego`, **wymień go z nazwy** z jednolinijkową konsekwencją: "Logika biznesowa: nie uchwycona jako jednolinijkowa reguła — twoje PRD będzie puste bez decyzji domenowej." Ogólne ostrzeżenia "twoje PRD ma luki" unieważniają bramkę; nie pisz ich.

Następnie zapytaj:

AskUserQuestion:
- question: "Jak chcesz postąpić?"
  header: "Kontrola"
  options:
  - label: "Usuń luki teraz"
    description: "Ponownie wejdź w odpowiednią fazę, aby uzupełnić brakujące elementy. Zalecane, jeśli brakuje wielu elementów."
  - label: "Zaakceptuj i zakończ"
    description: "Kontynuuj pomimo luk. Zostaną one zarejestrowane jako ostrzeżenia w punkcie kontrolnym i przedstawione w Otwartych Pytaniach /10x-prd."
  - label: "Wznów fazę [N]"
    description: "Wróć do konkretnej fazy i odbuduj od tego miejsca."
  multiSelect: false

W przypadku "Usuń luki teraz": zapytaj, która luka; wróć do fazy, która ją posiada (Krok 1-6); uruchom ponownie tylko tę fazę; następnie wróć do Kroku 7.

W przypadku "Zaakceptuj i zakończ": ustaw `checkpoint.quality_check_status: warned` (jeśli pozostały jakieś luki) lub `accepted` (jeśli wszystkie elementy są obecne — 6 dla greenfield, 7 dla brownfield). Dołącz sekcję `## Quality cross-check` do `shape-notes.md`, wymieniając każdą lukę z nazwy z jej jednolinijkową konsekwencją — `/10x-prd` odzwierciedla je w `## Open Questions`.

W przypadku "Wznów fazę [N]": przejdź do tej fazy. NIE usuwaj wcześniejszej treści; pozwól fazie nadpisać własne sekcje.

Dołącz `7` do `checkpoint.phases_completed`, zwiększ `checkpoint.current_phase: 8`. Przejdź do Kroku 8.

### Krok 8: Przekazanie

Ostateczny zapis `shape-notes.md`:

- Potwierdź, że `checkpoint.quality_check_status` to `warned` lub `accepted` (nigdy `pending` w tym momencie).
- Zaktualizuj `updated:` na dzisiejszą datę w frontmatter.
- Ponownie zweryfikuj względem odniesienia do schematu: dla greenfield, treść powinna przewidywać 10 sekcji PRD w kolejności wymaganej przez schemat; dla brownfield, 11 sekcji PRD brownfield. Frontmatter powinien zawierać pełny blok `checkpoint:` plus `context_type`. Wszelkie treści wybiegające w przyszłość przechwycone w Kroku 6 pozostają w swoim bloku `## Forward: ...` — NIE są włączane do sekcji mapowanych na PRD.

Następnie skopiuj polecenie następnego kroku do schowka i ogłoś:

```bash
echo -n "/10x-prd" | pbcopy 2>/dev/null || echo -n "/10x-prd" | clip.exe 2>/dev/null || echo -n "/10x-prd" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-prd"
```

Wydrukuj:

```
═══════════════════════════════════════════════════════════
  KSZTAŁTOWANIE ZAKOŃCZONE
═══════════════════════════════════════════════════════════

  Projekt:                [nazwa projektu]
  Typ kontekstu:           [greenfield | brownfield]
  Przechwycone fazy:        1, 2, 3, 4, 5, 6
  Sporządzone FR:            [liczba]
  Kontrola jakości:          [ostrzeżenie | zaakceptowane]

  ► Notatki:  context/foundation/shape-notes.md
  ► Następny:   /10x-prd  (✓ skopiowano do schowka)

  Po /10x-prd, następny krok łańcucha podejmie:
    Greenfield → wybór stosu technologicznego, następnie bootstrap
    Brownfield → ocena stosu, następnie kontrola stanu
  Żaden z nich nie należy do samego PRD.
═══════════════════════════════════════════════════════════
```

ZATRZYMAJ. Nie łącz się automatycznie z `/10x-prd` — użytkownik uruchamia go, gdy jest gotowy.

## Krytyczne zabezpieczenia

1. **Facylitator, nie generator.** Umiejętność nigdy nie pisze treści domenowych, których użytkownik nie powiedział. Jeśli sekcja potrzebuje wartości, której użytkownik nie podał, zapytaj. Wyjątkiem jest formatowanie mechaniczne (numeracja FR-NNN, szkielety nagłówków schematu, klucze frontmatter).

2. **Schemat jest umową.** Kształt `shape-notes.md` i osadzony szkielet dla przyszłego PRD są dyktowane przez `references/prd-schema.md`. Sprawdzaj ponownie przy każdym zapisie punktu kontrolnego. Jeśli schemat zmieni się w trakcie implementacji, zaktualizuj treść tej umiejętności, aby pasowała — dryf jest trybem awarii.

3. **Otwartość stosu jest wiążąca.** Nigdy nie pytaj o, nie rekomenduj ani nie zobowiązuj się do frameworka, bazy danych, rodziny języków ani konkretnej platformy. PRD przechwytuje tylko priorytety na poziomie produktu (`product_type`, `target_scale`, `timeline_budget`); skład zespołu, preferencje językowe, wdrożenie i kształt CI/CD są zbierane po `/10x-prd`. Jeśli użytkownik dobrowolnie poda treści związane ze stosem, przechwyć je w treści shape-notes pod `## Forward: tech-stack` — nie w sekcjach mapowanych na PRD.

4. **Antywzorce są nazywane, a nie ogólnie.** Wykrywanie pustego CRUD nazywa brakujące kształty reguł i prosi użytkownika o wybranie jednego. Wykrywanie zbyt dużego MVP nazywa drogie elementy i oferuje konkretne ruchy zmniejszające zakres. Ostrzeżenia "Twój pomysł ma problemy" unieważniają bramkę.

5. **Miękka bramka, nie twarda bramka.** Końcowa kontrola KRZYCZY, ale pozwala użytkownikowi nadpisać każdą lukę. Ścieżki nadpisania są rejestrowane w punkcie kontrolnym jako `quality_check_status: warned` i przedstawiane w `## Open Questions` w `/10x-prd`. Odmowa zakończenia nie wchodzi w zakres.

6. **Zachowanie świadome trybu.** Umiejętność automatycznie wykrywa typ kontekstu (greenfield vs brownfield) na podstawie znaczników projektu w bieżącym katalogu roboczym i odpowiednio dostosowuje wszystkie sześć faz odkrywania. Dla brownfield, pętla odkrywania zmienia się z "co budujesz od podstaw?" na "co istnieje, co się zmienia, co musi zostać zachowane?". Jeśli użytkownik wywoła tę umiejętność dla problemu o małym zakresie w istniejącej bazie kodu (pojedynczy błąd, szybki refaktoring), zasugeruj zamiast tego `/10x-frame` — `/10x-shape` jest przeznaczony do zmian, które wymagają pełnego PRD.

7. **Tylko język uniwersalny.** Brak odniesień do 10xDevs / kohorty / certyfikacji w jakimkolwiek wyniku skierowanym do użytkownika lub w jakimkolwiek artefakcie zapisanym na dysku. Mechanika tutaj to uniwersalne wskaźniki dobrze zdefiniowanego projektu; kontekst persony, który je motywował, znajduje się w folderze zmian, a nie w dostarczonej umiejętności.

8. **Wznowienie zachowuje wcześniejszą pracę.** Po wznowieniu, ukończone fazy są PODSUMOWYWANE w 1-2 zdaniach każda, nigdy nie uruchamiane ponownie. Wcześniejsze decyzje użytkownika są kluczowe; ponowne ich odtwarzanie frustruje użytkownika i grozi sprzecznością z wcześniejszymi przechwyceniami.

## Uwagi

- Jest to umiejętność **kształtowania**. Wynikiem jest `shape-notes.md`, a nie `prd.md`. `/10x-prd` jest generatorem dokumentów.
- Odniesienie do schematu (`references/prd-schema.md`) jest jedynym źródłem prawdy. Każda nazwa pola, nazwa sekcji lub klucz punktu kontrolnego, do którego odwołuje się ta treść, MUSI istnieć w dokumencie schematu — jeśli nie, najpierw napraw dokument schematu.
- Dla greenfield, 10 sekcji PRD jest przewidywanych w kolejności treści `shape-notes.md`, aby `/10x-prd` mógł je czysto mapować. Dla brownfield, zamiast tego przewidywanych jest 11 sekcji PRD brownfield (patrz `references/prd-schema.md`). Nazwy są dokładnie takie same. Treści wybiegające w przyszłość (pozostałości po wyborze stosu technologicznego / ocenie stosu; przyszłe kwestie mapy drogowej technicznej) znajdują się w oddzielnych blokach `## Forward to ...` w treści shape-notes i NIE mapują się na PRD.
- Jeśli użytkownik naciska na pominięcie fazy ("po prostu wygeneruj PRD"), wyjaśnij konsekwencje: brakujące fazy tworzą puste sekcje PRD. Następnie zaoferuj pominięcie z wyraźnie określonym kosztem. Wybór należy do nich.
