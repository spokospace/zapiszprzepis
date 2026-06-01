---
name: 10x-implement
description: Implement technical plans from context/changes/<change-id>/plan.md with verification
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash
  - Task
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---

# Implementacja Planu

Masz za zadanie zaimplementować zatwierdzony plan techniczny z `context/changes/<change-id>/plan.md`. Plany te zawierają fazy ze specyficznymi zmianami oraz kanoniczną sekcję `## Progress` na dole, która steruje stanem wykonania (patrz `references/progress-format.md`).

## Początkowa konfiguracja

Po wywołaniu tej komendy:

1. **Rozwiąż plan**:
   - Jeśli wywołano jako `/10x-implement <change-id> [phase N]`, rozwiąż do `context/changes/<change-id>/plan.md`.
   - Jeśli wywołano z `@context/changes/<change-id>/plan.md` lub pełną ścieżką, zaakceptuj.
   - **Odmów, jeśli rozwiązana ścieżka zaczyna się od `context/archive/`** — wydrukuj "This change is archived. Open a new change with `/10x-new` instead." i ZATRZYMAJ.
   - Jeśli nic nie zostało podane, odpowiedz poniższą wiadomością i **ZATRZYMAJ i czekaj**:

```
I'll help you implement an approved technical plan. Please provide:

1. A change-id (e.g., `/10x-implement oauth-login phase 1`), or
2. A full path (e.g., `@context/changes/oauth-login/plan.md`).

You can list active changes with: `ls context/changes/`

Tip: Make sure the plan has been reviewed and approved before implementation.
```

## Rozpoczęcie pracy

Po podaniu ścieżki do planu:

- Przeczytaj cały plan. Sekcja `## Progress` na dole jest autorytatywna dla stanu wykonania — znaczniki wyboru (`- [x]`) znajdują się TYLKO tam. Bloki faz zawierają zwykłe punktorzy `- ` (bez pól wyboru).
- Przeczytaj `context/foundation/lessons.md`, jeśli istnieje, i przyswój każdy wpis przed rozpoczęciem jakiejkolwiek fazy — są to zaakceptowane, powtarzające się zasady zespołu i muszą kształtować każdy wybór implementacyjny, który podejmiesz w tym przebiegu.
- Przeczytaj wszystkie pliki wymienione w planie (odwołania do badań, ram, plików źródłowych w tym samym folderze zmiany)
- **Czytaj pliki w całości** — nigdy nie używaj parametrów limit/offset, potrzebujesz pełnego kontekstu
- Głęboko zastanów się, jak poszczególne elementy pasują do siebie
- **Zaktualizuj `change.md`**: przy wejściu ustaw `status: implementing` (tylko jeśli aktualnie w `{planned, plan_reviewed}`) i `updated: <today>`.
- Policz całkowitą liczbę faz (z nagłówków `## Phase N:`) i utwórz jeden wpis TaskCreate dla każdej fazy (pojawią się one na pasku stanu użytkownika):
  - Dla każdej fazy utwórz zadanie z `subject: "Phase N: [Phase Name]"` i `activeForm: "Implementing Phase N"`
  - Ustaw bieżącą fazę na `in_progress` za pomocą TaskUpdate przed rozpoczęciem pracy
  - Oznacz każdą fazę jako `completed` za pomocą TaskUpdate, gdy jej kryteria sukcesu zostaną spełnione
- **Znajdź następny oczekujący krok**, skanując sekcję `## Progress`: pierwsza linia `- [ ]` w kolejności dokumentu to miejsce, od którego zaczynasz. Jeśli podano argument `phase N`, przejdź do pierwszej linii `- [ ]` wewnątrz `### Phase N:`.
- Rozpocznij implementację, jeśli rozumiesz, co należy zrobić

## Filozofia implementacji

Plany są starannie zaprojektowane, ale rzeczywistość może być skomplikowana. Twoim zadaniem jest:

- Postępować zgodnie z intencją planu, jednocześnie dostosowując się do tego, co znajdziesz
- W pełni zaimplementować każdą fazę przed przejściem do następnej
- Zweryfikować, czy Twoja praca ma sens w szerszym kontekście bazy kodu
- Aktualizować pola wyboru w planie w miarę kończenia sekcji

Gdy coś nie pasuje dokładnie do planu, zastanów się dlaczego i jasno to zakomunikuj. Plan jest Twoim przewodnikiem, ale Twoja ocena również ma znaczenie.

Jeśli napotkasz niezgodność:

- ZATRZYMAJ SIĘ i głęboko zastanów się, dlaczego plan nie może być przestrzegany
- Jasno przedstaw problem jako tekst:

  ```
  Issue in Phase [N]:
  Expected: [what the plan says]
  Found: [actual situation]
  Why this matters: [explanation]
  ```

- Następnie użyj `AskUserQuestion`, aby uzyskać ustrukturyzowaną decyzję:

  AskUserQuestion:
  - question: "How should I handle this mismatch?"
    header: "Mismatch"
    options:
    - label: "Adapt and continue"
      description: "Adjust the implementation to match reality. I'll explain the adaptation."
    - label: "Skip this part"
      description: "Move on to the next section/phase. This change isn't needed."
    - label: "Stop and re-plan"
      description: "This mismatch is too significant. We need to update the plan first."
      multiSelect: false

## Śledzenie plików zmienionych podczas fazy

Rytuał zatwierdzania na koniec fazy (patrz "Podejście do weryfikacji" poniżej) przygotowuje pliki z **zestawu zmienionych plików**, który utrzymujesz w pamięci roboczej przez całą fazę. Ten zestaw jest kanonicznym wejściem do `git add` — nigdy nie wracaj do heurystyki `git status` dla decyzji o przygotowaniu.

**Dyscyplina**:

- Za każdym razem, gdy wywołujesz `Edit` lub `Write` na pliku podczas bieżącej fazy, dodaj jego ścieżkę względną do repozytorium do zestawu zmienionych plików.
- Zestaw zawsze zawiera `context/changes/<change-id>/plan.md`, ponieważ każda faza generuje co najmniej jedną edycję w sekcji `## Progress`. Dodaj go przy wejściu do fazy, nawet zanim jakiekolwiek pola wyboru zostaną zmienione.
- **Uruchomienie fazy 1**: w pierwszej fazie zmiany, również zasil zestaw zmienionych plików wszystkimi nieśledzonymi lub zmodyfikowanymi plikami wewnątrz `context/changes/<change-id>/` — zazwyczaj `change.md`, `research.md`, `plan.md` i innymi plikami kontekstowymi utworzonymi podczas planowania. Te pliki są częścią zmiany i powinny trafić do pierwszego commita, zamiast pozostać jako nieśledzone resztki.
- Zestaw **resetuje się na każdej granicy fazy**. Po zakończeniu commita na koniec fazy, wyczyść go przed rozpoczęciem następnej fazy.
- Ta lista zastępuje wszelkie heurystyki z `git status`. Jeśli zmieniony zestaw to `{a.md, b.md, plan.md}`, ale `git status --porcelain` również zgłasza `c.md` jako brudny, `c.md` jest niezwiązany — obsłuż go za pomocą monitu o brudną ścieżkę w rytuale, nigdy nie pakuj go cicho do commita.

## Śledzenie odniesień do problemów/zadań dla commitów

Przed zaproponowaniem jakiejkolwiek wiadomości commitu na koniec fazy lub epilogu, przeskanuj kontekst rozmowy w poszukiwaniu odniesień do problemów lub zadań systemu śledzenia związanych z tą pracą implementacyjną, w tym kluczy Jira (na przykład `ABC-123`), identyfikatorów problemów Linear (na przykład `ENG-123`), odniesień do problemów/PR GitHub (na przykład `#123`, `GH-123` lub pełnych adresów URL problemów/PR GitHub) lub jawnych linków do zadań z Jira, Linear lub GitHub.

- Jeśli obecne jest jedno lub więcej odniesień, umieść je w treści wiadomości commitu pod linią `Refs:`, zachowując dokładne identyfikatory/adresy URL podane przez użytkownika, jeśli to możliwe.
- Jeśli dotyczy wiele odniesień, wymień je oddzielone przecinkami w jednej linii `Refs:`.
- Nie wymyślaj ani nie wnioskuj odniesień do śledzenia z identyfikatora zmiany, nazwy gałęzi lub nazw plików. Używaj tylko odniesień widocznych w bieżącym kontekście rozmowy lub wyraźnie podanych przez użytkownika.
- Zastosuj tę samą linię `Refs:` do każdego commitu na koniec fazy i do commitu epilogu, chyba że użytkownik zawęzi odniesienie do konkretnej fazy.

## Podejście do weryfikacji

Po zaimplementowaniu fazy:

- Uruchom sprawdzenia kryteriów sukcesu (zazwyczaj `make check test` obejmuje wszystko)
- Napraw wszelkie problemy przed kontynuowaniem
- Zaktualizuj swój postęp w swoich zadaniach i w sekcji `## Progress` planu
- **Zmieniaj TYLKO sekcję `## Progress`.** Bloki faz (Overview, Changes Required, Success Criteria) są tylko do odczytu. Użyj Edit, aby zmienić `- [ ] N.M <title>` na `- [x] N.M <title>` w Progress, gdy każdy krok zostanie zakończony. NIE edytuj punktorów bloku faz, NIE dodawaj znaczników postępu komentarzy HTML na dole planu i NIE zapisuj żadnego pliku stanu pomocniczego.
- **Uruchom rytuał zatwierdzania na koniec fazy**: Po pomyślnym przejściu wszystkich automatycznych sprawdzeń dla fazy, przejdź przez ten sekwencyjny rytuał, aby utworzyć jeden commit Conventional-Commits i zapisać zamykający krótki SHA z powrotem do każdego wiersza Progress zmienionego podczas fazy.

  1. **Bramka ręcznego potwierdzenia.** Poinformuj człowieka, że automatyczna weryfikacja zakończyła się pomyślnie i wymień elementy ręcznej weryfikacji z planu. Zatrzymaj się tutaj. Nie kontynuuj, dopóki człowiek nie potwierdzi, że testy ręczne zakończyły się sukcesem. Użyj tego formatu:

     ```
     Phase [N] Complete - Ready for Manual Verification

     Automated verification passed:
     - [List automated checks that passed]

     Please perform the manual verification steps listed in the plan:
     - [List manual verification items from the plan]

     Let me know when manual testing is complete so I can proceed to the commit step.
     ```

     **Ręczne podsumowanie międzyfazowe (tylko faza końcowa).** Przed wydrukowaniem komunikatu bramki, określ, czy bieżąca faza jest fazą końcową: przeskanuj sekcję `## Progress` w poszukiwaniu nagłówków `### Phase M:` i traktuj bieżącą fazę jako końcową, jeśli w kolejności dokumentu nie istnieje nagłówek z `M > N`. Jeśli bieżąca faza **nie jest** końcowa, komunikat bramki ma dokładnie powyższy format — bez podsumowania. Jeśli bieżąca faza **jest** końcowa, po bloku "Please perform the manual verification steps listed in the plan:", przeskanuj całą sekcję Progress w poszukiwaniu wierszy `- [ ]`, które znajdują się pod podsekcją `#### Manual` w dowolnej fazie **innej niż bieżąca**. Jeśli takie wiersze istnieją, dołącz następujący blok do komunikatu bramki (w kolejności dokumentu, jeden wiersz na linię, sformatowany jako `<phase>.<index> <title>` — usuń wszelkie prefiksy `- [ ]` i wszelkie końcowe sufiksy ` — <sha>`):

     ```
     Pending manual checks from earlier phases:
     - [phase.index title]
     ```

     Jeśli nie ma oczekujących wierszy ręcznych z wcześniejszych faz, pomiń blok podsumowania całkowicie. Bramka nadal wstrzymuje się na potwierdzenie przez człowieka; jest to informacyjne, a nie twarda blokada. Fazy pośrednie (każda faza, która nie jest końcową) zachowują oryginalny format bramki bez podsumowania.

  2. **Oblicz zestaw przygotowania.** Weź zestaw zmienionych plików utrzymywany podczas fazy (patrz "Śledzenie plików zmienionych podczas fazy" powyżej) i połącz go z `{context/changes/<change-id>/plan.md}`. Plik planu jest zawsze przygotowywany, ponieważ każda faza generuje co najmniej jedną edycję w sekcji `## Progress`.

  3. **Wykryj niezwiązane brudne ścieżki.** Uruchom `git status --porcelain` i przetnij z ścieżkami *poza* zestawem przygotowania. Jeśli zestaw brudnych, ale nietkniętych plików nie jest pusty, przedstaw problematyczne ścieżki i użyj `AskUserQuestion`:

     - question: "<N> unrelated path(s) are dirty. How should I handle them?"
       header: "Dirty paths"
       options:
       - label: "Continue — stage only the planned set (Recommended)"
         description: "Commit only files this phase touched. Leave the unrelated paths dirty for you to handle separately."
       - label: "Stage all"
         description: "Add the unrelated paths to this commit. You take responsibility for the broader scope."
       - label: "Abort"
         description: "Stop the phase commit. Resolve the dirty paths first, then re-run the ritual."
       multiSelect: false

     Jeśli zestaw brudnych, ale nietkniętych plików jest pusty, pomiń ten krok.

  4. **Przygotuj jawnie według ścieżki.** `git add` każdy plik z wybranego zestawu według nazwy. NIE używaj `git add -A` ani `git add .` — tylko jawne ścieżki.

  5. **Sprawdź pusty diff.** Uruchom `git diff --cached --quiet`. Kod wyjścia 0 oznacza brak przygotowanego diffa. Jeśli pusty, wydrukuj:

     ```
     Phase [N] had no diff to commit; rows remain SHA-less; archive warn-only will surface them.
     ```

     Ustaw `SHA=""` i przejdź do kroku 8.

  6. **Zaproponuj wiadomość Conventional-Commits.** Zbuduj linię tematu w formacie `<type>(<change-id>): <phase title> (p<N>)`, gdzie `<type>` to jeden z `feat / fix / chore / refactor / docs` wybrany z natury fazy (np. `feat` dla nowego zachowania widocznego dla użytkownika, `chore` dla edycji promptów/dokumentów, `refactor` dla restrukturyzacji bez zmiany zachowania). Tytuł fazy jest znaczącą częścią i prowadzi; sufiks `(p<N>)` zawiera indeks fazy. Zbuduj krótką treść wymieniającą zmienione pliki, plus linię `Refs:` z "Śledzenie odniesień do problemów/zadań dla commitów", jeśli ma zastosowanie. Użyj `AskUserQuestion`:

     - question: "Approve commit message?"
       header: "Commit msg"
       options:
       - label: "Approve as proposed (Recommended)"
         description: "Use the message as drafted."
       - label: "Edit subject line"
         description: "Override the subject; keep the body."
       - label: "Override entirely"
         description: "Replace both subject and body."
       multiSelect: false

  7. **Zatwierdź za pomocą heredoc.** Uruchom `git commit` zgodnie z globalnym protokołem wiadomości commitu:

     ```bash
     git commit -m "$(cat <<'EOF'
     <type>(<change-id>): <phase title> (p<N>)

     <short body listing touched files>
     <Refs: issue/task references, if applicable>

     Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
     EOF
     )"
     ```

     Nigdy nie przekazuj `--no-verify`, `--amend` ani flag pomijających podpisywanie. Jeśli hak pre-commit zawiedzie, napraw podstawowy problem i utwórz NOWY commit — oryginalny commit NIE nastąpił, więc poprawianie dotknęłoby commitu poprzedniej fazy.

  8. **Zapisz krótki SHA.** Uruchom `git rev-parse --short HEAD` i zapisz jako `SHA`. Pomiń ten krok, jeśli `SHA=""` zostało ustawione w kroku 5.

  9. **Zapisz SHA z powrotem do Progress.** Dla każdego wiersza Progress zmienionego podczas tej fazy, uruchom ukierunkowaną edycję:

     - Znajdź: `- [x] N.M <title>` (brak istniejącego sufiksu ` — <sha>` na końcu linii)
     - Zastąp: `- [x] N.M <title> — <SHA>`

     Pomiń wiersze, które już zawierają sufiks SHA (bezpieczeństwo wznowienia: jeśli rytuał zostanie ponownie uruchomiony po częściowym przebiegu, nie dodawaj podwójnie). Jeśli `SHA=""`, pomiń całkowicie dodawanie — wiersze pozostaną bez SHA, a `/10x-archive` wyświetli je jako ostrzeżenia informacyjne w ramach swojego sprawdzenia braku SHA.

  10. **Zaktualizuj `change.md`.** Ustaw `updated: <today>`; zachowaj `status: implementing` (idempotentne do ostatniej fazy). W ostatniej fazie ustaw `status: implemented` po zapisaniu SHA (patrz "Po wszystkich fazach" poniżej).

  11. **Zresetuj zestaw zmienionych plików.** Wyczyść go przed rozpoczęciem następnej fazy. Rytuał jest samodzielny dla każdej fazy.

- **Decyzja o następnej fazie**: Jeśli jest następna faza, pomóż użytkownikowi zdecydować, czy kontynuować, czy zacząć od nowa.

  Użyj `AskUserQuestion`, aby przedstawić decyzję:

  AskUserQuestion:
  - question: "Phase [N] complete. How to proceed?"
    header: "Next phase"
    options:
    - label: "Continue to Phase [N+1]"
      description: "Stay in this context and proceed to the next phase."
    - label: "Clear context first"
      description: "Copy resume command to clipboard. Start fresh for Phase [N+1]."
    - label: "Review this phase first"
      description: "Run /10x-impl-review to verify implementation against the plan before proceeding."
      multiSelect: false

  **Jeśli użytkownik zdecyduje się na przegląd**: Uruchom `/10x-impl-review @[path-to-plan] phase [N]`, aby przejrzeć właśnie zakończoną fazę. Po zakończeniu przeglądu, ponownie przedstaw decyzję o kontynuacji/wyczyszczeniu (tym razem bez opcji przeglądu).

  **Jeśli użytkownik zdecyduje się kontynuować**: Przejdź bezpośrednio do następnej fazy — przeczytaj sekcję planu dla następnej fazy, ustaw zadanie na `in_progress` i zaimplementuj. Nie ma potrzeby ponownego czytania całego planu ani już załadowanych plików.

  **Jeśli użytkownik zdecyduje się wyczyścić**: Skopiuj polecenie wznowienia do schowka i wyświetl je:
  1. Kopiuj:
     ```bash
     echo -n "/10x-implement <change-id> phase [next-phase-number]" | pbcopy 2>/dev/null || echo -n "/10x-implement <change-id> phase [next-phase-number]" | clip.exe 2>/dev/null || echo -n "/10x-implement <change-id> phase [next-phase-number]" | xclip -selection clipboard 2>/dev/null || true
     ```

     ```powershell
     # PowerShell (Windows)
     Set-Clipboard "/10x-implement <change-id> phase [next-phase-number]"
     ```
  2. Wyświetl:
     ```
     → /10x-implement <change-id> phase [next-phase-number] (✓ copied)
     ```

Jeśli polecono wykonanie wielu faz kolejno, pomiń AskUserQuestion między fazami.

nie zaznaczaj elementów w krokach testowania ręcznego, dopóki użytkownik ich nie potwierdzi.

## Śledzenie stanu

**Sekcja `## Progress` w `plan.md` jest jedynym źródłem prawdy.** Brak pliku stanu. Brak znaczników komentarzy. Zobacz `references/progress-format.md` dla kontraktu formatu.

### Po każdym kroku

Użyj Edit, aby zmienić dokładnie jedną linię Progress na raz:

- Znajdź: `- [ ] N.M <title>`
- Zastąp: `- [x] N.M <title>`

Nie dodawaj sufiksu SHA do edycji na każdym kroku — SHA jest zapisywane z powrotem na koniec fazy przez rytuał commitu (patrz "Podejście do weryfikacji" powyżej), a tylko SHA zamykającego commitu trafia do każdego wiersza, który został zmieniony podczas fazy. W trakcie fazy, ukończone wiersze mają `[x]` bez sufiksu SHA; jest to prawidłowy stan pośredni.

### Po każdej fazie

Gdy wszystkie elementy `- [ ]` wewnątrz `### Phase N:` są teraz `- [x]`:

1. Uruchom rytuał zatwierdzania na koniec fazy (patrz "Podejście do weryfikacji" powyżej): ręczne potwierdzenie → przygotowanie → monit o brudną ścieżkę → commit → zapis SHA.
2. `change.md.updated` jest zwiększany jako część kroku 10 rytuału.

Fazy z pustym diffem (tylko weryfikacja ręczna lub fazy bez operacji) nic nie zatwierdzają i pozostawiają swoje wiersze bez SHA; `/10x-archive` wyświetli je jako ostrzeżenia informacyjne w ramach swojego sprawdzenia braku SHA. Jest to celowe — nie każda faza generuje kod.

### Po wszystkich fazach

Gdy każdy `- [ ]` w całej sekcji `## Progress` jest teraz `- [x]`:

1. **Obronne wyświetlanie oczekujących elementów.** Przeskanuj całą sekcję `## Progress` jeszcze raz w poszukiwaniu wierszy `- [ ]`. W normalnym przepływie jest to operacja bez efektu — warunek wyzwalający dla "Po wszystkich fazach" to już "każdy `- [ ]` jest `- [x]`", więc wyszukiwanie nie powinno nic znaleźć. Istnieje po to, aby wszelkie nieoczekiwane pozostałości były jawne, a nie cicho tracone (np. jeśli częściowe uruchomienie, ręczna edycja lub ścieżka wznowienia ominęła wyzwalacz). Jeśli liczba jest różna od zera, wymień każdy wiersz jako `<phase>.<index> <title>` pogrupowany według podsekcji Automatyczne vs Ręczne w kolejności dokumentu, a następnie zapytaj za pomocą `AskUserQuestion`:

   - question: "<N> Progress item(s) still pending. How to proceed?"
     header: "Stragglers"
     options:
     - label: "Pause (Recommended)"
       description: "STOP without flipping change.md.status. Address the stragglers manually, then re-enter the epilogue path."
     - label: "Proceed to epilogue"
       description: "Flip status: implemented and run the epilogue commit anyway. Stragglers will surface as warnings under /10x-archive."
     multiSelect: false

   W przypadku "Pause": ZATRZYMAJ natychmiast. NIE aktualizuj `change.md`, NIE uruchamiaj commitu epilogu. W przypadku "Proceed to epilogue": kontynuuj z krokami 2–4 poniżej. Jeśli liczba wynosi zero, pomiń ten krok i kontynuuj.

2. Zaktualizuj `change.md`: ustaw `status: implemented`, `updated: <today>`. (NIE ustawiaj `archived_at` — to należy do `/10x-archive`.)
3. NIE zapisuj żadnego znacznika postępu komentarza HTML na dole planu.
4. **Uruchom commit epilogu.** Commit ostatniej fazy nie może zawierać własnego SHA (kurczak i jajko), więc zapis SHA z powrotem do wierszy Progress ostatniej fazy plus zmiana statusu `change.md` pozostają brudne w drzewie roboczym po zakończeniu rytuału ostatniej fazy. Utwórz jeden zamykający commit, aby je zatwierdzić — w przeciwnym razie twarda odmowa `/10x-archive` (niezatwierdzone ścieżki w folderze zmiany) zablokuje. Kroki:
   1. Przygotuj dokładnie `context/changes/<change-id>/plan.md` i `context/changes/<change-id>/change.md` (jawne ścieżki, bez `git add -A`).
   2. Uruchom `git diff --cached --quiet`; jeśli kod wyjścia wynosi 0, pomiń epilog (nic do zatwierdzenia) i zatrzymaj się tutaj.
   3. Zaproponuj temat `chore(<change-id>): close out plan (epilogue)` z krótką treścią odnotowującą końcowy zapis SHA planu + `change.md` → implemented, plus linię `Refs:` z "Śledzenie odniesień do problemów/zadań dla commitów", jeśli ma zastosowanie. Użyj AskUserQuestion, aby zatwierdzić jako proponowane / edytować temat / całkowicie zastąpić (te same opcje co rytuał fazy).
   4. Zatwierdź za pomocą heredoc zgodnie z globalnym protokołem (`Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer; nigdy `--no-verify` / `--amend`).
   5. NIE zapisuj własnego SHA epilogu z powrotem do planu — jego jedynym zadaniem jest czyste zatwierdzenie końcowych edycji.

### "Gdzie jestem?" — wywnioskowane, nie przechowywane

Przeanalizuj sekcję `## Progress`. Pierwsza linia `- [ ]` to następny krok. Bieżąca faza to nagłówek `### Phase N:` bezpośrednio nad nią. Ukończenie to `count([x]) / count([ ] + [x])`. Bez JSON, bez znaczników, bez pliku pomocniczego — tylko sekcja Progress.

## Zakończenie planu

Gdy WSZYSTKIE fazy są zaimplementowane i zweryfikowane (każde pole wyboru Progress jest `[x]`):

1. Potwierdź, że `change.md.status` jest teraz `implemented`.
2. Przedstaw podsumowanie zakończenia, a następnie zaoferuj ostateczny przegląd:

```
All phases implemented! 🎉

Summary:
- Phases completed: [N]
- Files changed: [list key files]
```

Użyj AskUserQuestion:

```
question: "Plan complete. Would you like a final implementation review?"
header: "Plan Complete"
options:
  - label: "Run full review (/10x-impl-review)"
    description: "Comprehensive review of all phases against the plan. Catches cross-phase issues."
  - label: "Skip review — I'm satisfied"
    description: "No review needed. Mark the plan as done."
multiSelect: false
```

Jeśli użytkownik wybierze przegląd → uruchom `/10x-impl-review <change-id>` (brak numeru fazy = pełny przegląd planu).

## Jeśli utkniesz

Gdy coś nie działa zgodnie z oczekiwaniami:

- Najpierw upewnij się, że przeczytałeś i zrozumiałeś cały odpowiedni kod
- Zastanów się, czy baza kodu ewoluowała od czasu napisania planu
- Jasno przedstaw niezgodność i poproś o wskazówki

Używaj podzadań oszczędnie — głównie do ukierunkowanego debugowania lub eksploracji nieznanego terenu:

- **Explore** (`subagent_type: "Explore"`) — Szybkie wyszukiwanie plików, wzorców, podobnego kodu
- **general-purpose** (`subagent_type: "general-purpose"`) — Głęboka analiza wymagająca wieloetapowego rozumowania

## Wznowienie pracy

Jeśli sekcja `## Progress` planu ma istniejące znaczniki `[x]`:

- Ufaj, że ukończona praca jest wykonana
- Kontynuuj od pierwszej linii `- [ ]`
- Weryfikuj poprzednią pracę tylko wtedy, gdy coś wydaje się nie tak

Pamiętaj: Implementujesz rozwiązanie, a nie tylko zaznaczasz pola. Miej na uwadze cel końcowy i utrzymuj dynamikę.