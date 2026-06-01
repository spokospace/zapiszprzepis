---
name: 10x-new
description: Initialize a new change folder under context/changes/<change-id> with a change.md identity file
argument-hint: "<change-id-or-path> [freeform intent]"
allowed-tools:
  - Read
  - Glob
  - Write
  - Bash
  - AskUserQuestion
---

# /10x-new — Rozpocznij nową zmianę

Uruchom nowy folder zmian w `context/changes/<change-id>/`. Tworzy mały plik tożsamości (`change.md`) i wskazuje użytkownikowi następną umiejętność.

„Zmiana” to pojedyncza jednostka pracy od początku do końca — badania, planowanie, implementacja i przegląd, wszystko to znajduje się w jednym folderze oznaczonym `<change-id>`.

## Początkowa odpowiedź

Po wywołaniu tego polecenia:

1. **Sprawdź, czy podano jakiś argument**:
   - Jeśli podano argument, przeanalizuj go (patrz „Analiza argumentów” poniżej) i przejdź do „Walidacji”.
   - Jeśli NIE podano argumentu, odpowiedz następującą wiadomością i **ZATRZYMAJ**:

```
I'll create a new change folder. Please provide a change-id (kebab-case slug):

Examples:
  /10x-new context-dir-restructure
  /10x-new oauth-login add Google sign-in so users skip the email-password step
  /10x-new @context/changes/oauth-login/

The first token becomes the change-id. Anything after it is freeform intent — used to write a richer title and to pick the next-step suggestion. Path-style references (with or without a leading `@`) are accepted; the last path segment is used as the change-id.

The change-id must be:
- kebab-case (lowercase letters, digits, hyphens; no leading/trailing hyphen, no double hyphens)
- unique across `context/changes/` and `context/archive/`
```

   Następnie **poczekaj**, aż użytkownik poda argument.

## Analiza argumentów

Podziel surowy ciąg argumentów na pierwszym ciągu białych znaków:

- **Pierwszy token** = odniesienie do change-id. Znormalizuj go:
  1. Usuń początkowe `@`, jeśli występuje (`@context/changes/feature-x/` → `context/changes/feature-x/`).
  2. Usuń końcowe `/`, jeśli występuje.
  3. Jeśli wynik zawiera `/`, weź ostatni niepusty segment ścieżki (`context/changes/feature-x` → `feature-x`).
  4. Wynikiem jest `<change-id>`.
- **Wszystko po pierwszym tokenie** = swobodny zamiar. Może być pusty. Może to być zdanie lub akapit. **Nie** traktuj tego jako dosłownego tytułu do wstawienia w całości.

Przykłady:

| Surowe dane wejściowe | `<change-id>` | Zamiar |
|-----------|---------------|--------|
| `feature-x` | `feature-x` | (puste) |
| `oauth-login add Google sign-in for faster onboarding` | `oauth-login` | `add Google sign-in for faster onboarding` |
| `@context/changes/oauth-login/` | `oauth-login` | (puste) |
| `@context/changes/oauth-login/ revisit the token-refresh edge case` | `oauth-login` | `revisit the token-refresh edge case` |
| `My Feature add OAuth` | `My Feature` (nie przejdzie kontroli kebab-case) | `add OAuth` |

## Walidacja

Przed utworzeniem czegokolwiek:

1. **Sprawdzenie kebab-case**: `<change-id>` musi pasować do `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` (zaczyna się od litery, segmenty małych liter + cyfr oddzielone pojedynczymi myślnikami, bez początkowego/końcowego myślnika, bez podwójnych myślników).
   - W przypadku niepowodzenia, wydrukuj: `error: change-id "<id>" is not kebab-case. Use lowercase letters, digits, and single hyphens only (e.g., "oauth-login", not "OAuth Login").` i ZATRZYMAJ.

2. **Sprawdzenie unikalności**: ani `context/changes/<change-id>/`, ani `context/archive/<change-id>/` nie mogą już istnieć.
   - W przypadku kolizji, wydrukuj: `error: change "<id>" already exists at <path>. Pick a different change-id or work inside the existing folder.` i ZATRZYMAJ.

3. **Istnieje katalog nadrzędny `context/changes/`**: jeśli brakuje, wydrukuj `error: context/changes/ not found — is this repo set up for the 10x context structure?` i ZATRZYMAJ. (NIE twórz automatycznie katalogu nadrzędnego; to znak, że repozytorium nie jest gotowe.)

## Tworzenie

1. Utwórz katalog `context/changes/<change-id>/`.
2. Wyprowadź `<title>`:
   - Jeśli ciąg zamiaru jest pusty, uczłowiecz change-id: zastąp myślniki spacjami i napisz pierwszą literę wielką (np. `multi-course-access` → `Multi course access`).
   - Jeśli ciąg zamiaru nie jest pusty, napisz zwięzły, czytelny dla człowieka tytuł (≤ 80 znaków, wielkość liter zdania, bez kropki na końcu), który oddaje istotę zmiany. Zamiar jest *wskazówką*, a nie dosłownością — możesz go przeformułować. Nie wrzucaj akapitu do tytułu.
3. Wyprowadź treść `## Notes`:
   - Jeśli ciąg zamiaru jest pusty, wyemituj komentarz z podpowiedzią: `<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->`
   - Jeśli ciąg zamiaru nie jest pusty, wstaw go dosłownie jako treść Notatek — słowa użytkownika są zalążkiem. W takim przypadku nie emituj również komentarza z podpowiedzią (użytkownik pokazał, że wie, do czego służą Notatki).
4. Zapisz `context/changes/<change-id>/change.md` w dokładnie takim kształcie (slot `<notes-body>` to to, co wyprodukował krok 3):

```markdown
---
change_id: <change-id>
title: <title>
status: new
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
archived_at: null
---

## Notes

<notes-body>
```

`<YYYY-MM-DD>` to dzisiejsza data (użyj `date +%Y-%m-%d`).

Zobacz `docs/reference/change-md.md` dla pełnego odniesienia do schematu (dozwolone wartości statusu, przejścia, co celowo NIE znajduje się w `change.md`).

## Sugestia następnego kroku

Po pomyślnym utworzeniu, wydrukuj monit o następny krok i skopiuj sugerowane polecenie do schowka.

Domyślnym następnym krokiem jest `/10x-plan <change-id>` — większość zmian przechodzi bezpośrednio do planowania. Pozostałe dwie umiejętności są sytuacyjne: `/10x-research`, gdy przeanalizowany zamiar (lub otaczająca tura) sugeruje, że zmiana wymaga znaczącej eksploracji bazy kodu, zanim będzie można napisać plan, oraz `/10x-frame`, gdy zamiar sygnalizuje, że ramy są podejrzane — albo kształt błędu („napraw”, „błąd”, „zepsuty”, „dlaczego jest”, „główna przyczyna”, „regresja”, „samodiagnozowane rozwiązanie”), albo kształt zakresu/projektu („czy w ogóle powinniśmy”, „czy to jest właściwe”, „co jest faktycznie zepsute”, „przemyśl”, „zakwestionuj założenie”). Wybierz opcję sytuacyjną tylko wtedy, gdy sygnał jest wyraźny; w przeciwnym razie domyślnie użyj `/10x-plan`.

```bash
NEXT_CMD="/10x-plan <change-id>"   # default; see above for when to switch to /10x-research or /10x-frame
echo -n "$NEXT_CMD" | pbcopy 2>/dev/null || echo -n "$NEXT_CMD" | clip.exe 2>/dev/null || echo -n "$NEXT_CMD" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard $NEXT_CMD
```

Następnie wyświetl:

```
✓ Created context/changes/<change-id>/change.md (status: new)

Next step:
  → <NEXT_CMD>  (✓ copied to clipboard)

Other options:
  /10x-research <change-id>   — explore the codebase first (when planning needs grounding)
  /10x-frame <change-id>      — challenge the framing first (when the symptom and proposed fix are stated as one, or when the right scope to plan is unclear)
```

Jeśli żadne narzędzie do schowka nie jest dostępne (`pbcopy`, `clip.exe`, `xclip`, `Set-Clipboard`), pomiń adnotację `(✓ copied to clipboard)`, ale nadal wydrukuj sugestię.

## Czego ta umiejętność NIE robi

- Nie zapisuje `frame.md`, `research.md`, `plan.md` ani żadnych innych artefaktów — pochodzą one z odpowiednich umiejętności.
- Nie zapisuje do żadnego pliku stanu sidecar; sekcja `## Progress` w `plan.md` jest jedynym źródłem prawdy o stanie wykonania.
- Nie wymusza przejść statusu — `change.md` jest tylko do zapisu.
- Nie tworzy katalogu nadrzędnego `context/changes/`; jeśli go brakuje, repozytorium nie jest uruchomione dla tej struktury i użytkownik powinien najpierw to rozwiązać.