---
name: 10x-impl-review
description: Review implementation against plan for drift, dangerous decisions, and pattern compliance
argument-hint: <plan-path> [phase N] | <saved-review-path>
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---

# Przegląd implementacji

Porównaj rzeczywistą pracę implementacyjną z oryginalnym planem, aby wychwycić odchylenia, niebezpieczne decyzje, naruszenia architektury i niewłaściwe użycie wzorców, zanim się one skumulują.

Dwie granularności:
- **Przegląd fazy**: po pojedynczej fazie — szybki, skoncentrowany na zmianach w tej fazie
- **Pełny przegląd planu**: po wszystkich fazach — kompleksowe sprawdzenie

Dwa tryby:
- **Świeży przegląd**: analiza → ustalenia → interaktywne sortowanie
- **Wznowienie sortowania**: załaduj zapisany raport i przejdź do sortowania poszczególnych problemów

## Rozwiązanie wejścia

1. Argument wskazuje na zapisany plik przeglądu (zawiera `<!-- IMPL-REVIEW-REPORT -->`) → **wznowienie sortowania** (przejdź do kroku 5)
2. Argument to `<change-id>` i istnieje `context/changes/<change-id>/plan.md` → świeży przegląd tego planu
3. Podano ścieżkę do planu (np. `@context/changes/<change-id>/plan.md`) → świeży przegląd tego planu
4. Podano numer fazy (np. "phase 3") → przegląd tylko tej fazy
5. Brak argumentu → wylicz `context/changes/*/change.md`; wybierz ostatnio `updated` zmianę ze `status` w `{implementing, implemented}` i potwierdź za pomocą AskUserQuestion

Jeśli rozwiązana ścieżka planu zaczyna się od `context/archive/`, odmów: wydrukuj "This change is archived. Reviews are not appended to archived plans." i ZATRZYMAJ.

## Krok 1: Załaduj plan i wykryj zakres zmian

TaskCreate: "Implementation Review" / activeForm "Loading context"

1. **Wczytaj cały plik planu** — bez limitu/offsetu.
2. **Wczytaj `context/foundation/lessons.md` jeśli istnieje** i użyj zaakceptowanych reguł jako priorytetów podczas skanowania w poszukiwaniu ustaleń — odchylenie, które narusza znaną, powtarzającą się regułę, jest silniejszym sygnałem niż ogólna uwaga stylistyczna.
3. **Wczytaj kanoniczny stan z sekcji `## Progress` planu** (patrz `references/progress-format.md`): ukończenie = `count([x]) / count([ ] + [x])`; bieżąca faza = faza zawierająca pierwszy `- [ ]` (lub ostatnia faza, jeśli wszystkie są ukończone). Wczytaj również sąsiedni `change.md` dla `status` i `updated`.
4. **Zakres**: żądana konkretna faza → tylko ta faza; w przeciwnym razie wszystkie fazy, których pola wyboru postępu są w pełni `[x]` (tj. ukończone fazy).
5. **Wyodrębnij** z przeglądanych faz: ścieżki plików z "Changes Required", decyzje architektoniczne, kryteria sukcesu (punkty automatyczne/ręczne w blokach faz + ich lustrzane odbicie `[ ]`/`[x]` w postępie) oraz listę "What We're NOT Doing" (bariery zakresu).
6. **Wykrywanie zakresu Git** — co faktycznie się zmieniło:
   ```bash
   PLAN_DATE="<YYYY-MM-DD from filename>"
   git log --oneline --after="${PLAN_DATE}" -- .
   git diff --name-only $(git log --reverse --after="${PLAN_DATE}" --format="%H" | head -1)^..HEAD 2>/dev/null
   ```
   Jeśli zakres nie może być czysto określony, wróć do commitów, których komunikaty odwołują się do planu/funkcji.

Porównaj listę zmienionych plików z listą plików planu:
- **W planie ORAZ w diffie** → oczekiwana zmiana, zweryfikuj zgodność treści z zamierzeniem
- **W diffie, ale NIE w planie** → nieplanowana zmiana, zbadaj i oznacz
- **W planie, ale NIE w diffie** → potencjalnie brakująca implementacja

Nie wczytuj każdego zmienionego pliku do głównego kontekstu — pozwól pod-agentom wczytać to, czego potrzebują. Główny kontekst powinien zawierać plan i podsumowanie diffa, a nie pełne źródło 20 plików.

## Krok 2: Równoległy przegląd za pomocą pod-agentów

TaskUpdate: activeForm "Gathering evidence"

Uruchom **dwóch** pod-agentów jednocześnie. Każdy otrzymuje ukierunkowany kontekst — nie wrzucaj całego planu do obu.

**Agent 1 — Wykrywanie odchyleń od planu** (`subagent_type: "general-purpose"`)

Daj mu: tekst "Changes Required" dla przeglądanych faz, listę ścieżek plików do odczytania.

Instrukcje: dla każdej zaplanowanej zmiany, przeczytaj rzeczywisty plik i zweryfikuj zgodność implementacji z zamierzeniem. Sprawdź:
- Zmiany zaimplementowane inaczej niż zaplanowano (niezgodność zamiaru, nie formatowania)
- Zaplanowane elementy pominięte bez dokumentacji
- Dodatki nieopisane w planie (rozszerzenie zakresu)

Zgłoś każdy: ścieżkę pliku, co mówił plan, co istnieje, werdykt (MATCH / DRIFT / MISSING / EXTRA).

**Agent 2 — Bezpieczeństwo, jakość i zgodność ze wzorcami** (`subagent_type: "general-purpose"`)

Daj mu: pełną listę zmienionych plików do odczytania, ścieżkę do katalogu głównego projektu.

Instrukcje:

1. **Skanowanie bezpieczeństwa i jakości** na każdym zmienionym pliku. Oznacz:
   - **Bezpieczeństwo**: ryzyka wstrzyknięć (SQL, poleceń, XSS), zakodowane na stałe sekrety, brak autentykacji/autoryzacji na granicach systemu, zbyt liberalne CORS/uprawnienia.
   - **Wydajność**: zapytania N+1, nieograniczone iteracje/rekurencje, brak paginacji, niepotrzebne synchroniczne I/O.
   - **Niezawodność**: brak obsługi błędów na zewnętrznych granicach (wywołania API, I/O plików, DB), warunki wyścigu, wycieki zasobów.
   - **Bezpieczeństwo danych**: destrukcyjne operacje DB bez możliwości wycofania, zmiany schematu bez ścieżki migracji, potencjalna utrata danych.

2. **Zgodność ze wzorcami** — dla każdego zmienionego pliku znajdź 1-2 podobne istniejące pliki i porównaj nazewnictwo, podejście do obsługi błędów, strukturę modułów, importy/eksporty, strukturę testów, wzorce konfiguracji. **Zgłoś tylko istotne niezgodności** (np. nowy moduł używa camelCase, gdzie sąsiednie używają snake_case; nowy punkt końcowy pomija wzorzec middleware autoryzacji, którego używa reszta API). Pomiń trywialne różnice stylistyczne — jeśli kod działa i jest zgodny z planem, drobne formatowanie nie jest ustaleniem.

3. **Dostosuj pracę nad wzorcami do zakresu** — jeśli diff zmienił ≤3 pliki, poświęć minimalny czas na wzorce (niewiele do porównania). Skaluj głębokość wzorców wraz z zakresem zmian.

Zgłoś każde ustalenie z: plikiem, numerem linii, kategorią, ważnością (CRITICAL / WARNING / OBSERVATION), opisem, rekomendacją.

## Krok 3: Zweryfikuj kryteria sukcesu

TaskUpdate: activeForm "Verifying success criteria"

Dla każdej przeglądanej fazy:

**Automatyczne**: uruchom każde polecenie z pól wyboru "Automated Verification" za pomocą Bash. Zapisz polecenie, wynik (pass/fail), rzeczywiste wyjście (obetnij, jeśli jest ogromne).

**Ręczne**: w sekcji `## Progress` sprawdź elementy ręczne jako `- [x]` vs `- [ ]`. Oznacz elementy oznaczone jako ukończone, które nie mają widocznych dowodów w diffie (możliwe "podpisywanie na ślepo"); uznaj niezaznaczone elementy za oczekujące.

## Krok 4: Skompiluj ustalenia i przedstaw raport

TaskUpdate: activeForm "Compiling findings"

Każde ustalenie zawiera:
- **ID**: F1, F2, F3…
- **Ważność**: CRITICAL / WARNING / OBSERVATION (jak źle, jeśli zignorowane)
- **Wpływ**: LOW / MEDIUM / HIGH (ile uwagi wymaga decyzja)
- **Wymiar**: Plan Adherence / Scope Discipline / Safety & Quality / Architecture / Pattern Consistency / Success Criteria
- **Tytuł**: jedna linia
- **Lokalizacja**: `file:line` (lub "N/A" dla brakujących elementów)
- **Szczegóły**: co jest nie tak z dowodami — plan vs. rzeczywistość, lub kod vs. oczekiwania
- **Opcje naprawy**: 1 lub 2 (patrz poniżej)

### Wpływ

Ortogonalny do ważności. CRITICAL z LOW wpływem (oczywista jednowierszowa poprawka) jest tania; WARNING z HIGH wpływem (przebudowa architektury) wymaga starannego przemyślenia.

| Wpływ | Znaczenie |
|---|---|
| 🏃 **NISKI** | Szybka decyzja. Poprawka jest oczywista i wąsko zakrojona. Bezpieczne do grupowania. |
| 🔎 **ŚREDNI** | Warto się zatrzymać. Prawdziwy kompromis lub nietrywialna edycja — pomyśl przed podjęciem decyzji. |
| 🔬 **WYSOKI** | Stawka architektoniczna. Szeroki obszar oddziaływania, strategiczne implikacje lub niejasna najlepsza ścieżka. |

### Opcje naprawy

Domyślnie **jedna** poprawka. Oferuj dwie tylko wtedy, gdy istnieje prawdziwy kompromis, który inteligentny recenzent chciałby rozważyć (np. "załataj miejsce wywołania" vs. "napraw to u źródła"). Jeśli wymyślasz słabą drugą opcję, nie rób tego — przedstaw jedną i przejdź dalej.

**Ustalenia o NISKIM wpływie**: tylko `Fix: [jedna linia]`. Hałas nie jest pomocny, gdy odpowiedź jest oczywista.

**Ustalenia o ŚREDNIM/WYSOKIM wpływie**: każda opcja otrzymuje:
```
[1-zdaniowe podejście] · Siła: [zaleta, najlepiej oparta na dowodach z kodu/planu] · Kompromis: [koszt lub ryzyko] · Pewność: HIGH|MED|LOW — [1-liniowe dlaczego] · Martwy punkt: [czego nie zweryfikowaliśmy, lub "Brak znaczących"]
```

Oferując dwie opcje, oznacz dokładnie jedną `⭐ Recommended`.

### Werdykty wymiarów

PASS / WARNING / FAIL na wymiar:
- **Zgodność z planem** — zaplanowane zmiany zaimplementowane zgodnie z opisem? FAIL w przypadku MISSING lub poważnego DRIFT.
- **Dyscyplina zakresu** — granice "nie robimy" przestrzegane? WARNING, jeśli istnieją dodatkowe zmiany, ale są nieszkodliwe.
- **Bezpieczeństwo i jakość** — bezpieczeństwo, wydajność, niezawodność, bezpieczeństwo danych. FAIL w przypadku każdego ustalenia CRITICAL.
- **Architektura** — granice modułów, kierunek zależności, uzasadnienie abstrakcji. FAIL w przypadku naruszeń.
- **Spójność wzorców** — zgodność z istniejącymi konwencjami. WARNING w przypadku drobnych niespójności.
- **Kryteria sukcesu** — automatyczne testy przechodzą, ręczne testy zaadresowane. FAIL w przypadku automatycznych błędów.

### Ogólny werdykt

- **ZAAKCEPTOWANO** — wszystkie PASS, lub PASS z ≤2 drobnymi ostrzeżeniami
- **WYMAGA UWAGI** — wiele ostrzeżeń lub 1 niekrytyczny FAIL
- **ODRZUCONO** — każdy krytyczny FAIL (bezpieczeństwo, poważne odchylenie, bezpieczeństwo danych, nieudane testy)

Sortuj ustalenia według ważności: CRITICAL → WARNING → OBSERVATION. Ogranicz do 10 — skonsoliduj powiązane ustalenia, jeśli jest ich więcej.

### Format raportu

Zwykły tekst, rysowanie ramek. Wymiary PASS pojawiają się tylko w tabeli werdyktów, nigdy jako ustalenia. Pomiń grupy ważności z zerową liczbą ustaleń.

```
═══════════════════════════════════════════════════════════
  IMPLEMENTATION REVIEW: [Plan Title]
  Scope: Phase [N] of [Total]  |  Date: YYYY-MM-DD
  Findings: [N critical] [N warnings] [N observations]
═══════════════════════════════════════════════════════════

  Plan Adherence        PASS    ✅
  Scope Discipline      WARNING ⚠️   (1 finding)
  Safety & Quality      FAIL    ❌   (1 finding)
  Architecture          PASS    ✅
  Pattern Consistency   WARNING ⚠️   (1 finding)
  Success Criteria      PASS    ✅

  ► Overall: NEEDS ATTENTION

═══════════════════════════════════════════════════════════
  CRITICAL FINDINGS ❌
═══════════════════════════════════════════════════════════

  F1 — SQL injection in auth handler
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ❌ CRITICAL
    Impact:    🔎 MEDIUM — real tradeoff; pause to reason through it
    Dimension: Safety & Quality
    Location:  src/auth/handler.ts:42

    Detail:
    SQL query built with string concatenation. Plan specified
    parameterized queries but implementation uses template literals.

    Fix: Replace the template literal with a parameterized query using
         db.query($1, [value]).
      Strength:   Matches the pattern in src/users/query.ts and removes
                  the injection class entirely.
      Tradeoff:   Minor — one call site, a few-line change.
      Confidence: HIGH — identical pattern used elsewhere in this repo.
      Blind spot: None significant.

═══════════════════════════════════════════════════════════
  WARNING FINDINGS ⚠️
═══════════════════════════════════════════════════════════

  F2 — Unplanned /api/status endpoint
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ⚠️ WARNING
    Impact:    🔬 HIGH — architectural stakes; think carefully before deciding
    Dimension: Scope Discipline
    Location:  src/api/routes.ts:18

    Detail:
    New GET /api/status endpoint not in plan. Functionality is
    related to planned work but extends public API surface.

    Fix A ⭐ Recommended: Document in the plan as an addendum
      Strength:   Preserves the work already done; updates the source of
                  truth before future reviews use the plan as ground truth.
      Tradeoff:   Plan becomes a slightly moving target.
      Confidence: HIGH — this repo's plan updates regularly pick up
                  discovered scope through addenda.
      Blind spot: Stakeholders who reviewed the original scope aren't
                  notified.

    Fix B: Remove and add to follow-up work
      Strength:   Keeps scope discipline strict.
      Tradeoff:   Loses implemented work; another PR needed later.
      Confidence: MEDIUM — depends whether anything already depends on it.
      Blind spot: Haven't checked for callers of /api/status.

  ···

  F3 — camelCase vs. snake_case
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ⚠️ WARNING
    Impact:    🏃 LOW — quick decision; fix is obvious and narrowly scoped
    Dimension: Pattern Consistency
    Location:  src/utils/format.ts

    Detail:
    Uses camelCase (formatDate, parseInput) while existing utils use
    snake_case (format_date, parse_input).

    Fix: Rename exports to snake_case to match src/utils/.

═══════════════════════════════════════════════════════════
```

### Zasady formatowania raportu

- **Linia tytułu ustalenia** zawiera tylko ID i krótki tytuł — nic więcej. Wszystko inne znajduje się poniżej jako oznaczone pola, dzięki czemu każdy wiersz jest krótki i łatwy do zeskanowania.
- **Zawsze łącz ikony ze słowem.** Nigdy nie używaj samej ikony jako jedynego sygnału — `❌ CRITICAL`, a nie tylko `❌`. Dzięki temu raport jest czytelny podczas szybkiego przeglądania i nie zmusza użytkownika do zapamiętywania znaczenia każdej ikony.
- **Wpływ zawsze zawiera swoje jednowierszowe znaczenie** (skopiuj z tabeli Wpływ — "stawka architektoniczna; pomyśl dokładnie przed podjęciem decyzji" / "prawdziwy kompromis; zatrzymaj się, aby to przemyśleć" / "szybka decyzja; poprawka jest oczywista i wąsko zakrojona"). Dzięki temu LOW/MEDIUM/HIGH są samoobjaśniające w miejscu użycia, zamiast polegać na tym, że użytkownik pamięta tabelę.
- Ważność, Wpływ, Wymiar, Lokalizacja są każdy w osobnej linii z wyrównanymi etykietami. Szczegóły zaczynają się w osobnej linii pod etykietą `Detail:`, dzięki czemu mogą naturalnie zawijać się.

Po raporcie zapytaj:

```
question: "Review complete. How would you like to proceed?"
header: "Implementation Review — [N] findings"
options:
  - label: "Triage findings"
    description: "Walk through each finding and decide."
  - label: "Save report & triage later"
    description: "Save the full report. Resume with /10x-impl-review <report-path>."
  - label: "Save report only"
    description: "Save and finish — I'll handle the findings myself."
multiSelect: false
```

### Zapisywanie raportu

Zapisz do `context/changes/<change-id>/reviews/impl-review.md` (lub `context/changes/<change-id>/reviews/impl-review-phase-N.md` dla przeglądu ograniczonego do fazy). Zaktualizuj `change.md`: ustaw `status: impl_reviewed` i `updated: <today>`. Jeśli użytkownik zdecyduje się na sortowanie, umieść wszelkie dalsze działania "napraw w planie/kodzie" w `context/changes/<change-id>/follow-ups/review-fixes.md`.

```markdown
<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: [Plan Title]

- **Plan**: [plan file path]
- **Scope**: Phase [N] of [Total]
- **Date**: YYYY-MM-DD
- **Verdict**: [APPROVED/NEEDS ATTENTION/REJECTED]
- **Findings**: [N critical] [N warnings] [N observations]

## Verdicts

| Dimension | Verdict |
|-----------|---------
| Plan Adherence | PASS/WARNING/FAIL |
| Scope Discipline | PASS/WARNING/FAIL |
| Safety & Quality | PASS/WARNING/FAIL |
| Architecture | PASS/WARNING/FAIL |
| Pattern Consistency | PASS/WARNING/FAIL |
| Success Criteria | PASS/WARNING/FAIL |

## Findings

### F1 — SQL injection in auth handler

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/auth/handler.ts:42
- **Detail**: SQL query built with string concatenation. Plan specified parameterized queries.
- **Fix**: Replace the template literal with a parameterized query using db.query($1, [value]).
  - Strength: Matches pattern in src/users/query.ts; removes injection class.
  - Tradeoff: Minor — one call site, a few-line change.
  - Confidence: HIGH — identical pattern used elsewhere.
  - Blind spot: None significant.
- **Decision**: PENDING

### F2 — Unplanned /api/status endpoint

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline
- **Location**: src/api/routes.ts:18
- **Detail**: New GET /api/status endpoint not in plan.
- **Fix A ⭐ Recommended**: Document in the plan as an addendum
  - Strength: Preserves the work; updates source of truth.
  - Tradeoff: Plan becomes a slightly moving target.
  - Confidence: HIGH — addendum pattern used regularly here.
  - Blind spot: Original-scope stakeholders not notified.
- **Fix B**: Remove and add to follow-up work
  - Strength: Keeps scope discipline strict.
  - Tradeoff: Loses implemented work; another PR later.
  - Confidence: MEDIUM — depends on callers.
  - Blind spot: Haven't checked for callers.
- **Decision**: PENDING

### F3 — camelCase vs. snake_case

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/utils/format.ts
- **Detail**: Uses camelCase while existing utils use snake_case.
- **Fix**: Rename exports to snake_case to match src/utils/.
- **Decision**: PENDING
```

Znacznik `<!-- IMPL-REVIEW-REPORT -->` i pola `Decision: PENDING` umożliwiają tryb wznowienia.

"Save & triage later" → zapisz, wydrukuj ścieżkę, przypomnij o uruchomieniu `/10x-impl-review <saved-report-path>`.
"Triage" → przejdź do kroku 5.

## Krok 5: Interaktywne sortowanie

TaskUpdate: activeForm "Triage"

### Tryb wznowienia

Jeśli wejście nastąpiło przez zapisany plik: przeczytaj go, przeanalizuj nagłówki `### F`, filtruj do `Decision: PENDING`. Jeśli brak: "All findings triaged." Gotowe.

### Pętla sortowania

Przejdź przez ustalenia w kolejności ważności (CRITICAL → WARNING → OBSERVATION). Dla każdego:

**Z 2 opcjami naprawy:**
```
question: "F[N] — [title]\n\nSeverity: [sev icon] [SEV]\nImpact: [impact icon] [LEVEL] — [meaning]\nDimension: [dim]\nLocation: [loc]\n\nDetail: [detail]\n\n[Fix A block]\n\n[Fix B block]"
header: "Finding [current] of [total remaining]"
options:
  - label: "Apply Fix A ⭐"
    description: "[Fix A one-liner]"
  - label: "Apply Fix B"
    description: "[Fix B one-liner]"
  - label: "Skip"
    description: "Not worth fixing now."
  - label: "Record as lesson"
    description: "Save as a recurring project rule via /10x-lesson."
multiSelect: false
```

**Z 1 opcją naprawy:**
```
question: "F[N] — [title]\n\nSeverity: [sev icon] [SEV]\nImpact: [impact icon] [LEVEL] — [meaning]\nDimension: [dim]\nLocation: [loc]\n\nDetail: [detail]\n\n[Fix block]"
header: "Finding [current] of [total remaining]"
options:
  - label: "Fix now"
    description: "[Fix one-liner]"
  - label: "Fix differently"
    description: "Different approach — let's discuss."
  - label: "Skip"
    description: "Not worth fixing now."
  - label: "Record as lesson"
    description: "Save as a recurring project rule via /10x-lesson."
multiSelect: false
```

**Obsługa odpowiedzi:**
- **Apply Fix A/B / Fix now**: pokaż dokładną zmianę kodu przed/po. Krótkie potwierdzenie ("Apply this?"), następnie edytuj. Oznacz FIXED (zapisz, która opcja, np. "Fixed via Fix A").
- **Fix differently**: zapytaj o preferowane podejście, zastosuj, oznacz FIXED.
- **Record as lesson**: wstępnie wypełnij cztery pola wpisu lekcji bezpośrednio z ustalenia — `Context` z lokalizacji ustalenia, `Problem` ze szczegółów ustalenia, `Rule` i `Applies to` pozostaw jako puste miejsca do wypełnienia przez użytkownika. Pokaż proponowany wpis jako kompletny blok markdown i poproś użytkownika o edycję / potwierdzenie za pomocą AskUserQuestion ("Approve this entry?" / "Edit before saving" / "Cancel"). Po potwierdzeniu, dołącz wpis jako nową sekcję H2 do `context/foundation/lessons.md` — jeśli plik nie istnieje, utwórz go najpierw z tym kanonicznym 5-wierszowym nagłówkiem (brak oddzielnego pliku szablonu; nagłówek jest osadzony tutaj):

  ```
  # Lessons Learned

  > Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

  ```

  Przepływ wstępnego wypełniania i potwierdzania jest kluczowym szczegółem UX; użytkownik musi zobaczyć pełny proponowany wpis z wstępnie wypełnionym Context/Problem i mieć możliwość edycji Rule i Applies-to przed dołączeniem. Po pomyślnym dołączeniu, **zawsze** zadaj pytanie uzupełniające za pomocą AskUserQuestion: "Lesson saved. Also apply the fix to the current code?" z opcjami "Yes — fix now" / "No — lesson only". **Nigdy nie pomijaj tego pytania ani nie decyduj w imieniu użytkownika** — czy poprawka jest trywialna, poza zakresem, czy obejmuje wiele plików, decyzja należy do użytkownika. Jeśli tak: pokaż zmianę kodu przed/po, zastosuj, oznacz `FIXED + ACCEPTED-AS-RULE: <rule title>`. Jeśli nie: oznacz `ACCEPTED-AS-RULE: <rule title>` (ustalenie pozostaje nienaprawione, reguła jest zapisana do przyszłej pracy).
- **Skip** → SKIPPED. Przejdź dalej, nie kłóć się.
- **Inne (dowolny tekst)**: zinterpretuj intencję użytkownika. Typowe intencje: "fix differently" (zwłaszcza w kontekście podwójnej poprawki) → zapytaj o preferowane podejście, zastosuj, oznacz FIXED; "accept risk" → oznacz ACCEPTED z uzasadnieniem użytkownika; "dismiss"/"disagree" → oznacz DISMISSED.

Po każdej decyzji, jeśli pracujesz z zapisanego pliku, zaktualizuj jego pole `Decision:`.

### Podsumowanie

```
═══════════════════════════════════════════════════════════
  TRIAGE COMPLETE
═══════════════════════════════════════════════════════════

  Fixed:     F1, F2 (Fix A)   (2)
  Rule:      F3 (+ fixed)     (1)
  Skipped:   F4               (1)
  Accepted:  F5               (1)

═══════════════════════════════════════════════════════════
```

Jeśli istnieje zapisany raport, zaktualizuj go o ostateczne decyzje. Oznacz zadanie przeglądu jako ukończone.

## Uwagi

- Jest to umiejętność **przeglądu**. Domyślnie analizuj i raportuj — dokonuj edycji podczas sortowania tylko wtedy, gdy użytkownik wyraźnie wybierze "Apply Fix" lub "Fix differently" dla konkretnego ustalenia.
- Bądź konkretny. "src/auth/handler.ts:42 — SQL query built with string concatenation, vulnerable to injection" — a nie "there might be a security issue somewhere".
- Nie oznaczaj preferencji stylistycznych, chyba że mają znaczenie. Jeśli kod działa i jest zgodny z planem, drobne różnice stylistyczne od istniejącego kodu są obserwacjami, a nie ostrzeżeniami.
- Jeśli sam plan był wadliwy (np. zaplanowano niebezpieczne podejście), oznacz to — ten przegląd wychwytuje również problemy z planem.
- Wpływ dotyczy **wysiłku decyzyjnego**, a nie **ważności**. NISKI wpływ na ustalenie CRITICAL oznacza, że poprawka jest oczywista; WYSOKI wpływ na WARNING oznacza, że kompromis jest realny.
- Dwie opcje naprawy tylko wtedy, gdy istnieje prawdziwy kompromis. Nie wymyślaj alternatyw dla trywialnych poprawek.
- Podczas przeglądania pojedynczej fazy, nadal sprawdzaj, czy zmiany z tej fazy nie naruszyły założeń poprzednich faz. Fazy mogą ze sobą współdziałać.
- Podczas sortowania, utrzymuj tempo. Użytkownik już przeczytał raport.
- Podczas naprawiania, minimalne, ukierunkowane edycje. Nie refaktoryzuj otaczającego kodu ani nie "ulepszaj" rzeczy, które nie zostały oznaczone.