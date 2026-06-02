# Reguły projektu zapiszprzepis

## Commit messages — English only

Git commit subjects **and** bodies must be written in English, even when the rest of the work (PR title, PR description, `plan.md`, `change.md`, prompts, conversation) is in Polish.

**Why:** Keeps the git log consistent with the project's already-English file and identifier names (`createSupabaseServerClient`, `signInWithEmail`, …) and with the broader open-source convention. Polish words in Conventional-Commits subjects (observed during F-01 phase commits, e.g. „bootstrap środowiska Supabase", „klienty SSR + proxy") create mixed-language history that future tooling and contributors have to work around.

**How to apply:**
- English in commit subjects and bodies, including the phase-end ritual `<type>(<change-id>): <phase title> (p<N>)` — translate the Polish phase title from `plan.md` to a short English phrase rather than copying verbatim.
- The epilogue commit's "close out plan" body is also English.
- When proposing a commit message via `AskUserQuestion`, draft it in English; the user can still override.
- PR titles/descriptions, `plan.md`, `change.md`, and chat stay in whichever language they were started in. The rule is specific to git commit text.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Moduł 2, Lekcja 5

Skaluj cykl pojedynczej zmiany do pracy równoległej za pomocą **worktrees, delegowania ukierunkowanego na cel i orkiestracji wielu sesji**:

```
worktree per change -> /goal or claude -p -> PR -> review -> merge
```

Lekcja koncentruje się na bezpiecznej przepustowości: izolowanych kontekstach, wyborze odpowiedniego trybu wykonania i ograniczeniu równoległości do zdolności przeglądania.

### Router zadań - Od czego zacząć

| Umiejętność | Użyj, gdy |
| --- | --- |
| **Izolacja kodu** | |
| `git worktree add` | Potrzebujesz oddzielnego katalogu roboczego dla równoległej zmiany. Jedna zmiana na worktree, jeden świeży kontekst agenta na worktree. |
| **Złożone zmiany** | |
| `/10x-implement <change-id> phase <n>` | Zmiana ma wiele faz, wymaga ręcznych bramek lub korzysta z interaktywnego podejmowania decyzji podczas wykonania. |
| **Proste zmiany** | |
| `/goal` | Masz jasne, ograniczone zadanie i chcesz delegowania ukierunkowanego na cel. Agent pracuje autonomicznie w kierunku określonego celu z warunkiem zatrzymania. |
| `claude -p` | Chcesz bezgłowego wykonania dla dobrze zdefiniowanego zadania. Pętla Ralpha Wigguma (uruchom, sprawdź, ponów) to uniwersalny autonomiczny wzorzec. |
| **Orkiestracja wielu sesji** | |
| Superset / Conductor / Antigravity / VS Code Agent View | Uruchamiasz wiele sesji agentów równolegle i potrzebujesz widoczności, koordynacji lub zarządzania sesjami między nimi. |

### Zasady pracy równoległej

- Jedna zmiana na worktree lub izolowany obszar roboczy. Jeden świeży kontekst agenta na zmianę.
- Wybierz interaktywne `/10x-implement` dla złożonych zmian, `/goal` lub `claude -p` dla prostych.
- Równoległość jest ograniczona przez zdolność przeglądania. Więcej agentów bez przeglądu oznacza więcej nieprzejrzanego kodu, a nie wyższą przepustowość.
- Ból jakości wynikający z szybszej wysyłki jest zamierzony — łączy się z bramkami testowymi Modułu 3.

### Granice lekcji

- Nie ucz ponownie interaktywnego `/10x-implement` ani `/10x-impl-review`; to są Lekcje 2 i 3.
- Nie wprowadzaj tutaj strategii testowania. Ból jakości jest motywacją dla Modułu 3.
- Worktrees to mechanizm izolacji, a nie temat pełnego samouczka git.

### Ścieżki używane w tej lekcji

- `context/changes/<change-id>/` - aktywny folder zmiany
- `context/changes/<change-id>/plan.md` - dane wejściowe implementacji dla dowolnego trybu wykonania

Umiejętności nie mogą zapisywać do `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozwiązana ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
