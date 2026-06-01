---
name: 10x-archive
description: Archive a completed change by moving its folder into context/archive/ and stamping change.md with archived status
argument-hint: "<change-id-or-path>"
allowed-tools:
  - Read
  - Glob
  - Edit
  - Bash
  - AskUserQuestion
---

# /10x-archive — Zamknij Zmianę

Przenieś ukończony folder zmiany z `context/changes/<change-id>/` do `context/archive/<created-date>-<change-id>/`, oznacz `change.md` statusem `status: archived` + `archived_at`, użyj `git mv`, aby zachować historię plików, a jeśli `context/foundation/roadmap.md` zawiera element planu działania, którego `Change ID` jest równe `<change-id>`, zamknij również ten element: zmień jego `Status` na `done` i dodaj wpis do sekcji `## Done` planu działania.

Brama jest **pobłażliwa, tylko ostrzegawcza** — `/10x-archive` blokuje tylko w przypadku niezatwierdzonych zmian w folderze zmiany. Wszystko inne (niekompletny postęp, brak impl-review, status nie w `{implemented, impl_reviewed}`) jest wyświetlane jako ostrzeżenie, po którym następuje monit potwierdzenia; użytkownik nadal może archiwizować.

Po archiwizacji, każda inna umiejętność 10x odmawia zapisu w `context/archive/<...>/` (każda chroniona umiejętność sprawdza rozwiązany prefiks ścieżki i przerywa działanie ze stałym komunikatem). Zarchiwizowane foldery są domyślnie tylko do odczytu.

## Początkowa Odpowiedź

Po wywołaniu tej komendy:

1. **Sprawdź, czy podano jakiś argument**:
   - Jeśli podano argument, przeanalizuj go (patrz "Analiza Argumentów" poniżej) i przejdź do "Rozwiązania".
   - Jeśli NIE podano argumentu, odpowiedz następującym komunikatem i **ZATRZYMAJ**:

```
Zarchiwizuję ukończoną zmianę. Podaj change-id (slug w kebab-case) lub ścieżkę:

Przykłady:
  /10x-archive context-dir-restructure
  /10x-archive @context/changes/oauth-login/

Możesz wyświetlić aktywne zmiany za pomocą: `ls context/changes/`
```

   Następnie **poczekaj**, aż użytkownik poda argument.

## Analiza Argumentów

Weź pierwszy token oddzielony białymi znakami. Znormalizuj:

1. Usuń początkowe `@`, jeśli występuje.
2. Usuń końcowe `/`, jeśli występuje.
3. Jeśli wynik zawiera `/`, weź ostatni niepusty segment ścieżki.

Wynikiem jest `<change-id>`.

## Rozwiązanie

1. Rozwiąż `<change-id>` do `context/changes/<change-id>/`. Jeśli ta ścieżka nie istnieje:
   - Sprawdź `context/archive/` pod kątem katalogu, którego nazwa kończy się na `-<change-id>` — jeśli znaleziono, wydrukuj: `error: change "<change-id>" is already archived at <path>.` i ZATRZYMAJ.
   - W przeciwnym razie wydrukuj: `error: no change folder at context/changes/<change-id>/. Run `ls context/changes/` to list active changes.` i ZATRZYMAJ.
2. Odczytaj frontmatter `context/changes/<change-id>/change.md` (`status`, `created`).
   - Jeśli `status: archived`, wydrukuj: `error: change "<change-id>" is already archived in change.md but its folder is still under context/changes/. Inspect manually before re-running.` i ZATRZYMAJ.
   - Jeśli `created` brakuje lub nie jest w formacie `YYYY-MM-DD`, wydrukuj: `error: change.md.created is missing or malformed; cannot derive archive folder name.` i ZATRZYMAJ.

## Twarda odmowa: niezatwierdzone zmiany

Dwa wstępne sprawdzenia. Każde niepowodzenie blokuje archiwizację.

**1. Niezatwierdzone edycje w folderze zmiany.** Uruchom:

```bash
git status --porcelain "context/changes/<change-id>/"
```

Jeśli wynik nie jest pusty, **zablokuj** i wydrukuj:

```
✗ Nie można zarchiwizować: context/changes/<change-id>/ ma niezatwierdzone zmiany.

  <jedna linia na każdą problematyczną ścieżkę z git status --porcelain>

Najpierw zatwierdź lub schowaj je, a następnie uruchom ponownie /10x-archive.
```

**2. Istniejące już zmiany w stagingu w dowolnym miejscu.** Krok zatwierdzania archiwum (patrz "Przenieś i oznacz" poniżej) łączy wszystko, co jest w stagingu w momencie zatwierdzania. Jeśli użytkownik ma niezwiązane zmiany w stagingu z wcześniejszej pracy, trafiłyby one cicho do zatwierdzenia `chore(archive): close ...`. Uruchom:

```bash
git diff --cached --quiet
```

Jeśli kod wyjścia jest różny od zera, **zablokuj** i wydrukuj:

```
✗ Nie można zarchiwizować: istniejące zmiany w stagingu zostałyby dołączone do zatwierdzenia archiwum.

  <wynik `git diff --cached --name-only`>

Najpierw je zatwierdź lub `git reset`, aby wycofać ze stagingu, a następnie uruchom ponownie /10x-archive.
```

Każde niepowodzenie → ZATRZYMAJ. Nie przechodź do monitu ostrzegawczego; są to twarde blokady.

Jeśli `git` nie jest dostępny lub repozytorium nie jest repozytorium git, wydrukuj: `warning: not a git repository — skipping uncommitted-changes block.` i kontynuuj. (Archiwizacja nadal działa bez git; tracimy tylko zachowanie historii za pomocą `git mv` i pomijamy krok zatwierdzania archiwum.)

## Miękkie ostrzeżenia (nieblokujące)

Zbierz następujące ostrzeżenia, a następnie przedstaw je wszystkie naraz z jednym monitem potwierdzenia.

1. **Sprawdzenie statusu**: odczytaj `change.md.status`. Jeśli NIE jest w `{implemented, impl_reviewed}`, dodaj do kolejki: `Status to "<status>"; oczekiwano "implemented" lub "impl_reviewed".`
2. **Sprawdzenie oczekującego postępu**: przeanalizuj sekcję `## Progress` pliku `context/changes/<change-id>/plan.md` (jeśli `plan.md` istnieje). Dla każdego bloku `### Phase N:`, zidentyfikuj jego podsekcje `#### Automated` i `#### Manual` i policz wiersze `- [ ]` pod każdą z nich oddzielnie. Niech `<X>` = całkowita liczba oczekujących automatycznych we wszystkich fazach, `<Y>` = całkowita liczba oczekujących ręcznych we wszystkich fazach, `<N>` = `<X> + <Y>`.

   - **Jeśli plan używa podsekcji Auto/Manual** (dowolny blok `### Phase N:` zawiera nagłówek `#### Automated` lub `#### Manual`) i `<N> > 0`, dodaj do kolejki: `<N> elementów postępu nadal oczekuje (<X> automatycznych, <Y> ręcznych): <lista tokenów "N.M <tytuł>" oddzielonych przecinkami, skrócona do 5 z "…" jeśli dłuższa>.` Uporządkuj połączoną listę tokenów najpierw według elementów automatycznych (w kolejności dokumentu), a następnie według elementów ręcznych (w kolejności dokumentu); limit skracania do 5 dotyczy połączonej listy.
   - **Starsze rozwiązanie awaryjne**: jeśli żaden blok `### Phase N:` w Progress nie zawiera nagłówka `#### Automated` ani `#### Manual`, wróć do oryginalnego zachowania — policz linie `- [ ]` pod podnagłówkami `### Phase`; jeśli jakieś pozostały, dodaj do kolejki: `<N> elementów postępu nadal oczekuje: <lista tokenów "N.M <tytuł>" oddzielonych przecinkami, skrócona do 5 z "…" jeśli dłuższa>.` (bez rozbicia w nawiasach). Zachowuje to zerową zmianę zachowania dla planów utworzonych przed workflow-v2.
   - Jeśli brakuje `plan.md`, dodaj do kolejki: `Nie znaleziono plan.md w folderze zmiany.` i pomiń liczenie postępu.
3. **Sprawdzenie braku impl-review**: glob `context/changes/<change-id>/reviews/impl-review*.md`. Jeśli żaden nie pasuje, dodaj do kolejki: `Nie znaleziono impl-review w reviews/impl-review*.md.`
4. **Sprawdzenie braku SHA**: przeanalizuj sekcję `## Progress` pliku `plan.md` (jeśli istnieje). Policz wiersze `- [x]`, których linia NIE kończy się na ` — <sha>`, gdzie `<sha>` to 7+ znaków szesnastkowych (tj. wyrażenie regularne ` — [0-9a-f]{7,}$` nie pasuje). Jeśli liczba jest różna od zera, dodaj do kolejki: `<N> wierszy postępu bez sufiksu SHA: <tokeny "N.M <tytuł>" oddzielone przecinkami, skrócone do 5 z "…" jeśli dłuższe>.` Wiersze bez SHA są uzasadnione dla faz z pustym diffem i dla planów, które zostały ukończone przed wprowadzeniem kontraktu SHA — jest to miękki sygnał, a nie wada. Pomiń cicho, jeśli brakuje `plan.md` (sprawdzenie oczekującego postępu już objęło ten przypadek).

Jeśli co najmniej jedno ostrzeżenie zostało dodane do kolejki, wydrukuj:

```
⚠ Ostrzeżenia /10x-archive dla <change-id>:

  - <ostrzeżenie 1>
  - <ostrzeżenie 2>
  - <ostrzeżenie 3>
```

Następnie użyj `AskUserQuestion`. **Tylko ręczne zachęcenie**: jeśli powyższe sprawdzenie oczekującego postępu dodało do kolejki ostrzeżenie, którego rozbicie było dokładnie `0 automatycznych, <Y> ręcznych` z `<Y> ≥ 1`, dodaj ` (Zalecane)` do etykiety `Kontynuuj archiwizację`, aby monit wyraźnie zachęcał do archiwizacji — ręczne sprawdzenia są często celowo odkładane, a archiwizacja jest oczekiwaną ścieżką. We wszystkich innych przypadkach (mieszane oczekujące, tylko automatyczne, ostrzeżenie o starszym rozwiązaniu awaryjnym lub brak ostrzeżenia o postępie), przedstaw etykiety dosłownie.

- pytanie: `Zarchiwizować "<change-id>" mimo wszystko?`
  nagłówek: `Archiwizuj`
  opcje:
  - etykieta: `Kontynuuj archiwizację`
    opis: `Przenieś folder do context/archive/ pomimo ostrzeżeń.`
  - etykieta: `Wznów implementację`
    opis: `Nie archiwizuj. Zasugeruj /10x-implement <change-id> jako następny krok.`
  - etykieta: `Anuluj`
    opis: `Nie archiwizuj. Wyjdź czysto bez dalszych działań.`
  multiSelect: false

- **Kontynuuj archiwizację** → przejdź do "Przenieś i oznacz" poniżej.
- **Wznów implementację** → wydrukuj `→ /10x-implement <change-id>` i skopiuj to do schowka za pomocą `pbcopy 2>/dev/null || clip.exe 2>/dev/null || xclip -selection clipboard 2>/dev/null || true` (lub `Set-Clipboard` w PowerShell) (najlepsze starania, wieloplatformowe). ZATRZYMAJ.
- **Anuluj** → wydrukuj `Anulowano. Folder niezmieniony.` i ZATRZYMAJ.

Jeśli nie dodano żadnych ostrzeżeń do kolejki, pomiń monit i przejdź bezpośrednio.

## Przenieś i oznacz

1. **Oblicz miejsce docelowe archiwum**:
   - `CREATED=$(awk '/^created:/ {print $2; exit}' context/changes/<change-id>/change.md)` (prefiks daty, np. `2026-04-29`).
   - `DEST="context/archive/${CREATED}-<change-id>"`.
   - Jeśli `$DEST` już istnieje, wydrukuj: `error: archive destination "<DEST>" already exists. Inspect manually.` i ZATRZYMAJ.

2. **Oznacz `change.md`** (na miejscu, przed przeniesieniem):
   - Ustaw `status: archived`.
   - Ustaw `archived_at: <ISO-8601 datetime, dzisiaj, UTC>` — wygenerowane przez `date -u +"%Y-%m-%dT%H:%M:%SZ"`.
   - Ustaw `updated: <dzisiaj jako YYYY-MM-DD>`.
   - Użyj narzędzia Edit, aby zaktualizować każdą z trzech linii frontmatter. NIE dotykaj żadnego innego pola; w szczególności pozostaw `created` i `change_id` bez zmian.

3. **Przenieś folder**:
   - Preferuj `git mv "context/changes/<change-id>" "$DEST"`, aby historia była zachowana.
   - Jeśli `git mv` zawiedzie (nie jest to repozytorium git, lub git odmawia z jakiegoś powodu), wróć do `mkdir -p context/archive`, a następnie `mv "context/changes/<change-id>" "$DEST"`. Wydrukuj ostrzeżenie, jeśli użyto rozwiązania awaryjnego.
   - Potwierdź po przeniesieniu: `[ -d "$DEST" ] && [ ! -d "context/changes/<change-id>" ]`. Jeśli którekolwiek sprawdzenie zawiedzie, wydrukuj diagnostykę i ZATRZYMAJ.

4. **Przygotuj znacznik do zmiany nazwy.** Edycja w kroku 2 zmodyfikowała `change.md` w drzewie roboczym, ale `git mv` tylko przygotowuje zmianę nazwy z zawartością pliku HEAD. Uruchom `git add "$DEST/change.md"`, aby znacznik frontmatter trafił do tego samego zatwierdzenia co zmiana nazwy.

5. **Zamknij pasujący element planu działania** — najlepsze starania; ten krok nigdy nie blokuje, nigdy nie wycofuje i nigdy nie monituje. Plan działania jest opcjonalny; większość zmian nie będzie do niego prowadzić.

   1. `test -f context/foundation/roadmap.md`. Jeśli brak, pomiń ten krok cicho.
   2. Sprawdź, czy plik jest już brudny: `ROADMAP_PREDIRTY=$(git status --porcelain context/foundation/roadmap.md 2>/dev/null)`. (Używane w podkroku 7 do podjęcia decyzji, czy przygotować go do zatwierdzenia archiwum.)
   3. Odczytaj `context/foundation/roadmap.md`. Poszukaj `<change-id>` użytego jako `Change ID`:
      - w tabeli `## At a glance` — wiersz, którego komórka kolumny **Change ID** jest dokładnie równa `<change-id>`;
      - oraz w treści `## Foundations` / `## Slices` — blok `### <ID>: …`, który zawiera linię `- **Change ID:** <change-id>`.

      `<ID>` to lokalny identyfikator tego elementu w planie działania (`F-NN` lub `S-NN`); `<Outcome>` to tekst jego linii `- **Outcome:**` (zachowaj początkowe `(foundation) `, jeśli występuje).
   4. **Brak dopasowania** → wydrukuj `ℹ context/foundation/roadmap.md nie ma elementu z Change ID "<change-id>" — plan działania pozostawiony bez zmian.` i pomiń resztę tego kroku. Dopasowanie jest tylko dokładnym ciągiem; wycinek planu działania może generować kilka zmian, więc bliskie dopasowanie celowo *nie* jest zamykane.
   5. **Znaleziono dopasowanie** → zastosuj trzy edycje poniżej za pomocą narzędzia Edit. Każda jest niezależna i najlepszym staraniem: jeśli cel nie znajduje się tam, gdzie umieszcza go szablon `/10x-roadmap` (ręcznie edytowany plan działania, starszy format), pomiń tę podedycję, kontynuuj i zanotuj, co zostało pominięte — nigdy nie przerywaj archiwizacji z powodu kształtu planu działania. Dotknij tylko pól wymienionych tutaj; pozostaw `Outcome`, `Prerequisites`, `Parallel with`, `Risk` itp. bez zmian.
      1. **`## At a glance`** — w dopasowanym wierszu tabeli ustaw komórkę kolumny **Status** na `done`.
      2. **Treść elementu** — w bloku `### <ID>: …` przepisz linię `- **Status:**` na `- **Status:** done`.
      3. **Sekcja `## Done`** — dodaj jeden punkt pod nagłówkiem `## Done`, w udokumentowanym formacie tej sekcji:

         ```
         - **<ID>: <Outcome>** — Zarchiwizowano <dzisiaj> → `context/archive/<CREATED>-<change-id>/`. Lekcja: —.
         ```

         `<dzisiaj>` to `date -u +%F` (`RRRR-MM-DD`); `<CREATED>` to wartość obliczona w kroku 1 "Oblicz miejsce docelowe archiwum". Jeśli plan działania nie ma nagłówka `## Done`, dodaj nagłówek i ten punkt na końcu pliku.
   6. Zaktualizuj frontmatter planu działania: ustaw `updated: <dzisiaj jako YYYY-MM-DD>`. Pozostaw wszystkie inne klucze (`created`, `version`, `status`, `prd_version`, `main_goal`, `top_blocker`, …) bez zmian. Jeśli plik nie ma frontmatter YAML, pomiń ten podkrok.
   7. **Przygotuj go do zatwierdzenia archiwum** — tylko jeśli `git` jest dostępny **i** `ROADMAP_PREDIRTY` (podkrok 2) był pusty. Następnie uruchom `git add context/foundation/roadmap.md`, aby zamknięcie planu działania trafiło do tego samego zatwierdzenia co zmiana nazwy + znacznik. Jeśli `ROADMAP_PREDIRTY` nie był pusty, plik miał już niezatwierdzone edycje; pozostaw zamknięcie planu działania w drzewie roboczym i wydrukuj `⚠ context/foundation/roadmap.md miał istniejące niezatwierdzone zmiany — zamknięto element planu działania <ID> w drzewie roboczym, ale NIE przygotowano go. Zatwierdź go samodzielnie.` Jeśli `git` jest niedostępny, edycja pozostaje w drzewie roboczym (wstępne sprawdzenie już ostrzegło).
   8. Zapamiętaj `<ID>` i `<Outcome>` dla danych wyjściowych potwierdzenia.

6. **Zatwierdź archiwum.** Utwórz jedno zatwierdzenie:

   ```bash
   git commit -m "$(cat <<'EOF'
   chore(archive): close <change-id>

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```

   Bez treści — temat jest mechaniczny, a różnica (zmiana nazwy + znacznik frontmatter, plus zamknięcie planu działania, gdy jedno pasowało) jest oczywista. Nigdy nie przekazuj flag `--no-verify` ani flag pomijających podpisywanie. Jeśli hak pre-commit zawiedzie, napraw podstawowy problem i utwórz NOWE zatwierdzenie.

   Pomiń ten krok całkowicie, jeśli `git` jest niedostępny lub repozytorium nie jest repozytorium git (wstępne sprawdzenie już ostrzegło).

7. **Wydrukuj potwierdzenie**:

```
✓ Zarchiwizowano <change-id>
  context/changes/<change-id>/  →  <DEST>/

change.md zaktualizowano:
  status:       archived
  archived_at:  <ISO datetime>
  updated:      <today>

roadmap.md:     zamknięto <ID> "<Outcome>"  →  Status: done, wpis dodany do ## Done    ← wydrukuj tylko, gdy element planu działania pasował; w przeciwnym razie pomiń tę linię

Zatwierdzono jako: <krótki SHA> chore(archive): close <change-id>

Folder jest teraz domyślnie tylko do odczytu. Aby rozpocząć nową zmianę: /10x-new <new-id>
```

## Obsługa błędów

- Każdy nieoczekiwany błąd systemu plików podczas przenoszenia pozostawia folder źródłowy na miejscu — przygotowane edycje `change.md` trafiają przed przeniesieniem, więc w przypadku częściowego niepowodzenia użytkownik widzi `status: archived` w `context/changes/<change-id>/change.md`, ale folder nadal znajduje się w `context/changes/`. `/10x-status` wyświetli to jako ostrzeżenie `status drift: archived in wrong folder`. Ponowne uruchomienie `/10x-archive` jest bezpieczne: sprawdzenie rozwiązania na początku wykryje `status: archived` i poprosi użytkownika o ręczne sprawdzenie.
- NIE próbuj wycofywać — edycje change.md oznaczają intencję, a częściowy stan można odzyskać ręcznie.
- Krok zamykania planu działania ("Przenieś i oznacz", krok 5) jest izolowany: każde niepowodzenie jest wyłapywane, odnotowywane w danych wyjściowych potwierdzenia i pomijane. Nigdy nie przerywa archiwizacji i nigdy nie wywołuje wycofania. Częściowo zastosowana edycja planu działania jest możliwa do odzyskania ręcznie.

## Czego ta umiejętność NIE robi

- Nie dodaje SHA do elementów Progress — `/10x-implement` jest jedynym autorem sufiksu SHA na końcu fazy. Brama archiwum wymusza obecność SHA jako sygnał tylko ostrzegawczy (patrz sprawdzenie miękkiego ostrzeżenia 4); nigdy nie przepisuje wiersza bez SHA.
- Nie uruchamia `pnpm test` / `pnpm build` / `pnpm ci:local` jako bramy — brama jest celowo pobłażliwa, tylko ostrzegawcza.
- Nie wypycha. Zatwierdzenie archiwum ląduje lokalnie; `git push` to decyzja użytkownika.
- Nie przepisuje planu działania poza zamknięciem jednego dopasowanego elementu. Gdy `context/foundation/roadmap.md` ma element, którego `Change ID` jest równe zarchiwizowanemu `<change-id>`, ta umiejętność zmienia tylko `Status` tego elementu (komórka tabeli + linia treści `### <ID>:`), dodaje jeden punkt `## Done` i aktualizuje datę `updated:`. Nigdy nie zmienia kolejności wycinków, nie przelicza grafu zależności, nie edytuje innych elementów ani nie tworzy planu działania, który nie istnieje. Brak dopasowania (lub brak pliku planu działania) → plan działania pozostaje bez zmian.
- Nie zapisuje do `context/archive/<...>/` po przeniesieniu; zarchiwizowane foldery są domyślnie tylko do odczytu. Inne umiejętności 10x (`/10x-research`, `/10x-frame`, `/10x-plan`, `/10x-plan-review`, `/10x-implement`, `/10x-impl-review`, `/10x-tdd`, `/10x-auto-implement`) odmawiają, gdy rozwiązana ścieżka zaczyna się od `context/archive/`.
- Nie przywraca z archiwum. Aby ponownie przejrzeć zarchiwizowaną zmianę, otwórz nową zmianę za pomocą `/10x-new` i odwołaj się do zarchiwizowanego folderu w celu uzyskania kontekstu.