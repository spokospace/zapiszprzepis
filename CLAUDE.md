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

## 10xDevs AI Toolkit — Moduł 3, Lekcja 1

Rozpocznij Moduł 3, tworząc **trwałą umowę jakościową opartą na ryzyku** przed napisaniem jakiegokolwiek testu — a następnie przeprowadzaj każdą fazę wdrożenia przez standardowy łańcuch zmian.

```
PRD + mapa drogowa + archiwum
        │
        ▼
   /10x-test-plan  ──►  context/foundation/test-plan.md  (strategia §1–§5 zamrożona + książka kucharska §6 rośnie)
        │
        ▼  (jedna faza wdrożenia na raz, /clear między przekazaniami)
   /10x-new ──► /10x-research ──► /10x-plan ──► /10x-implement
```

`/10x-test-plan` to **stanowy orkiestrator**, a nie jednorazowy generator. Przy pierwszym uruchomieniu zapisuje fazowe wdrożenie do `context/foundation/test-plan.md`. Przy każdym kolejnym uruchomieniu ponownie wyprowadza stan z artefaktów na dysku i przedstawia następne przekazanie. Lekcja koncentruje się na **strategii i sekwencjonowaniu wdrożenia, a nie na konfiguracji**. Hooki, serwery MCP i YAML CI są konfigurowane w późniejszych lekcjach tego modułu.

### Router zadań — Od czego zacząć

| Umiejętność | Kiedy jej użyć |
| --- | --- |
| **Strategia jakości jako plik reguł (fokus lekcji)** | |
| `/10x-test-plan` | Masz PRD (i idealnie mapę drogową oraz kilka zarchiwizowanych fragmentów) i zamierzasz napisać pierwsze testy projektu, lub zauważyłeś, że testy generowane przez AI lądują na pomocnikach, podczas gdy krytyczne przepływy pozostają niepokryte. Pierwsze wywołanie uruchamia odkrywanie (PRD + mapa drogowa + archiwum + skan gorących punktów), 5-pytaniowy wywiad z użytkownikiem i przejście syntezy z obowiązkową kontrolą challengera, a następnie zapisuje `test-plan.md` w `context/foundation/` z mapą ryzyka (5–7 scenariuszy awarii), tabelą fazowego wdrożenia, tabelą stosu, tabelą bramek jakości, sekcją książki kucharskiej (`§6`, wypełnia się w miarę realizacji faz) i sekcją przestrzeni negatywnej (czego celowo nie testujemy). Kolejne wywołania posuwają wdrożenie o jedno przekazanie na raz. |
| `/10x-test-plan --status` | `test-plan.md` już istnieje i chcesz uzyskać zwięzłą migawkę stanu wdrożenia — które fazy są `not started`, `change opened`, `researched`, `planned`, `implementing` lub `complete`, i jakie jest następne działanie. Nie wykonuje żadnej pracy; bezpieczne do uruchomienia w dowolnym momencie. |
| `/10x-test-plan --refresh` | `test-plan.md` już istnieje i jedno z: pojawiło się nowe ryzyko z top-3 z mapy drogowej lub archiwum, data `checked:` narzędzia jest starsza niż trzy miesiące, zmienił się stos technologiczny projektu, lub §7 przestrzeń negatywna nie odpowiada już temu, w co wierzy zespół. Otwiera nowy folder zmian `test-plan-refresh-<RRRR-MM-DD>` zamiast edytować przewodnik na miejscu. |

### Łańcuch wdrożenia — co dzieje się po napisaniu przewodnika

Tabela §3 *Phased Rollout* przewodnika jest stanem orkiestratora. Dla każdego wiersza innego niż `complete` orkiestrator wybiera następne przekazanie na podstawie tego, które artefakty istnieją w `context/changes/<change-id>/`:

| Stan na dysku | Następne przekazanie | Status zmienia się na |
| --- | --- | --- |
| brak folderu zmian | `/10x-new <change-id>` | `change opened` |
| tylko `change.md` | `/10x-research` (z krótkim opisem ryzyk do zweryfikowania) | `researched` |
| `+ research.md` | `/10x-plan` (z ograniczeniami koszt × sygnał + aktualizacja książki kucharskiej) | `planned` |
| `+ plan.md` z oczekującymi elementami `## Progress` | `/10x-implement <change-id> phase <N>` | `implementing` / `complete` |
| `+ plan.md` w pełni `[x]` | Oznacz wiersz §3 jako `complete`; przejdź do następnego oczekującego wiersza | — |

Każde przekazanie to **punkt STOP**. Orkiestrator kopiuje następne polecenie do schowka, prosi użytkownika o `/clear` i uruchomienie go, a następnie kończy działanie. Ponownie wywołaj `/10x-test-plan` (bez argumentów), aby przejść dalej.

### Reguły priorytetyzacji opartej na ryzyku

- Ryzyka to **scenariusze awarii w kategoriach użytkownika / biznesowych**, a nie nazwy testów. „Wylogowany użytkownik uzyskuje dostęp do płatnych treści za pomocą nieaktualnego tokena” to ryzyko; „testowanie formularza logowania” nie.
- Od 5 do 7 ryzyk. Mniej jest zbyt ogólne; więcej sprawia, że priorytetyzacja jest bezużyteczna.
- Wpływ i prawdopodobieństwo to oceny użytkownika/biznesu, a nie złożoność techniczna.
- Każde ryzyko ma swoje źródło: sekcja PRD, zarchiwizowany fragment, wpis w mapie drogowej, pytanie z wywiadu Fazy 2, **katalog** gorących punktów z liczbą zmian, lub ograniczenie stosu technologicznego. Brak wymyślonych ryzyk.
- **Sygnał, a nie wiedza.** §2 cytuje *dowody, które podniosły ryzyko*, nigdy plik jako „miejsce, w którym występuje awaria”. Kotwice plik:linia, nazwy funkcji, nazwy schematów i nazwy modułów są zabronione w §2 — należą do danych wyjściowych `/10x-research`, generowanych dla każdej fazy wdrożenia w stosunku do bieżącego kodu. Plan jest specyfikacją QA; nie jest audytem kodu.
- Pokrycie nie jest metryką. **Pokrycie ryzyka** jest metryką.

### Reguły mapowania dwuwarstwowego

- Najpierw warstwa klasyczna: wygrywa najtańszy test, który daje prawdziwy sygnał. Promuj do e2e tylko wtedy, gdy żadna tańsza warstwa nie pokrywa ryzyka.
- Druga warstwa natywna dla AI, i tylko tam, gdzie dodaje sygnał, którego klasyczne testy nie dają tanio.
- Każdy wiersz natywny dla AI ma linię **„Kiedy NIE używać”**. Jeśli nie możesz jej napisać, usuń wiersz.
- Każda nazwa narzędzia zawiera datę `checked: <RRRR-MM-DD>`. Nazwy narzędzi są przykładami kategorii, a nie rekomendacjami.
- Obie warstwy muszą być niepuste w ostatecznym przewodniku, jeśli projekt tego wymaga. Tylko klasyczna to plan z 2020 roku; tylko natywna dla AI to szum. Fazy natywne dla AI nie są obowiązkowe — włącz je tylko wtedy, gdy brief uzasadniał je pod względem kosztu × sygnału.

### Reguły bramek jakości

- Wymagane bramki (lint, typecheck, unit+integration, e2e na krytycznych przepływach) muszą odpowiadać rzeczywistym krokom CI. Jeśli wymagana bramka nie jest jeszcze podłączona, oznacz ją jako `required after §3 Phase <N>` i pozwól nazwanej fazie wdrożenia ją podłączyć.
- Hook po edycji jest **zalecany lokalnie**, a nie jako substytut CI.
- Wielomodalny przegląd wizualny jest **selektywny**, stosowany do 1–3 krytycznych ekranów, a nie do każdej strony.
- Awaryjne rozwiązanie oparte na wizji (Anthropic Computer Use lub OpenAI CUA) jest zarezerwowane dla powierzchni niedostępnych dla DOM; drogie na akcję.

### Wzorce książki kucharskiej (§6) — wypełnia się z czasem

`test-plan.md` to zarówno fazowa strategia, jak i **rosnąca książka kucharska**. §6 zaczyna się jako miejsca docelowe (`TBD — see §3 Phase <N>`) i wypełnia się stopniowo — plan każdej fazy wdrożenia kończy się podfazą, która aktualizuje odpowiedni wpis w §6 (lokalizacja, nazewnictwo, test referencyjny, polecenie uruchomienia). Po zakończeniu Modułu 3, §6 staje się kanoniczną odpowiedzią na pytanie „jak dodać test dla X w tym projekcie?” — i to, co `/10x-tdd` czyta w Lekcji 2.

### Granice lekcji

- Nie pisz kodu testowego. To jest Lekcja 2 (`/10x-tdd` i tworzenie testów jednostkowych).
- Nie konfiguruj hooków, cyklu życia hooków ani hooków debugowania. To jest Lekcja 3.
- Nie konfiguruj serwerów MCP, API Playwright, kodu e2e ani kodu scenariuszy multimodalnych. To jest Lekcja 4.
- Nie uruchamiaj przepływu pracy od błędu do poprawki do testu regresji. To jest Lekcja 5.
- Nie twórz potoków CI/CD od podstaw ani nie pisz YAML GitHub Actions. Przewodnik nazywa bramki; konfiguracja jest własnością Modułu 1 Lekcji 5 i Modułu 2 Lekcji 5.
- Nie testuj modeli multimodalnych. Cytuj kryteria (koszt, opóźnienie, przyjazność dla agenta), nigdy ranking.
- Nie czytaj bazy kodu w celu zdobycia wiedzy (grafy wywołań, schematy, „który plik jest właścicielem tej awarii”). To jest zadanie `/10x-research`, dla każdej fazy wdrożenia.

### Ścieżki używane w tej lekcji

- `context/foundation/test-plan.md` — umowa jakościowa tworzona i utrzymywana przez `/10x-test-plan`
- `context/foundation/prd.md` — główne źródło ryzyka
- `context/foundation/roadmap.md` — ważenie prawdopodobieństwa
- `context/foundation/tech-stack.md` — dane wejściowe stosu (jeśli są obecne)
- `context/archive/<change-id>/plan.md` — zaimplementowana powierzchnia ryzyka
- `context/changes/<change-id>/` — folder zmian dla każdej fazy wdrożenia (jeden na wiersz w §3)

<!-- END @przeprogramowani/10x-cli -->
