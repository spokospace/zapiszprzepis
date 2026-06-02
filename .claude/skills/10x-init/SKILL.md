---
name: 10x-init
description: Initialize the /context directory in this project — scaffold context/{changes,archive,foundation}/ plus universal README.md files if absent.
allowed-tools:
  - Read
  - Write
  - Bash
---

# /10x-init — Inicjalizacja katalogu /context

Szkielet katalogu `/context` (`changes/`, `archive/`, `foundation/`) oraz uniwersalny plik `README.md` w każdym z nich, tak aby konwencje śledzenia zmian i dokumentacji podstawowej miały swoje miejsce. Idempotentne: każdy z sześciu artefaktów (3 katalogi + 3 pliki README) jest niezależnie tworzony, jeśli nie istnieje; ponowne uruchomienie w projekcie, w którym wszystko już istnieje, jest operacją bez efektu.

Ta umiejętność jest jawnym punktem wejścia dla użytkowników, którzy chcą od razu przygotować szkielet konwencji przepływu pracy. NIE jest to warunek wstępny dla `/10x-new`, `/10x-archive` ani żadnej umiejętności konsumenckiej — `/10x-new` odmówi, jeśli brakuje `context/changes/`, a `/10x-archive` leniwie tworzy `context/archive/` na żądanie. `/10x-init` istnieje dla użytkowników, którzy wolą najpierw skonfigurować szkielet.

## Proces

### Krok 1: Szkielet `context/changes/` + `README.md`

Jeśli katalog istnieje, pozostaw go bez zmian i zanotuj `present` dla katalogu w podsumowaniu. W przeciwnym razie utwórz go za pomocą `mkdir -p` i zanotuj `created`.

Jeśli `context/changes/README.md` istnieje, pozostaw go bez zmian i zanotuj `present`. W przeciwnym razie zapisz go z tą kanoniczną zawartością (osadzoną w tekście — bez oddzielnego pliku szablonu):

```
# Changes

In-flight changes. One folder per change at `context/changes/<change-id>/`, identified by a `change.md` identity file. Created via `/10x-new`. Holds research, frame, plan, reviews, and other change-scoped artifacts.

When a change is complete, archive it with `/10x-archive` to move it under `context/archive/`.
```

### Krok 2: Szkielet `context/archive/` + `README.md`

Jeśli katalog istnieje, pozostaw go bez zmian i zanotuj `present` dla katalogu. W przeciwnym razie utwórz go za pomocą `mkdir -p` i zanotuj `created`.

Jeśli `context/archive/README.md` istnieje, pozostaw go bez zmian i zanotuj `present`. W przeciwnym razie zapisz go z tą kanoniczną zawartością:

```
# Archive

Completed changes. Folders moved here from `context/changes/` when archived (see `/10x-archive`). Read-only by convention; skills refuse to write here.
```

### Krok 3: Szkielet `context/foundation/` + `README.md`

Jeśli katalog istnieje, pozostaw go bez zmian i zanotuj `present` dla katalogu. W przeciwnym razie utwórz go za pomocą `mkdir -p` i zanotuj `created`.

Jeśli `context/foundation/README.md` istnieje, pozostaw go bez zmian i zanotuj `present`. W przeciwnym razie zapisz go z tą kanoniczną zawartością:

```
# Foundation Docs

Cross-change living documents that span multiple changes. Each project picks which foundation docs it needs (e.g. product requirements, tech-stack, roadmap, glossary, test-stack). Foundation docs are owned by the skills that read and write them; this README describes the conventions that apply to all of them.

## Update convention

**Edit-in-place.** Foundation docs evolve over the lifetime of the project. When something changes incrementally (a new dependency, a refined product goal, a shifted milestone), edit the existing file. Don't create dated copies.

## Archive convention

When a foundation doc is fully superseded — replaced by a new approach rather than refined — move it to `foundation/archive/YYYY-MM-DD-<doc>.md` and write the replacement at the original path. The archive folder is a historical record; nothing reads from it routinely.

## Anti-pattern

Do **not** put change-scoped docs here. Anything tied to a single change (its plan, its research, its review) belongs under `context/changes/<change-id>/`. Foundation is for what outlives any one change.
```

### Krok 4: Wydrukuj podsumowanie

Wydrukuj sześcioliniowy blok statusu:

```
context/changes/                [created|present]
context/changes/README.md       [created|present]
context/archive/                [created|present]
context/archive/README.md       [created|present]
context/foundation/             [created|present]
context/foundation/README.md    [created|present]
```

Następnie jeden akapit przewodnika, do czego służy każdy katalog i gdzie szukać dalej:

- `context/changes/` przechowuje zmiany w toku. Uruchom `/10x-new`, aby utworzyć nowy folder zmiany z plikiem tożsamości `change.md`.
- `context/archive/` przechowuje ukończone zmiany. Uruchom `/10x-archive`, gdy zmiana zostanie zakończona — przeniesie folder z `changes/` do `archive/`.
- `context/foundation/` przechowuje dokumenty żywe obejmujące wiele zmian. Nie ma tutaj stałej listy plików; dokumenty podstawowe są własnością umiejętności, które je zapisują (np. `/10x-prd` zapisuje `prd.md`, `/10x-tech-stack-selector` zapisuje `tech-stack.md`).

Zatrzymaj się. Nie łącz się z `/10x-new` ani żadną inną umiejętnością; użytkownik uruchamia je, gdy ma coś do zrobienia.

## Uwagi

- **Idempotentne.** Ponowne uruchomienie `/10x-init` w projekcie, w którym wszystkie sześć artefaktów już istnieje, jest operacją bez efektu (z wydrukiem statusu). Nigdy nie może nadpisywać istniejącej zawartości.
- **Brak wymuszonego porządku.** Wszystkie sześć artefaktów jest niezależnych. Jeśli istnieją tylko niektóre, utwórz brakujące i pozostaw istniejące bez zmian.
- **Katalogi nadrzędne są tworzone w razie potrzeby.** `context/` może nie istnieć w nowym projekcie — utwórz go niejawnie za pomocą semantyki `mkdir -p` dla każdego katalogu podrzędnego.
- **Nie jest warunkiem wstępnym.** Inne umiejętności samodzielnie uruchamiają swoje pliki. `/10x-init` jest dla użytkowników, którzy lubią konfigurować szkielet `/context` z wyprzedzeniem.
- **`lessons.md` i `contract-surfaces.md` nie są tutaj szkieletowane.** Te pliki są w całości własnością `/10x-lesson`, `/10x-contract` i gałęzi triage `/10x-impl-review`, które samodzielnie je uruchamiają z ich kanonicznymi nagłówkami przy pierwszym użyciu.