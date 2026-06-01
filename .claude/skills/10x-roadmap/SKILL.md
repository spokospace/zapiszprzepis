---
name: 10x-roadmap
description: >
  Generate context/foundation/roadmap.md from a PRD as an ordered set of
  vertical, end-to-end slices. Use AFTER /10x-prd (and after the tech-stack
  selection / bootstrap step, when applicable) to turn a holistic PRD into a
  sequence of user-visible milestones a programmer can pick off and hand to
  /10x-plan. Trigger phrases: "write the roadmap", "generate roadmap",
  "create the roadmap from PRD", "stwórz roadmapę", "turn PRD into a
  roadmap", "what should I build first". Do NOT use for per-change planning
  — that's /10x-plan's job.
argument-hint: "[path-to-prd]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---

# Mapa drogowa: Generowanie context/foundation/roadmap.md z PRD

Ta umiejętność stanowi pomost między **produktem** (PRD) a **planowaniem zmian** (`/10x-plan`). Jej jedyne zadanie: przeczytać PRD, automatycznie zbadać bazę kodu, **wywnioskować decydującą propozycję sekwencjonowania** (główny cel, kluczowy wycinek, obszary inwestycji, główna blokada), ujawnić tylko prawdziwą niepewność, której PRD nie może rozwiązać, i wygenerować plik `context/foundation/roadmap.md`, który zawiera pionowe, widoczne dla użytkownika wycinki w kolejności zależności — gotowe do przekazania do `/10x-plan <change-id>`.

**Postawa: opiniotwórczy rekomendator, oszczędny wywiad.** Umiejętność działa jak doświadczony lider techniczny, który przeczytał PRD, zbadał bazę kodu i przedstawił rekomendację — ale który nadal zadaje człowiekowi 2-3 kluczowe pytania, zanim się zaangażuje. Domyślny kształt Kroku 5 to **ograniczony wywiad**: maksymalnie trzy pytania kotwiczące (główny cel, kluczowy wycinek, główna blokada), każde przedstawione jako jedna **silna Rekomendacja** oparta na cytacie z artefaktu, plus 1-2 alternatywy z jednowierszowym uzasadnieniem „dlaczego to również jest rozsądne”. Użytkownik wybiera Rekomendację, wybiera alternatywę lub nadpisuje ją własnymi słowami. Obszary inwestycji są *wyprowadzane* z odpowiedzi, a nie zadawane. Dwa tryby awarii, których należy unikać: **(a) performatywne przesłuchanie** — zadawanie pytań, na które artefakty już odpowiadają, lub zadawanie więcej niż trzech pytań; **(b) fałszywa pewność siebie** — ciche decydowanie o kluczowym ujęciu bez oferowania człowiekowi prawdziwego wyboru. Jedynym wyjątkiem są prawdziwie niestandardowe kształty MVP (nieznany wzorzec SaaS / CRUD / treści / AI-wrapper) — tam agent dopuszcza do dwóch pytań uzupełniających oprócz pytań kotwiczących, ponieważ intuicja projektowa wykonuje więcej pracy niż artefakty.

Jest to umiejętność **dekompozycji + sekwencjonowania**, a nie planowania niskopoziomowego. NIGDY nie wybiera frameworków, ścieżek plików, schematów, bibliotek ani szczegółów implementacji — to należy do `/10x-plan`. NIGDY nie przypisuje szacunków czasowych, rozmiarów koszulek, punktów ani dat kalendarzowych — wykonanie agentowe jest nieliniowe, a szacunki budżetowane czasowo byłyby kłamstwem. Co ONA ROBI: nazywa wycinki, sekwencjonuje je według zależności i określonego celu, ujawnia, co blokuje, i kieruje otwarte pytania tam, gdzie można je rozwiązać.

Umiejętność jest **AI-natywna** na cztery konkretne sposoby: (1) wyraża kolejność jako graf zależności, a nie kalendarz; (2) oznacza wycinki, które mogą być wykonywane równolegle przez oddzielne uruchomienia agentów; (3) wypycha „blokujące niewiadome” tam, gdzie człowiek może je rozwiązać, zamiast pozwalać im cicho wślizgnąć się do implementacji; (4) inwentaryzuje istniejącą bazę kodu za pomocą subagentów, zamiast pytać użytkownika, co już jest na miejscu.

## Kiedy używać, kiedy pominąć

**Użyj, gdy**: `context/foundation/prd.md` istnieje z nietrywialną zawartością (wypełnione FR i historyjki użytkownika, obecna logika biznesowa) ORAZ użytkownik chce wiedzieć, co zbudować najpierw / w jakiej kolejności. Typowe wyzwalacze: właśnie zakończono `/10x-prd`, właśnie zakończono bootstrap, lub powrót do projektu i pytanie „co dalej”.

**Pomiń, gdy**: PRD jest puste (duże `## Open Questions`, `# TODO: domain rule`) — najpierw wskaż `/10x-prd` (lub nadrzędne `/10x-shape`); mapa drogowa z pustego PRD odziedziczy pustkę. Pomiń również, gdy użytkownik chce szczegółowo zaplanować *pojedynczą* zmianę — to jest zadanie `/10x-plan`. Mapa drogowa jest liczbą mnogą; plan jest liczbą pojedynczą.

## Związek z innymi umiejętnościami

- `/10x-shape` i `/10x-prd` — tworzą nadrzędne PRD, które ta umiejętność konsumuje. Jeśli `shape-notes.md` zawiera blok `## Forward: technical-roadmap` (gdzie kształt parkuje zawartość przeznaczoną dla mapy drogowej), ta umiejętność go podnosi.
- `10x-tech-stack-selector` — uruchamia się między `/10x-prd` a tą umiejętnością w łańcuchu bootstrap. Jeśli `context/foundation/tech-stack.md` istnieje, ta umiejętność odczytuje go jako dane wejściowe do wyprowadzenia `## Foundations` (szkielet uwierzytelniania, szkielet wdrożenia, obserwowalność — wszystko, co implikował krok wyboru stosu technologicznego) i do skrócenia sond bazowych dla już zadeklarowanych warstw.
- `/10x-plan` — konsument niższego poziomu. Użytkownik wybiera element mapy drogowej i wywołuje `/10x-plan <change-id>`; ta umiejętność tworzy folder zmiany i tworzy szczegółowy plan. Mapa drogowa NIE tworzy wstępnie folderów zmian; jeden wycinek może wygenerować wiele zmian, gdy `/10x-plan` odkryje, że element jest nadal zbyt szeroki.
- `/10x-implement` — dalej w dół. Pośrednie stany cyklu życia (`status: planning`, `in-progress`) są tutaj zdefiniowane, ale **nie są jeszcze podłączone** w `/10x-plan` i `/10x-implement`; dziś ta umiejętność zapisuje tylko `proposed` / `ready` / `blocked`. Przyszłe prace podłączą stany pośrednie.
- `/10x-archive` — zamyka pętlę na końcu. Gdy zmiana, której `Change ID` odpowiada elementowi mapy drogowej, zostanie zarchiwizowana, `/10x-archive` zmienia `Status` tego elementu na `done` (w `## At a glance` i w bloku treści elementu) i dodaje wpis do `## Done`. Ta umiejętność nigdy nie wypełnia wstępnie `## Done`; `/10x-archive` jest jej jedynym autorem.
- `/10x-frame`, `/10x-research` — ortogonalne. Działają na pojedynczej zmianie, a nie na mapie drogowej.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano argument ścieżki** (np. `/10x-roadmap @path/to/prd.md`), przechwyć go jako ścieżkę PRD. Przejdź do Kroku 1.
2. **Jeśli nie podano argumentu**, domyślnie ustaw ścieżkę PRD na `context/foundation/prd.md` i przejdź do Kroku 1. Nie pytaj jeszcze — Krok 1 obsługuje przypadek brakującego wejścia.

## Interaktywne monity — niezależne od hosta

Zawsze, gdy procedura mówi „zapytaj użytkownika”, użyj dowolnego narzędzia do interaktywnych pytań, które udostępnia agent hosta. Umiejętność jest niezależna od hosta; nie koduj na stałe nazwy jednego narzędzia do wykonania. Znane odpowiedniki (niepełna lista):

- Claude Code → `AskUserQuestion`
- Cursor → `ask_question`
- OpenAI Codex / Codex CLI → `request_user_input`
- Inne uprzęże → szukaj dowolnego narzędzia, którego opis wspomina o zadawaniu użytkownikowi ustrukturyzowanego pytania z opcjami.

**Zasada samodzielnego odkrywania.** Przed pierwszym interaktywnym krokiem przeskanuj dostępne narzędzia w poszukiwaniu takiego, które pasuje do powyższych wzorców (nazwy zawierające `ask`, `question`, `input`, `prompt_user` itp., z parametrem `question` lub `prompt` i polem `options`/`choices`). Użyj pierwszego dopasowania. Jeśli żadne nie jest dostępne, wróć do zwykłej wiadomości konwersacyjnej, prosząc użytkownika o odpowiedź jedną z oznaczonych opcji — nie blokuj procedury.

Podaj, które narzędzie wybrałeś (lub że wróciłeś do zwykłego czatu) za pierwszym razem, gdy zadajesz pytanie, aby użytkownik mógł cię poprawić, jeśli istnieje lepsza opcja.

Narzędzie do interaktywnych pytań jest używane w Krokach 1, 3, 4, 5 i 9 (brakujące dane wejściowe, gotowość PRD, potwierdzenie bazowe, 2-3 kotwice ramowe, kolizja plików) — krótkie, ustrukturyzowane wybory. Krok 5 zadaje każdą kotwicę jako własne ustrukturyzowane pytanie; podsumowanie syntezy na końcu Kroku 5 to zwykły markdown (bez dodatkowego pytania).

## Równoległe badania bazowe — niezależne od hosta

Zawsze, gdy procedura mówi o użyciu subagentów lub uruchomieniu równoległych sond, użyj dowolnego narzędzia do badań w tle / tworzenia zadań, które udostępnia host. Znane odpowiedniki (niepełna lista):

- Claude Code → `Agent` z typem subagenta Explore/ogólnego przeznaczenia
- Cursor → agenci w tle / zadania delegowane
- OpenAI Codex → narzędzia do delegowania zadań, jeśli są dostępne
- Inne uprzęże → szukaj dowolnego narzędzia, które tworzy izolowanego agenta z własnym oknem kontekstowym i zwraca podsumowanie.

**Zasada samodzielnego odkrywania.** Przed Krokiem 4 sprawdź, czy takie narzędzie istnieje. Jeśli tak, rozdziel sondy bazowe w jednym wywołaniu wsadowym. Jeśli nie, uruchom te same sondy sekwencyjnie w głównym kontekście. Obie ścieżki muszą zwrócić ten sam kształt podsumowania bazowego z dowodami plików.

## Proces

### Krok 1: Zlokalizuj i przeczytaj PRD

Rozwiąż ścieżkę wejściową:

- Jeśli argument został przekazany, użyj go dosłownie (usuń początkowe `@`, jeśli jest obecne).
- W przeciwnym razie domyślnie ustaw na `context/foundation/prd.md`.

```bash
test -f "<resolved-path>"
```

Jeśli plik istnieje, **przeczytaj go W CAŁOŚCI** (bez `limit`/`offset`).

Jeśli nie istnieje, zapytaj za pomocą wybranego narzędzia do interaktywnych pytań:

Pytanie interaktywne:
- question: "Nie znaleziono PRD pod adresem `<resolved-path>`. Jak chcesz postąpić?"
  header: "Dane wejściowe?"
  options:
  - label: "Najpierw uruchom /10x-prd (zalecane)"
    description: "Zatrzymaj się tutaj. Uruchom /10x-prd, aby utworzyć prd.md, a następnie ponownie wywołaj /10x-roadmap."
  - label: "Podaj inną ścieżkę"
    description: "Poczekam, aż podasz mi ścieżkę."
  - label: "Anuluj"
    description: "Wyjdź bez zmian."
  multiSelect: false

W przypadku "Najpierw uruchom /10x-prd": wydrukuj wiadomość o przekierowaniu i ZATRZYMAJ SIĘ.

### Krok 2: Odczytaj dodatkowe dane wejściowe (najlepszy wysiłek)

Przeczytaj je, jeśli istnieją; w przeciwnym razie zanotuj ich brak i kontynuuj:

- `context/foundation/shape-notes.md` — poszukaj sekcji `## Forward: technical-roadmap`. Jeśli jest obecna, podnieś jej punkty dosłownie jako kandydatów na dane wejściowe mapy drogowej (użytkownik już je tam umieścił podczas kształtowania).
- `context/foundation/tech-stack.md` — informuje sekcję `## Foundations` ORAZ skraca sondy bazowe (warstwa już zadeklarowana tutaj jest zgłaszana jako „zgodnie z tech-stack.md” bez ponownego sondowania).
- `context/foundation/roadmap.md` — jeśli już istnieje, zachowaj go dla Kroku 9 (obsługa kolizji). NIE modyfikuj go jeszcze.
- `context/foundation/lessons.md` — jeśli jest obecny, przeskanuj w poszukiwaniu wszelkich zasad dotyczących kolejności lub gotowości (np. „zawsze wysyłaj najbardziej ryzykowny wycinek jako pierwszy”). Traktuj jako priorytety, a nie jako ewangelię.

### Krok 3: Sprawdzenie gotowości PRD

Przed generowaniem oceń PRD na podstawie heurystyki gotowości 0–4. Każdy sygnał przyczynia się 1 punkt:

1. **Wizja i problem są nietrywialne** — sekcja istnieje, zawiera ≥ 2 zdania, NIE zawiera `# TODO`.
2. **Co najmniej jedna wypełniona historyjka użytkownika** — istnieje nagłówek `### US-NN:` z blokiem Given/When/Then pod nim (nie `# TODO`).
3. **Co najmniej jeden `must-have` FR** — istnieje linia pasująca do `^- FR-\d{3}: .* (P|p)riority: must-have$`.
4. **Wypełniona logika biznesowa** — pierwsza niepusta linia sekcji `## Business Logic` to zdanie deklaratywne (nie `# TODO: domain rule`).

Dokumentuj heurystykę wyraźnie w rozmowie:

```
Sprawdzenie gotowości PRD (heurystyka, 4 sygnały, po 1 punkcie):
  [✓|✗] Wizja i problem nietrywialne
  [✓|✗] ≥ 1 wypełniona historyjka użytkownika
  [✓|✗] ≥ 1 must-have FR
  [✓|✗] Wypełniona logika biznesowa

  Wynik: <N>/4
  Otwarte pytania w PRD: <liczba>
```

**Wynik ≥ 3**: PRD jest gotowe do mapy drogowej; przejdź do Kroku 4.

**Wynik < 3**: wyraźnie ostrzeż. Nazwij, czego brakuje i dlaczego ma to znaczenie dla mapy drogowej (NIE ogólne „twoje PRD jest cienkie”):

```
To PRD uzyskało <N>/4 w heurystyce gotowości mapy drogowej. Brakujące sygnały:

  - <nazwa sygnału>: <jednowierszowa konsekwencja dla mapy drogowej>
  - ...

Mapa drogowa wygenerowana z pustego PRD będzie miała wiele wycinków oznaczonych jako Status:
zablokowane, a ich pierwszą niewiadomą będzie luka w PRD. Jest to prawidłowy stan pośredni
— mapa drogowa ujawnia, co blokuje — ale jeśli masz czas na ugruntowanie
PRD najpierw, wynikowa mapa drogowa będzie znacznie bardziej użyteczna.
```

Następnie zapytaj za pomocą wybranego narzędzia do interaktywnych pytań:

Pytanie interaktywne:
- question: "Jak chcesz postąpić?"
  header: "Cienkie PRD"
  options:
  - label: "Najpierw ugruntuj PRD (zalecane)"
    description: "Zatrzymaj się tutaj. Rozwiąż otwarte pytania / TODO w PRD, a następnie ponownie wywołaj /10x-roadmap."
  - label: "Kontynuuj mimo wszystko"
    description: "Generuj z tego, co jest. Puste obszary pojawią się jako zablokowane wycinki z luką w PRD jako ich niewiadomą."
  - label: "Anuluj"
    description: "Wyjdź bez zmian."
  multiSelect: false

W przypadku "Najpierw ugruntuj PRD": wydrukuj przekierowanie i ZATRZYMAJ SIĘ. W przypadku "Kontynuuj mimo wszystko": kontynuuj z zapisanym wynikiem, aby Krok 6 mógł oznaczyć cienkie obszary.

### Krok 4: Automatyczne badanie bazowe

Ocena „co już jest na miejscu” nie powinna spoczywać na użytkowniku — baza kodu jest źródłem prawdy. Użyj wybranego narzędzia do badań w tle / tworzenia zadań, jeśli jest dostępne, aby inwentaryzować każdą warstwę równolegle. Jeśli takie narzędzie nie istnieje, uruchom te same sondy sekwencyjnie w głównym kontekście. Każda sonda zwraca jednoparograficzny werdykt: **obecny** (z dowodami plików), **nieobecny** lub **częściowy** (szkielet istnieje, ale nie jest podłączony). Następnie przedstaw inwentaryzację do potwierdzenia przez użytkownika, zanim zostanie ona przekazana do Foundations.

**Warstwy do sondowania** (pomiń warstwę, jeśli `tech-stack.md` już nazywa wybór tej warstwy — zgłoś „zgodnie z tech-stack.md: <wybór>” zamiast sondowania):

| Warstwa          | Czego szuka sonda                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Frontend       | Framework UI, narzędzia do budowania, routing, biblioteki komponentów — zależności `package.json`, pliki konfiguracyjne frameworka           |
| Backend / API  | Framework serwera, trasy API, obsługi żądań — punkty wejścia, pliki tras, kontrolery                            |
| Dane           | Sterownik DB, ORM/konstruktor zapytań, narzędzia do schematów/migracji, dane początkowe — pliki schematów, katalogi migracji         |
| Uwierzytelnianie           | Integracja dostawcy uwierzytelniania, obsługa sesji/tokenów, middleware uwierzytelniania — konfiguracja uwierzytelniania, pliki middleware                |
| Wdrożenie / infrastruktura | Cel hostingu, konfiguracja kontenera, przepływy pracy CI/CD, infrastruktura jako kod — `Dockerfile`, `.github/workflows`, YAML wdrożenia |
| Obserwowalność  | Biblioteka logowania, śledzenie błędów, metryki, pulpity nawigacyjne — importy sentry/datadog/otel, middleware logowania                |

**Uruchom wszystkie sondy w jednym delegowaniu wsadowym, gdy host to obsługuje.** Każdy monit jest krótki i samodzielny; delegowani agenci zwracają tylko po jednym akapicie, więc główny kontekst pozostaje mały. Przykład dla uwierzytelniania:

> Zrób inwentaryzację warstwy uwierzytelniania/tożsamości tej bazy kodu. Zgłoś w mniej niż 100 słowach: (1) czy istnieje integracja dostawcy uwierzytelniania? Nazwij ją. (2) Czy istnieją ścieżki kodu do wydawania lub weryfikacji sesji/tokenów? Podaj plik:linię. (3) Czy istnieje middleware uwierzytelniania na poziomie trasy? Podaj. Jeśli warstwa jest nieobecna, powiedz „nieobecna” — nie spekuluj. Nie sugeruj zmian. Nie pisz ani nie edytuj plików.

Dostosuj ten sam szablon dla każdej warstwy. Zawsze wymagaj: werdyktu obecny/nieobecny/częściowy, ≤ 100 słów, dowodów plików, gdy są obecne, bez spekulacji, bez edycji.

Po powrocie wszystkich sond, przedstaw użytkownikowi jednowierszowe podsumowanie bazowe:

```
Baza kodu (automatycznie zbadana):

  Frontend:      <obecny | nieobecny | częściowy> — <jedna linia, ze wskaźnikiem pliku>
  Backend/API:   <…>
  Dane:          <…>
  Uwierzytelnianie:   <…>
  Wdrożenie/infra:  <…>
  Obserwowalność: <…>
```

Następnie potwierdź:

Pytanie interaktywne:
- question: "Czy ta baza odpowiada Twojemu zrozumieniu? Coś do poprawienia lub dodania, zanim zostanie użyta w Foundations?"
  header: "Baza"
  options:
  - label: "Wygląda dobrze — kontynuuj"
    description: "Użyj tej bazy jako danych wejściowych dla Foundations i sekcji ## Baseline mapy drogowej."
  - label: "Popraw jedną lub więcej warstw — wyjaśnię"
    description: "Swobodna korekta. Ponownie zapiszę warstwę(y) przed kontynuowaniem."
  - label: "Dodaj coś, czego nie ma na liście"
    description: "Swobodna forma. Rzeczy, których sondy nie zauważyły (zaplanowane, ale niepodłączone, szkielet z innego repozytorium itp.)."
  multiSelect: true

Zapisz potwierdzoną bazę. Bezpośrednio zasila Krok 6a (Foundations): warstwy **obecne** → Foundations je pomija; **nieobecne** lub **częściowe** → otwiera się slot Foundations. Zasila również sekcję `## Baseline` mapy drogowej dosłownie.

### Krok 5: Oszczędny wywiad — 2-3 pytania kotwiczące, każde z silną Rekomendacją

PRD zawiera **produkt**. Baza (Krok 4) zawiera **to, co już istnieje**. Ten krok tworzy ramy mapy drogowej — `main_goal`, `north_star`, obszary inwestycji, `top_blocker` — poprzez ograniczony wywiad: maksymalnie **trzy pytania kotwiczące**, każde zawierające jedną silną **Rekomendację** opartą na cytacie z artefaktu, plus 1-2 alternatywy z jednowierszowym uzasadnieniem „dlaczego to również jest rozsądne”. Użytkownik wybiera Rekomendację, wybiera alternatywę lub swobodnie nadpisuje. Umiejętność nigdy nie zadaje więcej niż 3 pytań kotwiczących; obszary inwestycji są *wyprowadzane* z odpowiedzi, a nie zadawane.

To jest złoty środek między dwoma trybami awarii, przez które przeszła ta umiejętność: ciche automatyczne ramowanie (fałszywa pewność siebie, brak ludzkiej bramki na kluczowe wywołania) i nieograniczone odkrywanie (performatywne przesłuchanie, zadaje pytania, na które artefakty już odpowiadają). Mapa drogowa zbudowana na trzech prawdziwych wyborach, których użytkownik dokonał z otwartymi oczami, jest trwalsza niż ta zbudowana na którejkolwiek z tych skrajności.

Jeśli `shape-notes.md` zawierał blok `## Forward: technical-roadmap`, podnieś go jako silny priorytet — włącz go do Rekomendacji, nie wywołuj ponownie treści, które użytkownik już tam umieścił.

**5a. Wywnioskuj rekomendacje i alternatywy, które są faktycznie rozsądne.**

Dla każdej kotwicy poniżej, wywnioskuj *zarówno* Rekomendację, JAK I alternatywy — oparte na konkretnych cytatach z frontmatter PRD / `## Vision` / `## Success Criteria` / `## NFRs` / `## Open Questions` / baseline / `tech-stack.md`. Alternatywa jest „rozsądna” tylko wtedy, gdy prawdziwy sygnał w artefaktach ją wspiera LUB jest to powszechna, możliwa do obrony wartość domyślna dla kształtu produktu. **Nie wymieniaj słomianych kukieł.** Jeśli tylko jedna wartość jest wiarygodna (żadna prawdziwa alternatywa nie jest możliwa do obrony na podstawie artefaktów), powiedz to — ta kotwica zostanie przedstawiona z jedną Rekomendacją i opcją awaryjną „nadpisz własnymi słowami”.

- **`main_goal`** — wybierz z `market-feedback` | `quality` | `low-complexity` | `speed` | `learn` | `other`. Sygnały: `timeline_budget` (ciasny → szybkość lub niska złożoność), `target_scale` (mały → niska złożoność; masowy → jakość), sformułowanie Kryteriów Sukcesu („uczyć się od prawdziwych użytkowników” → market-feedback; „zweryfikować najbardziej ryzykowne założenie” → market-feedback; „brak incydentów przy uruchomieniu” → jakość), ton Wizji (eksploracyjne hobby → uczyć się; twardy termin → szybkość). Alternatywy to *sąsiednie* wartości, które te same dowody mogłyby rozsądnie wspierać — np. `market-feedback` i `speed` często współistnieją, gdy PRD mówi „wysyłaj, aby szybko się uczyć”.

- **`north_star`** — najmniejszy, kompleksowy, widoczny dla użytkownika przepływ, który, jeśli zostanie wysłany jako pierwszy, udowadnia podstawową hipotezę Wizji PRD. Zazwyczaj odnosi się do US-NN o wysokim priorytecie ORAZ głównego Kryterium Sukcesu. Rozsądne alternatywy to *inne* wycinki kandydujące, które również odnoszą się do głównego Kryterium Sukcesu lub do US-NN o wysokim priorytecie, z mniejszą liczbą Wymagań wstępnych lub z różnymi konsekwencjami sekwencjonowania. Gdy istnieje więcej niż trzech kandydatów, przedstaw trzech najlepszych.

- **`top_blocker`** — wybierz z `skills` | `capacity` | `time` | `decisions` | `external` | `motivation` | `none`. Sygnały: ≥ 3 nierozwiązane `## Open Questions` w PRD → `decisions`; ambitny zakres vs. niedopasowanie `timeline_budget` → `time` lub `capacity`; zależność od dostawcy nazwana w PRD, która nie została jeszcze zakontraktowana → `external`; stos technologiczny wymienia warstwę, której zespół nigdy nie wysłał → `skills`; żadne nie uruchamia → `none`. Rozsądne alternatywy to *sąsiednie* typy blokad, które uruchamiają się na podobnych sygnałach — np. `time` i `capacity` często uruchamiają się na napięciu między zakresem a terminem.

- **Obszary inwestycji** (NIE pytane — wyprowadzane w 5d) — dla każdego z `frontend`, `backend`, `data`, `infra`: zdecyduj `invest deeply` vs `go simple`. Sygnały: NFR PRD, które blokują uruchomienie w warstwie (prywatność / opóźnienie / poprawność → inwestuj tam), luki bazowe, które odpowiadają must-have PRD (brak uwierzytelniania + must-have dla wielu użytkowników → inwestuj w uwierzytelnianie), otwarte pytania skoncentrowane w jednej warstwie (nierozwiązane decyzje tam → inwestuj), i wybrany `main_goal` (`quality` wzmacnia warstwy prywatności/obserwowalności; `learn` wzmacnia nieznaną warstwę; `speed` / `low-complexity` domyślnie utrzymuje wszystko proste). NIE promuj warstwy do „inwestowania” bez nazwania sygnału PRD/bazowego/main_goal.

**5b. Pomiń kotwicę tylko wtedy, gdy artefakt jest jednoznaczny.**

Jeśli frontmatter PRD lub Kryteria Sukcesu *dosłownie stwierdzają* wartość (np. `timeline_budget: "1 tydzień do wysyłki"` plus Wizja stwierdzająca „musimy uruchomić przed X” → `main_goal: speed` jest jednoznaczne), pomiń to pytanie. Ogłoś pominięcie w rozmowie z wybraną wartością i cytatem, który ją blokuje. Nigdy nie pomijaj kotwicy, dla której istnieje jakakolwiek wiarygodna alternatywa; potwierdzenie użytkownika dotyczące prawdziwego wyboru jest cenniejsze niż zaoszczędzone sekundy.

Limit to **3 pytania kotwiczące**. W praktyce zazwyczaj zadajesz 2-3; możesz zadać mniej, jeśli wiele kotwic jest jednoznacznych na podstawie artefaktów, ale NIGDY nie możesz zadać więcej.

**5c. Przeprowadź wywiad — jedno ustrukturyzowane pytanie na kotwicę, w kolejności.**

Dla każdej niepominiętej kotwicy — `main_goal`, następnie `north_star`, następnie `top_blocker` — użyj wybranego narzędzia do interaktywnych pytań. Każde pytanie to osobne wywołanie (sekwencyjne, nie wsadowe). Format:

Pytanie interaktywne:
- question: "<pytanie kotwiczące w języku naturalnym, w języku użytkownika>"
  header: "<krótki nagłówek — np. Cel | Gwiazda | Główne ryzyko / Goal | North star | Blocker>"
  options:
  - label: "<Wartość rekomendacji> (Zalecane)"
    description: "<Jednowierszowe uzasadnienie, z cytatem/wskaźnikiem artefaktu, który uzasadnia rekomendację.>"
  - label: "<Wartość alternatywy A>"
    description: "Rozsądne, gdy <jednowierszowy warunek, który artefakty częściowo wspierają>; wybierzesz to, gdy <konsekwencja sekwencjonowania/zakresu>."
  - label: "<Wartość alternatywy B>"
    description: "Rozsądne, gdy <jednowierszowy warunek>; wybierzesz to, gdy <konsekwencja>."
  - label: "Coś innego — wyjaśnię"
    description: "Swobodna forma. Podaj wartość i powód; zapiszę oba i odpowiednio je uporządkuję."
  multiSelect: false

Zasady dla bloku opcji:
- **Rekomendacja jest zawsze opcją 1.** Nie ukrywaj jej. Sufiks „(Zalecane)” na etykiecie jest kluczowy.
- **Każda alternatywa zawiera własną klauzulę „dlaczego rozsądne”.** Nie „alternatywa: jakość” — ale „alternatywa: jakość — rozsądne, gdy poprawność uruchomienia ma większe znaczenie niż sygnał od pierwszego użytkownika; wybierzesz to, gdy koszt publicznego błędu przekracza koszt wolniejszego uruchomienia”. Alternatywy bez klauzuli „dlaczego” są słomianymi kukłami i muszą zostać usunięte.
- **Maksymalnie 2 alternatywy.** Plus swobodna opcja awaryjna. Łącznie opcji: 2-4. Listy pięciu opcji męczą użytkownika bez dodawania sygnału.
- **Opcje Gwiazdy Północnej nazywają kandydatów na wycinki, a nie abstrakcyjne wartości.** Etykieta każdej opcji to `<kandydat US-NN> — <jednowierszowy wynik>`. Opis zawiera, dlaczego ten wycinek jest zalecanym/alternatywnym kamieniem milowym walidacji.
- **Jeśli dla kotwicy możliwa jest tylko jedna wartość** (5a mówi, że nie istnieją rozsądne alternatywy), przedstaw tylko dwie opcje: Rekomendację i „Coś innego — wyjaśnię”. Ujawnij w tekście pytania: „artefakty wspierają tutaj tylko jedną interpretację; zgłoś, jeśli Twoja interpretacja jest inna”.

**5d. Wywnioskuj obszary inwestycji (bez pytania).**

Po uzyskaniu 2-3 odpowiedzi na pytania kotwiczące, wywnioskuj obszary inwestycji na podstawie: (1) wybranego `main_goal`, (2) NFR PRD blokujących uruchomienie w warstwie, (3) luk bazowych mapowanych na must-have FR, (4) koncentracji otwartych pytań. Ogłoś wywnioskowaną inwestycję w podsumowaniu syntezy (5e). Użytkownik może nadpisać w jednym wierszu; nie jest proszony o wybór.

**5e. Podsumowanie syntezy — potwierdź bez pytania.**

Wyślij pojedynczą wiadomość w zwykłym markdownie, która blokuje ramowanie. Brak nowych pytań. Odzwierciedlaj język użytkownika od początku do końca (polskie PRD → polskie podsumowanie). Kształt:

```markdown
Blokowanie ramowania mapy drogowej:

- **Cel sekwencjonowania: `<main_goal>`.** <Jednowierszowe uzasadnienie, łączące się z odpowiedzią użytkownika na kotwicę i wskaźnikiem artefaktu.>
- **Gwiazda przewodnia: `<S-NN candidate> — <Outcome>`.** <Jednowierszowe powiązanie tego wycinka z głównym Kryterium Sukcesu lub najbardziej ryzykownym założeniem.>
- **Główne ryzyko / blocker: `<top_blocker>`.** <Jednowierszowe z konkretnym sygnałem — liczbą otwartych pytań, nazwanym dostawcą, niedopasowaniem terminu itp.>
- **Inwestycje: w `<layer>` głęboko; reszta lekko.** <Jednowierszowe — wywiedzione z main_goal + NFR + luki bazowej; nie pytane.>

Powiedz "go" żeby ruszyć dalej, albo nadpisz dowolną linię ("inwestycja powinna być w data, nie infra"). Nie będę pytał ponownie o to, co już ustaliliśmy.
```

Gdy użytkownik powie „go” lub pozostanie cichy po przekroczeniu następnej granicy kroku, kontynuuj z zablokowanym ramowaniem. Nadpisania wierszowe są akceptowane i ponownie rejestrowane bez ponownego zadawania innych kotwic.

**5f. Wyjątek dla niestandardowego kształtu MVP.**

„Niestandardowy kształt MVP” to produkt, który nie pasuje do znanego wzorca: nie jest to pulpit nawigacyjny SaaS, nie jest to aplikacja CRUD, nie jest to platforma treści, nie jest to oczywisty wrapper AI, nie jest to strona marketingowa. Sygnały: `## Vision` PRD opisuje nową interakcję lub domenę; `## User Stories` nie grupują się wokół znanej encji (tworzenie/czytanie/aktualizowanie/usuwanie `<rzeczy>`); `tech-stack.md` deklaruje nieoczywiste narzędzia (silniki gier, mosty sprzętowe, specjalistyczne środowiska uruchomieniowe, nowe kształty agentów); sformułowanie użytkownika podkreśla nową mechanikę, a nie znany wzorzec.

Gdy PRD wygląda na niestandardowo ukształtowane:

1. **Rozpocznij wywiad, ujawniając to** w wiadomości poprzedzającej pierwsze pytanie kotwiczące: *"To PRD nie pasuje do znanego wzorca MVP (brak pulpitu nawigacyjnego SaaS / CRUD / treści / kształtu AI-wrapper). Moje rekomendacje dla kolejnych 2-3 pytań są słabsze niż zwykle — mocno sprzeciw się, jeśli moja interpretacja jest błędna."*
2. **Złagodź rekomendację dotyczącą `north_star` i wszelkich pochodnych obszarów inwestycji.** Sformułuj opis rekomendacji jako *"Moja najlepsza interpretacja to X, ale sygnał artefaktu jest słaby"* zamiast *"PRD §Vision mówi X"*.
3. **Dopuść do dwóch dodatkowych wymian** oprócz trzech pytań kotwiczących. Niestandardowe MVP nagradzają dialog; intuicja projektowa użytkownika wykonuje więcej pracy niż artefakty. Dodatkowe pytania to swobodny tekst, a nie nowe ustrukturyzowane pytania.

To jest jedyna ścieżka, gdzie umiejętność skłania się ku dialogowi, a nie od niego odchodzi. Całkowity limit w ramach tego wyjątku: 3 kotwice + 2 pytania uzupełniające = 5 wymian.

**5g. Sformułowanie i wytyczne językowe (dotyczą każdego pytania kotwiczącego i podsumowania).**

- **Odzwierciedlaj język użytkownika od początku do końca.** Polskie PRD → polskie pytania, opcje i podsumowanie. Tłumacz nazwy sekcji (`Open Questions` → `Otwarte pytania`, `Functional Requirements` → `Wymagania funkcjonalne`, `Non-Goals` → `Poza zakresem`, `Success Criteria` → `Kryteria sukcesu`). Brak angielskich fragmentów, takich jak „north star”, „blocker”, „must-have” w polskim pytaniu lub etykiecie opcji — parafrazuj („gwiazda przewodnia”, „główne ryzyko”, „konieczne”).
- **Tłumacz wewnętrzny żargon umiejętności na prosty język produktu.** *"Privacy posture"* → *"polityka prywatności dostawcy AI"*. *"North star"* → *"pierwsza historyjka, która udowadnia, że produkt działa"*. *"Blocking unknowns"* → *"pytania bez odpowiedzi, które blokują dalsze planowanie"*. Użytkownik nigdy nie powinien musieć otwierać dokumentacji tej umiejętności, aby zrozumieć pytanie.
- **Cytaty w opisach opcji zasługują na swoje miejsce.** Cytat taki jak *"tech-stack wskazuje Astro + Supabase + OpenRouter"* to lista nazw, chyba że następna klauzula mówi, dlaczego ma to znaczenie dla *tej* kotwicy. Albo włącz implikację, albo usuń cytat.
- **Rekomendacja musi być możliwa do obrony, a nie agresywna.** Jednowierszowa rekomendacja opiera się na linii artefaktu, a nie na pewnym tonie. Jeśli nie możesz wskazać cytatu, obniż rangę — przedstaw kotwicę z dwiema alternatywami o równej wadze (i swobodną opcją awaryjną) i pozwól użytkownikowi wybrać.

**5h. Twardy limit.**

Poza wyjątkiem niestandardowego MVP: **3 pytania kotwiczące, bez pytań uzupełniających, jedno podsumowanie syntezy.** W ramach wyjątku: 3 kotwice + do 2 wymian uzupełniających. Jeśli po osiągnięciu limitu kotwica jest nadal nierozstrzygnięta, **podejmij decyzję** za pomocą Rekomendacji, zapisz ją w frontmatterze z jednowierszowym uzasadnieniem i kontynuuj — użytkownik może w każdej chwili nadpisać, edytując plik lub mówiąc „właściwie, blokerem powinna być pojemność, a nie czas”. Umiejętność nie wkracza na terytorium `/10x-plan` i nie zatrzymuje się na przypadku brzegowym pod-kotwicy.

### Krok 6: Dekompozycja i sekwencjonowanie

Ten krok to moment, w którym umiejętność zarabia na siebie. Zbuduj zawartość mapy drogowej **w pamięci** (jeszcze nie na dysku).

**6a. Zidentyfikuj Fundamenty.** Fundament to przekrojowy warunek wstępny, który sam w sobie nie ma widocznego dla użytkownika rezultatu, ale odblokowuje nazwane pionowe wycinki, zmniejsza nazwaną blokującą niewiadomą lub tworzy infrastrukturę weryfikacyjną wymaganą przez nazwany wycinek. Jest to umowa umożliwiająca, a nie pozwolenie na tworzenie mapy drogowej w poziomie. Źródła:

- Decyzje `tech-stack.md`, które implikują prace szkieletowe (dostawca uwierzytelniania → szkielet uwierzytelniania; wybrany cel wdrożenia → szkielet wdrożenia; wybrane monitorowanie → baza obserwowalności).
- `## Non-Functional Requirements` PRD, które wymagają infrastruktury (np. NFR „p95 < 800ms” implikuje podstawową instrumentację wydajności).
- `## Access Control` PRD, jeśli jest to coś więcej niż „pojedynczy użytkownik, brak uwierzytelniania”.
- **Baza z Kroku 4** — wszystko zgłoszone jako **nieobecne** lub **częściowe** jest kandydatem na Fundamenty. Wszystko zgłoszone jako **obecne** jest pomijane (i odnotowywane w `## Baseline`).
- **Krok 5 „Gdzie inwestować”** — wybory „inwestuj głęboko” promują fundament do własnego, jawnego wycinka (np. „warstwa danych — inwestuj głęboko” + brak bazy → F-NN jawny fundament projektowania danych, a nie tylko niejawny krok migracji).

Nie wymyślaj fundamentów, których PRD nie implikuje (nie ma „ustaw Storybook”, chyba że coś to wymusza). Nie twórz ogólnego fundamentu „warstwy danych”, „warstwy API”, „warstwy UI” ani „systemu uwierzytelniania”, chyba że możesz nazwać element `S-NN` niższego poziomu, który odblokowuje, blokującą niewiadomą, którą zmniejsza, lub ścieżkę weryfikacji, którą umożliwia.

**Limit zakresu Fundamentu.** Fundament musi być najmniejszym przekrojowym elementem umożliwiającym, który pozwala na kontynuowanie nazwanego pionowego wycinka. Może ustanawiać minimalną umowę, szkielet, politykę lub ścieżkę weryfikacji; NIE może ukończyć całej warstwy architektonicznej przed pracami widocznymi dla użytkownika. Jeśli wynik fundamentu brzmi jak „warstwa danych/API/UI/uwierzytelniania jest kompletna”, podziel go lub włącz minimalną potrzebną pracę do pierwszego wycinka `S-NN`, który go konsumuje. Test: po wdrożeniu Fundamentu, co najmniej jeden wycinek `S-NN` niższego poziomu powinien nadal integrować i wykorzystywać tę warstwę poprzez rzeczywistą funkcjonalność użytkownika.

**Zasada progresywnego ujawniania.** Preferuj wprowadzanie elementów technicznych w momencie, gdy potrzebuje ich pierwszy wycinek widoczny dla użytkownika. Fundament jest uzasadniony tylko wtedy, gdy jego odłożenie w czasie sprawiłoby, że pierwszy pionowy wycinek byłby niemożliwy do zaplanowania, niebezpieczny lub niemożliwy do zweryfikowania. „Będziemy potrzebować tej warstwy w końcu” to za mało.

Identyfikatory Fundamentów to `F-NN` (dwucyfrowe z wiodącym zerem, zaczynając od `F-01`).

**6b. Podziel powierzchnię widoczną dla użytkownika na wycinki.** Przejrzyj `## User Stories` i `## Functional Requirements` PRD. Pogrupuj je w pionowe, kompleksowe wycinki, gdzie każdy wycinek:

- Dostarcza **pojedynczą, widoczną dla użytkownika funkcjonalność** określoną jako „użytkownik może…”.
- Dotyka każdej warstwy potrzebnej do urzeczywistnienia tej funkcjonalności (dane + logika + interfejs), od góry do dołu.
- Jest wystarczająco mały, aby jedno wywołanie `/10x-plan` wygenerowało wykonalny plan, ale wystarczająco duży, aby wycinek był znaczący sam w sobie (wycinek to zazwyczaj jeden US-NN, czasami dwa, gdy są ściśle powiązane — np. „tworzenie” i „lista” tej samej encji).

NIE dziel w poziomie („wycinek bazy danych”, „wycinek API”, „wycinek UI”). Wycinki poziome to antywzorzec, którego ta umiejętność ma zapobiegać. Domyślna dekompozycja jest najpierw pionowa: każdy wycinek widoczny dla użytkownika powinien tworzyć użyteczną funkcjonalność, którą agent może zaimplementować i zweryfikować od początku do końca. Praca pozioma jest dozwolona tylko jako nazwany Fundament z wyraźnym powodem niższego poziomu.

Identyfikatory wycinków to `S-NN` (dwucyfrowe z wiodącym zerem, zaczynając od `S-01`).

Każdy `F-NN` i `S-NN` otrzymuje również stabilny **Change ID** w kebab-case. Change ID to pomost do `/10x-plan`, a później element backlogu w Jira/Linear. Preferuj zwięzłe, zorientowane na wyniki nazwy, takie jak `first-gated-generation`, `minimal-auth-for-generation` lub `srs-review-session`.

**Granularność i równowaga wycinków.** Wycinki mapy drogowej powinny być w przybliżeniu porównywalne pod względem wysiłku planistycznego i wagi koncepcyjnej, mimo że nie zawierają szacunków. Unikaj jednego wycinka, który pochłania większość PRD, podczas gdy późniejsze wycinki to drobne poprawki. Jeśli jeden wycinek kandydujący odnosi się do wielu must-have FR lub wielu niepowiązanych historyjek użytkownika, podziel go według widocznych dla użytkownika wyników, faz przepływu pracy, person lub granic ryzyka, aż każdy `S-NN` będzie czymś, co jeden `/10x-plan <change-id>` może spójnie rozważyć.

Użyj tych wyzwalaczy podziału:

- Wycinek obejmuje więcej niż jedną podstawową akcję użytkownika (np. „importuj, edytuj, udostępniaj i raportuj”).
- Wycinek łączy konfigurację, podstawowy przepływ pracy i administrację w jednym elemencie.
- Wycinek spełnia większość must-have FR, podczas gdy inne wycinki mają tylko po jednym drobnym FR.
- Linia ryzyka wycinka zawiera więcej niż jedno niezależne ryzyko.
- Wycinek potrzebuje niepowiązanych niewiadomych, należących do różnych osób lub warstw.

NIE dziel według warstw, aby naprawić rozmiar. Dziel według węższych pionowych wyników. Na przykład, zastąp „kompletny system przepisów” przez „użytkownik może zapisać pierwszy przepis”, „użytkownik może wyszukać zapisane przepisy” i „użytkownik może udostępnić przepis” — a nie „schemat przepisów”, „API przepisów” i „UI przepisów”.

**6c. Zbuduj graf zależności.** Dla każdego wycinka i fundamentu zidentyfikuj Wymagania wstępne:

- **Inne identyfikatory fundamentów**, których wycinek potrzebuje (np. S-03 potrzebuje F-01 uwierzytelniania).
- **Inne identyfikatory wycinków**, których dane lub funkcjonalności ten wycinek konsumuje (np. S-04 „oceń przepis” zależy od S-03 „zobacz przepisy”).
- **Stan zewnętrzny** (np. „zasiana tabela składników”). Konkretny, a nie ogólnikowy.

Dla każdego fundamentu zidentyfikuj również **Odblokowania**:

- jeden lub więcej pionowych wycinków `S-NN` niższego poziomu, które fundament bezpośrednio umożliwia, LUB
- jedną lub więcej blokujących niewiadomych, które zmniejsza, LUB
- jedną lub więcej nazwanych ścieżek weryfikacji wymaganych przez wycinek niższego poziomu.

Jeśli fundament nie ma jasnych Odblokowań, usuń go lub włącz pracę do pierwszego pionowego wycinka, który go potrzebuje.

Następnie dla każdego elementu wywnioskuj **Równolegle z** — wycinki, których Wymagania wstępne są podzbiorem lub rodzeństwem Wymagań wstępnych tego wycinka i które od niego nie zależą. Agenci AI mogą rozdzielać się na te wycinki. Jeśli dwa wycinki nie mają żadnych zależności i żaden nie blokuje drugiego, są równoległe. Gdy bloker nr 1 (Krok 5) to **pojemność**, bądź szczególnie hojny w obliczaniu równoległości — to najbardziej użyteczna dźwignia dla użytkownika.

**6d. Sortowanie topologiczne, z uwzględnieniem głównego celu.** Najpierw fundamenty (w kolejności zależności między nimi), następnie wycinki w kolejności zależności. Umieść wycinek **gwiazdy północnej** tak wcześnie, jak pozwalają na to jego Wymagania wstępne — nie odkładaj go na później ze względu na symetryczne uporządkowanie. Następnie rozstrzygnij remisy według głównego celu (Krok 5):

- **Informacje zwrotne z rynku** → remisy rozstrzygane na korzyść wycinka, który ujawnia najbardziej ryzykowne założenie (często integracja lub logika domenowa). Wczesne ujawnienie ryzyka jest ważniejsze niż maksymalizacja wartości demonstracyjnej wycinka 1.
- **Jakość / rzemiosło** → Fundamenty sekwencjonowane bardziej chętnie; fundamenty obserwowalności i kontroli dostępu NIE są odkładane za wycinki widoczne dla użytkownika.
- **Niska złożoność / szybkie zwycięstwo** → remisy rozstrzygane na korzyść najmniejszego możliwego wycinka; agresywne parkowanie.
- **Szybkość uruchomienia** → najpierw ścisła ścieżka must-have; elementy nieistotne są parkowane, a nie sekwencjonowane późno.
- **Nauka technologii / eksploracja** → remisy rozstrzygane na korzyść wycinków, które najwcześniej wykorzystują nieznaną technologię; wartość nauki liczy się tutaj jako wartość dla użytkownika.

Jeśli `## Open Roadmap Questions` zawiera decyzję istotną dla sekwencjonowania (np. „czy najpierw wysyłamy na urządzenia mobilne?”), NIE wybieraj sekwencji, która przesądza o odpowiedzi — pozostaw dotknięte wycinki jako `Status: blocked` do czasu rozwiązania pytania.

**6e. Zidentyfikuj blokujące niewiadome.** Dla każdego wycinka wymień:

- **Blokady** (zewnętrzne, oczekujące) — zatwierdzenie dostawcy, zasób projektowy, decyzja interesariusza. Jeśli brak, napisz `—`. Odpowiedź na bloker nr 1 „Zewnętrzny” z Kroku 5 zasila te blokady.
- **Niewiadome** (pytania do zbadania) — rzeczy, na które mapa drogowa nie może odpowiedzieć, a `/10x-plan` również nie powinien próbować. Każda niewiadoma zawiera: pytanie, właściciela, status blokowania (tak/nie — czy planowanie jest zablokowane do czasu rozwiązania?). Odpowiedź na bloker nr 1 „Decyzje” z Kroku 5 zasila te niewiadome.

Wycinek ze `Status: blocked` istnieje, gdy co najmniej jedna niewiadoma ma `Block: yes`. Zadaniem mapy drogowej jest ujawnienie ich, aby użytkownik mógł je rozwiązać, zanim `/10x-plan` zostanie zmarnowany na wycinek, którego nie można zaplanować.

**6f. Wygeneruj `## Open Roadmap Questions`.** Dwa źródła:

- `## Open Questions` z PRD — skopiuj dosłownie, w razie potrzeby zmień numerację. Są one nadal otwarte.
- Nowe pytania ujawnione w Kroku 5, które obejmują wiele wycinków („czy faktycznie powinniśmy wysyłać na urządzenia mobilne?”).

Niewiadome dotyczące poszczególnych wycinków pozostają w wycinku; przekrojowe niewiadome znajdują się tutaj.

**6g. Wygeneruj `## Parked`.** Podnieś `## Non-Goals` z PRD. Dołącz również wszystko, co Krok 5 ujawnił jako odłożone — szczególnie gdy głównym celem jest **szybkość uruchomienia** lub głównym blokerem jest **czas/pojemność**, ta sekcja rośnie. Każdy wpis: jednowierszowy element, jednowierszowe uzasadnienie.

**6h. Wywnioskuj `## Streams` (pomoc nawigacyjna).** Strumienie to *widok pochodny* grafu zależności — NIE zastępują one porządku topologicznego w `## Foundations` + `## Slices` i NIE wprowadzają nowych identyfikatorów. Ich zadaniem jest przedstawienie czytelnikowi proponowanej kolejności czytania w równoległych ścieżkach na jednym ekranie, tak aby fundament taki jak F-02, który odblokowuje tylko odległy wycinek, nie był odczytywany jako niepowiązany obok F-01.

Strumień to jeden spójny łańcuch Wymagań wstępnych plus wycinki, które dzielą jego początek. Domyślna zasada wyprowadzania strumieni:

1. **Jeden strumień na fundament, który kotwiczy odrębny łańcuch.** Przejdź przez Fundamenty w kolejności; dla każdego `F-NN` strumień to `F-NN → (wycinki, które wymieniają F-NN w Wymaganiach wstępnych, w kolejności zależności, rozgałęziając się w razie potrzeby)`.
2. **Wycinki bez wymagań wstępnych fundamentu stają się własnym strumieniem.** Wycinek `ready`, który nie zależy od niczego (typowo: mała praca związana z zgodnością / utwardzaniem, taka jak `S-05`), jest własnym strumieniem jednopunktowym. Nie wymyślaj ogólnego „koszyka”.
3. **Wycinek, który zależy od wielu początków strumieni, dołącza do najbardziej pochodnego** (łańcucha, którego początek znajduje się najgłębiej w porządku topologicznym). Wspomnij o dołączeniu w jednowierszowym opisie tego strumienia („dołącza do Strumienia A w S-01”). Nie duplikuj wycinka w strumieniach.
4. **Jeden wiersz na strumień w tabeli markdown** z kolumnami `Strumień | Temat | Łańcuch | Uwaga`. Kolumna `Łańcuch` używa tych samych identyfikatorów mapy drogowej, co reszta dokumentu, połączonych `→` dla sekwencyjnych i `/` lub prozą „równolegle z” dla rozgałęzień. Kolumna `Uwaga` to jedna krótka klauzula łącząca strumień z `main_goal` lub nazywająca punkt połączenia z innym strumieniem.
5. **Tematy są opisowe, a nie promocyjne.** Dobre: „Klin i pokład”, „Pętla przeglądu”, „Cykl życia konta”, „Zgodność uwierzytelniania”. Złe: „Zabójcza funkcja”, „Krytyczna ścieżka 1”.
6. **Limit: 5 strumieni.** Więcej niż pięć zazwyczaj oznacza, że graf zależności jest nadmiernie segmentowany — włącz strumień jednowycinkowy do strumienia sąsiedniego fundamentu, jeśli jego wymagania wstępne się pokrywają. Mniej niż dwa strumienie oznacza, że strumienie nie spełniają swojej roli (porządek topologiczny jest już czytelny); pomiń sekcję.

Strumienie NIE są kanoniczne: jeśli strumień koliduje z porządkiem topologicznym, porządek topologiczny wygrywa, a definicja strumienia jest błędna. Samokontrola zapewnia pokrycie strumieni (każdy F-NN i S-NN pojawia się w dokładnie jednym strumieniu), ale nie wymusza liczby strumieni ani sformułowania tematu.

### Krok 7: Wygeneruj zawartość mapy drogowej

Użyj dokładnie tego szablonu (nazwy sekcji są umową; narzędzia niższego poziomu i `/10x-plan` mogą ich szukać):

````markdown
---
project: <z frontmatter PRD>
version: 1
status: draft                    # draft | active | locked
created: <RRRR-MM-DD>
updated: <RRRR-MM-DD>
prd_version: <int z frontmatter PRD>
main_goal: <market-feedback | quality | low-complexity | speed | learn | other>
top_blocker: <skills | capacity | time | decisions | external | motivation | none>
---

# Mapa drogowa: <Projekt>

> Wywiedziono z `context/foundation/prd.md` (v<N>) + automatycznie zbadana baza kodu.
> Edytuj na miejscu; archiwizuj po zastąpieniu.
> Poniższe wycinki są wymienione w kolejności zależności. Tabela „W skrócie” to indeks.

## Podsumowanie wizji

<2-3 zdania zaczerpnięte z Vision & Problem Statement PRD. NIE jest to ponowne
stwierdzenie — tylko tyle, aby czytelnik mógł się zorientować bez otwierania prd.md.

Jeśli podsumowanie opiera się na terminie strategii produktu — najczęściej „klin”, ale także
„przyczółek”, „główna metryka”, „kamień milowy walidacji”, „gwiazda północna” — zdefiniuj go
w tekście przy pierwszym użyciu, w jednym krótkim zdaniu w języku naturalnym. Przykład:
„Klin produktu — jedyna cecha, która, jeśli zostanie usunięta, sprawia, że produkt
jest nie do odróżnienia od ogólnego narzędzia AI — polega na tym, że karty muszą być zarówno
oparte na AI w tekście wklejonym przez uczącego się, jak i zatwierdzone przez człowieka, zanim
trafią do talii.” Czytelnik, który nie przeszedł kursu strategii produktu, musi
być w stanie przeczytać sekcję od razu.>

## Gwiazda północna

**<ID wycinka>: <Wynik>** — <jedno zdanie o tym, dlaczego jest to kamień milowy walidacji, powiązane z main_goal>.

> Jednowierszowe wyjaśnienie dla czytelnika, co oznacza tutaj „gwiazda północna”: najmniejszy
> kompleksowy wycinek, którego pomyślne dostarczenie udowodniłoby podstawową hipotezę produktu
> — umieszczony tak wcześnie, jak pozwalają na to Wymagania wstępne, ponieważ wszystko inne ma znaczenie
> tylko wtedy, gdy to działa. Dołącz to wyjaśnienie PIERWSZY raz, gdy „gwiazda północna” pojawi się w
> treści dokumentu; nie powtarzaj go później.

## W skrócie

| ID    | Change ID              | Wynik (użytkownik może…)              | Wymagania wstępne    | Odnośniki PRD       | Status   |
| ----- | ---------------------- | --------------------------------- | ---------------- | -------------- | -------- |
| F-01  | <kebab-case-change-id> | (fundament) <wynik fundamentu> | —                | NFR-XX         | proposed |
| F-02  | <kebab-case-change-id> | (fundament) <wynik fundamentu> | F-01             | NFR-YY         | proposed |
| S-01  | <kebab-case-change-id> | <wynik użytkownika>                | F-01             | US-01, FR-001  | ready    |
| S-02  | <kebab-case-change-id> | <wynik użytkownika>                | S-01             | US-02, FR-003  | proposed |
| S-03  | <kebab-case-change-id> | <wynik użytkownika>                | S-01, F-02       | US-03, FR-005  | blocked  |

## Strumienie

Pomoc nawigacyjna — grupuje elementy, które współdzielą łańcuch Wymagań wstępnych. Kanoniczna kolejność nadal znajduje się w grafie zależności poniżej; ta tabela to proponowana kolejność czytania w równoległych ścieżkach.

| Strumień | Temat              | Łańcuch                          | Uwaga                                                      |
| ------ | ------------------ | ------------------------------ | --------------------------------------------------------- |
| A      | <Temat>            | `F-01` → `S-01` → `S-02`       | <Jednowierszowe uzasadnienie łączące strumień z main_goal.>       |
| B      | <Temat>            | `F-02` → `S-03`                | <Dołącza do Strumienia A w `S-NN`, jeśli ma zastosowanie, w przeciwnym razie samodzielny.> |
| C      | <Temat>            | `S-NN`                         | <Samodzielny wycinek bez wymagań wstępnych fundamentu.>       |

(2–5 strumieni; każdy `F-NN` i `S-NN` pojawia się w dokładnie jednym strumieniu. Pomiń tę sekcję całkowicie, jeśli graf zależności jest zbyt mały, aby strumienie dodawały wartość — patrz Krok 6h.)

## Baza

Co już jest na miejscu w bazie kodu na dzień `<RRRR-MM-DD>` (automatycznie zbadane + potwierdzone przez użytkownika).
Poniższe fundamenty zakładają, że są one obecne i NIE odbudowują ich.

- **Frontend:** <obecny | nieobecny | częściowy> — <jedna linia, wskaźnik pliku, jeśli obecny>
- **Backend / API:** <…>
- **Dane:** <…>
- **Uwierzytelnianie:** <…>
- **Wdrożenie / infrastruktura:** <…>
- **Obserwowalność:** <…>

## Fundamenty

### F-01: <Tytuł fundamentu>

- **Wynik:** (fundament) <jedno zdanie o tym, co jest teraz na miejscu — niewidoczne dla użytkownika>.
- **Change ID:** <kebab-case-change-id>
- **Odnośniki PRD:** <NFR-NN, sekcja Access Control itp. — bądź konkretny>
- **Odblokowuje:** <identyfikatory S-NN niższego poziomu, identyfikatory/pytania blokujące niewiadome lub nazwane ścieżki weryfikacji>
- **Wymagania wstępne:** <identyfikatory wycinków/fundamentów i stan zewnętrzny — lub `—`>
- **Równolegle z:** <identyfikatory, które mogą działać równolegle, lub `—`>
- **Blokady:** <zewnętrzne oczekujące, lub `—`>
- **Niewiadome:** <pytania, lub `—`>
- **Ryzyko:** <jedna linia: dlaczego sekwencjonowane tutaj, co może pójść nie tak>
- **Status:** proposed | ready | blocked

(Powtórz dla każdego F-NN.)

## Wycinki

### S-01: <Tytuł wycinka>

- **Wynik:** <użytkownik może…>
- **Change ID:** <kebab-case-change-id>
- **Odnośniki PRD:** <FR-NNN, US-NN, NFR-N — każdy must-have FR, który ten wycinek spełnia, każdy US-NN, który rozwija>
- **Wymagania wstępne:** <identyfikatory wycinków/fundamentów i stan zewnętrzny>
- **Równolegle z:** <identyfikatory, lub `—`>
- **Blokady:** <zewnętrzne oczekujące, lub `—`>
- **Niewiadome:**
  - <pytanie> — Właściciel: <użytkownik|zespół|TBD>. Blokuje: <tak|nie>.
  - (lub `—` jeśli brak)
- **Ryzyko:** <jedna linia>
- **Status:** proposed | ready | blocked

(Powtórz dla każdego S-NN, w kolejności zależności.)

## Przekazanie backlogu

| ID mapy drogowej | Change ID              | Sugerowany tytuł problemu         | Gotowe do `/10x-plan` | Uwagi |
| ---------- | ---------------------- | ----------------------------- | --------------------- | ----- |
| F-01       | <kebab-case-change-id> | <tytuł problemu dla Jira/Linear> | no                    | <dlaczego lub `—`> |
| S-01       | <kebab-case-change-id> | <tytuł problemu dla Jira/Linear> | yes                   | Uruchom `/10x-plan <change-id>` |

Ta tabela to czyste przekazanie do Jira/Linear lub dowolnego backlogu opartego na MCP. Zawiera jeden wiersz dla każdego `F-NN` i `S-NN`. Powinna być wystarczająco kompaktowa, aby można ją było skopiować do problemów, ale nie może duplikować szczegółowej treści mapy drogowej.

## Otwarte pytania dotyczące mapy drogowej

1. **<Pytanie>** — Właściciel: <kto>. Blokuje: <które identyfikatory wycinków to blokuje, lub `roadmap-wide`>.
2. ...

(Każdy wpis odzwierciedla kształt `## Open Questions` z PRD. Niewiadome dotyczące poszczególnych wycinków pozostają w wycinku.)

## Zaparkowane

- **<Element>** — Dlaczego zaparkowane: <odnośnik do PRD §Non-Goals lub uzasadnienie z wywiadu>.
- ...

## Zrobione

(Puste przy pierwszym generowaniu. `/10x-archive` dodaje tutaj wpis — i zmienia `Status` tego elementu na `done` — gdy zmiana, której `Change ID` odpowiada elementowi mapy drogowej, zostanie zarchiwizowana. NIE wypełniaj wstępnie. Format:)

- **<ID wycinka>: <Wynik>** — Zarchiwizowane <RRRR-MM-DD> → `context/archive/<RRRR-MM-DD-change-id>/`. Lekcja: <wskaźnik do lessons.md, jeśli istnieje, lub `—`>.
````

**Semantyka pól, szczegółowo:**

- **Wynik** jest prowadzony przez czasownik. Wycinki: *"użytkownik może się zalogować i zobaczyć pustą lodówkę"*. Fundamenty: *"(fundament) szkielet uwierzytelniania wylądował; tokeny wydane za pośrednictwem skonfigurowanego dostawcy"*. Nigdy fraza rzeczownikowa ("system uwierzytelniania"); zawsze deklaratywny stan świata.
- **Change ID** jest w kebab-case, stabilny i odpowiedni dla `context/changes/<change-id>/`. Nie używaj `F-01` / `S-01` jako change id; są to identyfikatory kolejności lokalne dla mapy drogowej.
- **Odblokowuje** pojawia się tylko w Fundamentach. Nazywa powód istnienia tego Fundamentu: konkretne wycinki `S-NN`, blokujące niewiadome lub ścieżki weryfikacji. Fundament bez Odblokowań to dryf poziomy.
- **Odnośniki PRD** używają dosłownych identyfikatorów z PRD (`FR-001`, `US-01`, `NFR-02`). Nie parafrazuj. Każdy must-have FR w PRD musi pojawić się w co najmniej jednym odnośniku PRD wycinka po samokontroli w Kroku 8.
- **Wymagania wstępne** mieszają identyfikatory wycinków (`S-01`, `F-02`) i stan zewnętrzny, oddzielone przecinkami. Stan zewnętrzny to zwykły angielski ("zasiana tabela składników", "opublikowane tokeny projektowe"). Jedno pole, niepodzielone.
- **Równolegle z** ma charakter informacyjny. Obliczone z grafu zależności: dowolny wycinek X, gdzie moje Wymagania wstępne i Wymagania wstępne X nie mają między sobą ścieżki. Puste = `—`.
- **Blokady** to *tylko zewnętrzne oczekujące* (dostawca, projekt, decyzja interesariusza). Rzeczy, których zespół nie może jednostronnie rozwiązać. Jeśli zespół MOŻE to rozwiązać, jest to Niewiadoma, a nie Blokada.
- **Niewiadome** to pytania do zbadania. Każde zawiera Właściciela i flagę Blokady. Block=yes podnosi status wycinka do `blocked`.
- **Ryzyko** to jedna linia: dlaczego sekwencjonowane tutaj, co może pójść nie tak, dlaczego jest to bezpieczniejsza kolejność niż alternatywy. Nie jest to analiza pośmiertna. Nie jest to katastrofizowanie. Po prostu kluczowy powód, dla którego przyszły czytelnik musi zrozumieć sekwencję.
- **Status** cykl życia: `proposed` (domyślny przy pierwszym generowaniu) | `ready` (wszystkie Wymagania wstępne spełnione, brak blokujących niewiadomych — `/10x-plan` może działać) | `planning` | `in-progress` | `done` | `blocked` (jedna lub więcej niewiadomych z `Block: yes`). Dziś ta umiejętność emituje tylko `proposed`, `ready` i `blocked`; `/10x-archive` zmienia status elementu na `done` po archiwizacji. `planning` i `in-progress` są zarezerwowane dla przyszłego podłączenia `/10x-plan` / `/10x-implement`.
- **Frontmatter `main_goal` / `top_blocker`** rejestruje odpowiedzi z Kroku 5, aby przyszły ponowny odczyt (lub recenzent) mógł szybko zobaczyć stronniczość sekwencjonowania bez otwierania historii rozmów.

**Twarda zasada — nigdy nie wymyślaj wycinków.** Każdy wycinek musi odnosić się do US-NN lub FR-NNN z PRD. Jeśli wywiad ujawnił coś, czego nie ma w PRD („och, a potrzebujemy też trybu offline”), to NIE staje się to wycinkiem. Staje się to albo Otwartym Pytaniem Mapy Drogowej (jeśli to prawdziwa luka), albo wpisem Zaparkowanym (jeśli użytkownik wyraźnie zdecydował się to odłożyć). Zadaniem mapy drogowej jest sekwencjonowanie tego, co deklaruje PRD, a nie rozwijanie PRD.

**Brak jednostek czasu. Brak szacunków. Brak ocen złożoności.** Brak „Dnia 1”, brak „Tygodnia 2”, brak „mały/średni/duży”, brak punktów historyjek. Kolejność jest zakodowana w Wymaganiach wstępnych; tempo jest zakodowane w Blokadach i Niewiadomych. Jeśli masz ochotę napisać „to powinno zająć kilka godzin” — zatrzymaj się. To jest terytorium `/10x-plan` niższego poziomu, a nawet tam chodzi o jasność zakresu, a nie o przewidywanie kalendarza.

### Krok 8: Samokontrola

Przed zapisem na dysk, zweryfikuj mapę drogową w pamięci:

1. **Frontmatter** — wszystkie 8 kluczy obecne (`project`, `version`, `status`, `created`, `updated`, `prd_version`, `main_goal`, `top_blocker`).
2. **Wymagane sekcje** — te nagłówki `##` istnieją, w tej kolejności: `Vision recap`, `North star`, `At a glance`, `Streams` (opcjonalnie — obecne, jeśli Krok 6h zdecydował, że strumienie dodają wartość), `Baseline`, `Foundations`, `Slices`, `Backlog Handoff`, `Open Roadmap Questions`, `Parked`, `Done`. Gdy `Streams` jest obecne, liczba wynosi 11; bez niego 10.
3. **Schemat dla każdego wpisu** — każdy S-NN ma 9 obowiązkowych pól (`Outcome`, `Change ID`, `PRD refs`, `Prerequisites`, `Parallel with`, `Blockers`, `Unknowns`, `Risk`, `Status`). Każdy F-NN ma te pola plus `Unlocks`.
4. **Pokrycie PRD** — każdy `must-have` FR z PRD (grep `^- FR-\d{3}: .* must-have$`) pojawia się w co najmniej jednym `PRD refs` wycinka. To samo dotyczy każdego `### US-NN:`. Jeśli must-have nie jest pokryty, samokontrola NIE POWODZI SIĘ.
5. **Integralność grafu zależności** — brak cykli. Każdy ID wymieniony w `Prerequisites` istnieje gdzieś w dokumencie. Kolejność w `## Foundations` i `## Slices` to sortowanie topologiczne: żaden wycinek nie zależy od czegoś, co następuje po nim.
6. **Spójność tabeli „W skrócie”** — wiersze tabeli odpowiadają treści sekcji. `Change ID`, `Prerequisites`, `PRD refs`, `Status` każdego wiersza odpowiadają dosłownie polom treści.
7. **Spójność statusu** — każdy `blocked` wycinek ma co najmniej jedną niewiadomą z `Block: yes`. Każdy `ready` wycinek ma wszystkie Wymagania wstępne już w stanie `done` (dziś oznacza to: brak Wymagań wstępnych LUB wszystkie Wymagania wstępne to fundamenty, które baza zgłasza jako `present`).
8. **Brak wymyślonych wycinków** — `PRD refs` każdego wycinka zawiera co najmniej jeden prawdziwy ID PRD (`FR-\d{3}` lub `US-\d{2}`).
9. **Spójność Bazy ↔ Fundamentów** — żaden Fundament nie odbudowuje warstwy, którą sekcja `## Baseline` zgłasza jako `present`. Jeśli baza mówi, że uwierzytelnianie jest obecne, a nadal istnieje `F-NN` dla szkieletu uwierzytelniania, to jest to błąd samokontroli (albo baza jest błędna, albo fundament jest zbędny).
10. **Umowa umożliwiająca Fundamentu** — każdy Fundament ma wypełnione `Unlocks` co najmniej jednym wycinkiem `S-NN` niższego poziomu, nazwaną blokującą niewiadomą lub nazwaną ścieżką weryfikacji. Ogólny fundament, taki jak „warstwa bazy danych” bez powodu niższego poziomu, jest błędem samokontroli.
11. **Integralność Change ID** — każdy F-NN i S-NN ma unikalny `Change ID` w kebab-case; każdy F-NN i S-NN pojawia się dokładnie raz w `## Backlog Handoff`; każdy wiersz przekazania odwołuje się do istniejącego ID mapy drogowej i powtarza ten sam Change ID. Brak spacji, dat, etykiet statusu lub ID mapy drogowej jako change ID.
12. **Równowaga granularności wycinków** — żaden `S-NN` nie może pochłonąć większości nietrywialnego PRD, podczas gdy wycinki siostrzane są drobnymi resztkami. Jeśli jeden wycinek odnosi się do większości must-have FR, więcej niż dwóch niepowiązanych wpisów US-NN, wielu podstawowych akcji użytkownika lub niepowiązanych ryzyk/niewiadomych, samokontrola NIE POWODZI SIĘ, chyba że PRD naprawdę ma tylko jeden widoczny dla użytkownika przepływ pracy. Napraw to, dzieląc na węższe pionowe wyniki, a nie tworząc wycinki warstw.
13. **Limit zakresu Fundamentu** — żaden Fundament nie może ukończyć całej warstwy z wyprzedzeniem. Wynik i Ryzyko muszą pokazywać minimalną umowę umożliwiającą, a `Unlocks` musi nazywać pionowe wycinki, które nadal będą integrować tę warstwę poprzez zachowanie widoczne dla użytkownika. Jeśli Fundament brzmi jak „zbuduj warstwę danych/API/UI/uwierzytelniania”, samokontrola NIE POWODZI SIĘ. Podziel go, zawęź lub włącz minimalną potrzebną pracę do pierwszego konsumującego `S-NN`.
14. **Progresywne ujawnianie elementów technicznych** — każdy przekrojowy element techniczny pojawia się albo w pierwszym pionowym wycinku, który go potrzebuje, albo w Fundamencie, który jest wymagany, zanim ten wycinek będzie mógł być zaplanowany, zweryfikowany lub bezpieczny. Jeśli element techniczny jest wprowadzany tylko dlatego, że będzie przydatny później, samokontrola NIE POWODZI SIĘ, a ta praca przenosi się do pierwszego wycinka, który faktycznie go używa.
15. **Pokrycie strumieni** (tylko jeśli sekcja `## Streams` została wyemitowana) — każdy `F-NN` i każdy `S-NN` wymieniony w `## At a glance` pojawia się w dokładnie jednej komórce `Chain` strumienia. Duplikaty i pominięcia powodują błąd. Komórki Chain odwołują się tylko do istniejących ID mapy drogowej (brak wymyślonych ID). Liczba strumieni wynosi 2–5. Jeśli dokument ma < 2 strumienie kandydujące, sekcja powinna zostać pominięta (limit Kroku 6h).
16. **Terminy strategiczne są definiowane w tekście** — przeskanuj wygenerowany dokument w poszukiwaniu żargonu strategii produktu: `wedge`, `beachhead`, `north star`, `validation milestone`, `primary metric`, `must-have path`, `product-market fit`, `thin end of the wedge`, `riskiest assumption`, `core hypothesis`. Dla każdego terminu, który pojawia się w treści (podsumowanie wizji, gwiazda północna, linie ryzyka, tytuły wycinków), sprawdź, czy istnieje jednowierszowa definicja w tekście przy jego **pierwszym** wystąpieniu w dokumencie. Jeśli termin jest używany bez definicji przy pierwszym użyciu, samokontrola NIE POWODZI SIĘ. Dopuszczalne formy definicji: w nawiasie („klin — jedyna cecha, która, jeśli zostanie usunięta, sprawia, że produkt jest ogólny — to…”), wyjaśnienie z myślnikiem lub krótkie zdanie uzupełniające. Terminy w stylu identyfikatorów (`FR-001`, `US-03`, `F-01`, `S-02`) oraz nazwy własne narzędzi/usług są zwolnione. Jeśli terminu nie można zdefiniować w jednym zdaniu, zastąp go prostym językiem i wyemituj ponownie.

Jeśli którykolwiek z testów zakończy się niepowodzeniem, **przerwij zapis** i zgłoś konkretną awarię:

```
Samokontrola mapy drogowej NIE POWIODŁA SIĘ:

  - <konkretna awaria, np. "FR-007 (must-have) nie jest pokryty przez żaden wycinek"
     lub "Wycinek S-04 wymienia S-06 w Wymaganiach wstępnych, ale S-06 pojawia się później w dokumencie"
     lub "F-02 (szkielet uwierzytelniania) jest zbędny — Baza zgłasza uwierzytelnianie jako obecne">
  - ...

Mapa drogowa NIE została zapisana. Napraw błąd i wygeneruj ponownie, lub — jeśli test jest
błędny — zgłoś błąd umiejętności. Przerwania samokontroli chronią narzędzia niższego poziomu przed
dryfem.
```

Następnie ZATRZYMAJ SIĘ.

### Krok 9: Sprawdzenie kolizji

```bash
test -f context/foundation/roadmap.md
```

Jeśli plik nie istnieje, zapisz do `context/foundation/roadmap.md` i przejdź do Kroku 10.

Jeśli plik istnieje, konwencja dokumentów bazowych to **edycja na miejscu** dla stopniowego udoskonalania, **archiwizacja, a następnie zastąpienie** dla pełnej regeneracji. Ta umiejętność tworzy *pełną* mapę drogową z PRD; chirurgiczne udoskonalanie jest poza zakresem. Domyślnie więc archiwizuj, a następnie zastąp, ale zapytaj za pomocą wybranego narzędzia do interaktywnych pytań:

Pytanie interaktywne:
- question: "context/foundation/roadmap.md już istnieje. Jak chcesz postąpić?"
  header: "Kolizja"
  options:
  - label: "Archiwizuj i zastąp (zalecane)"
    description: "Przenieś istniejący plik do context/foundation/archive/<dzisiaj>-roadmap.md, a następnie zapisz nową mapę drogową. Historia zachowana zgodnie z konwencją README fundamentu."
  - label: "Nadpisz bez archiwizacji"
    description: "Zastąp na miejscu. Istniejąca zawartość zostanie utracona (chyba że ją zatwierdziłeś). Użyj tylko wtedy, gdy istniejąca mapa drogowa jest pusta lub robocza."
  - label: "Anuluj"
    description: "Wyjdź bez zapisów. Brak rozwiązania kolizji."
  multiSelect: false

W przypadku "Archiwizuj i zastąp": utwórz `context/foundation/archive/`, jeśli brakuje, przenieś istniejący plik do `context/foundation/archive/<dzisiaj>-roadmap.md` (użyj dzisiejszej daty w formacie `RRRR-MM-DD`), a następnie zapisz nową zawartość. Jeśli plik już istnieje pod tą ścieżką archiwum (regenerowany dwukrotnie w ciągu jednego dnia), dodaj `-2`, `-3` itd.

W przypadku "Nadpisz bez archiwizacji": zapisz nową zawartość, nadpisując na miejscu.

W przypadku "Anuluj": ZATRZYMAJ SIĘ.

### Krok 10: Przekazanie

Po zapisaniu podsumuj:

```
═══════════════════════════════════════════════════════════
  MAPA DROGOWA WYGENEROWANA
═══════════════════════════════════════════════════════════

  Projekt:           <projekt>
  Ścieżka:              context/foundation/roadmap.md
  Główny cel:         <main_goal>            (stronniczość sekwencjonowania)
  #1 bloker:        <top_blocker>          (co planować wokół)
  Baza obecna:  <warstwy zgłoszone jako obecne, oddzielone przecinkami>
  Fundamenty:       <liczba>
  Wycinki:            <liczba>
  Podział statusu:  ready: N  |  proposed: M  |  blocked: K
  Pokrycie PRD:      <pokryte must-have FR> / <wszystkie must-have FR>
  Otwarte pytania mapy drogowej:    <liczba>
  Zaparkowane elementy:      <liczba>

  Gwiazda północna:  <ID wycinka> — <Wynik>

═══════════════════════════════════════════════════════════
```

Następnie **zarekomenduj jeden następny ruch** — nie oddawaj listy „gotowych” i nie proś użytkownika o wybór. Wybierz jeden element mapy drogowej do zaplanowania jako pierwszy i uzasadnij to w jednym zdaniu. Użytkownik może nadpisać, ale domyślna powierzchnia to rekomendacja, a nie menu.

**Zasada wyboru zalecanego następnego ruchu** (stosuj w kolejności, pierwsze dopasowanie wygrywa):

1. Jeśli gwiazda północna jest `ready`, zarekomenduj ją. Gwiazda północna to kamień milowy walidacji; odkładanie jej w czasie powoduje utratę sygnału.
2. W przeciwnym razie, jeśli Fundament, od którego gwiazda północna bezpośrednio zależy, jest `ready`, zarekomenduj ten Fundament i wyraźnie powiedz „to odblokowuje gwiazdę północną <S-NN>”.
3. W przeciwnym razie, jeśli żaden wycinek nie jest `ready`, zarekomenduj rozwiązanie Otwartego Pytania lub Blokady o największym wpływie (tego, które odblokowuje najwięcej elementów niższego poziomu). Do tego czasu nie ma dostępnego ruchu planistycznego.
4. W przeciwnym razie zarekomenduj wycinek `ready`, który odblokowuje najwięcej elementów niższego poziomu (największe rozgałęzienie w grafie zależności). Rozstrzygnij remisy według głównego celu (Krok 6d).

Format:

```
► **Twój następny ruch:** `/10x-plan <change-id>` na **<ID mapy drogowej>: <Wynik>**.

  Dlaczego ten pierwszy: <jedno zdanie — kluczowy powód: to JEST gwiazda
  północna / odblokowuje gwiazdę północną / ma największe rozgałęzienie / to
  najmniejsza kompleksowa walidacja, którą możemy teraz wysłać>.

  Następnie, w kolejności: <następny gotowy ID>: <Wynik> → <następny>: <Wynik>.
  (Pełna lista w `## Backlog Handoff`.)

  Zablokowane — pozostają zaparkowane, dopóki ich niewiadome nie zostaną rozwiązane:
    - <ID wycinka>: <Niewiadoma> (Właściciel: <kto>)
    - ...
  (Rozwiązanie któregokolwiek z nich podnosi status wycinka do `ready` i zmienia moją
  rekomendację; wróć, a ponownie zarekomenduję.)
```

Jeśli żaden wycinek nie jest `ready` i żaden Fundament również nie jest `ready` (przypadek 3), zastąp rekomendację:

```
► **Brak dostępnego ruchu planistycznego.** Każdy wycinek jest zablokowany.
  Niewiadoma o największym wpływie do rozwiązania w następnej kolejności:

    <Pytanie> — Właściciel: <kto>. Odblokowuje: <S-NN, S-MM, ...>.

  Rozwiązanie tego podnosi status <liczba> wycinków i jest jedyną zmianą, która
  najbardziej otwiera mapę drogową. Rozwiąż to, a następnie ponownie wywołaj `/10x-roadmap`, aby
  ponownie zarekomendować.
```

ZATRZYMAJ SIĘ. Nie łącz automatycznie z inną umiejętnością — użytkownik wybiera, kiedy planować. Ale NIE obniżaj rekomendacji do listy wielokrotnego wyboru; jeśli użytkownik chce innego wycinka, mówi o tym.

## Krytyczne zabezpieczenia

1. **PRD jest źródłem.** Każdy wycinek odnosi się do identyfikatorów PRD. Ramowanie z Kroku 5 ujawnia kontekst celu/gwiazdy północnej/inwestycji/blokady wywnioskowany z PRD; baza ujawnia to, co już istnieje; żadne z nich nie rozszerza PRD. Elementy mapy drogowej bez odniesienia do PRD są błędem samokontroli.

2. **Najpierw pionowe wycinki.** Wycinek dostarcza widoczną dla użytkownika funkcjonalność od początku do końca. Wycinki poziome („warstwa API”, „schemat”) to antywzorzec, którego ta umiejętność ma zapobiegać. Fundamenty są *jedynym* wyjątkiem — są one wyraźnie przekrojowymi elementami umożliwiającymi, znajdują się w osobnej sekcji, zawierają `Unlocks` i są oznaczone `(fundament)`, aby żaden czytelnik nie pomylił ich z pracą widoczną dla użytkownika.

3. **Zrównoważona granularność bez szacunków.** Wycinki nie otrzymują etykiet rozmiaru, ale ich zakres musi być porównywalny. Mapa drogowa, w której `S-01` zawiera prawie całe PRD, a `S-02`/`S-03` to drobne resztki, jest złą mapą drogową. Podziel zbyt duże elementy według węższych wyników widocznych dla użytkownika, faz przepływu pracy, person lub granic ryzyka — nigdy według warstwy technicznej.

4. **Fundamenty to minimalne odblokowania, a nie projekty ukończenia warstw.** Fundament może stworzyć najmniejszy warunek wstępny potrzebny do rozpoczęcia pracy pionowej. Nie może wstępnie budować całej warstwy bazy danych/API/UI/uwierzytelniania. Jeśli element techniczny może być wprowadzony w pierwszym wycinku widocznym dla użytkownika, który go potrzebuje, umieść go tam; to utrzymuje integrację pionową i stopniowo ujawnia tylko potrzebne elementy.

5. **Brak szacunków, brak jednostek czasu.** Brak „Dnia 1”, brak „2 tygodni”, brak „mały/średni/duży”, brak punktów. Wykonanie agenta AI jest nieliniowe, a szacunki budżetowane czasowo kłamią. Kolejność jest zakodowana w Wymaganiach wstępnych; tempo ujawnia się poprzez Blokady i Niewiadome. Mapa drogowa opisuje kształt, a nie harmonogram.

6. **Brak niskopoziomowych szczegółów technicznych.** Brak nazw frameworków (te znajdują się w `tech-stack.md`), brak ścieżek plików, brak definicji schematów, brak kodu, brak wyborów bibliotek. Jeśli piszesz takie rzeczy, wkroczyłeś na terytorium `/10x-plan` — zatrzymaj się i pozwól `/10x-plan` wykonać swoją pracę.

7. **Ujawniaj niewiadome, nie tuszuj ich.** Niewiadome dotyczące poszczególnych wycinków z `Block: yes` promują `Status: blocked`. Przekrojowe niewiadome trafiają do `## Open Roadmap Questions`. Jeśli PRD ma TODO, mapa drogowa dziedziczy je jako niewiadome zablokowanych wycinków. Wartość mapy drogowej polega częściowo na pokazywaniu użytkownikowi, czego JESZCZE nie można zaplanować.

8. **Baza jest automatycznie badana, a nie pytana.** Nie pytaj użytkownika „co już jest na miejscu?” — uruchom równoległe subagenty Explore (Krok 4) i pozwól bazie kodu odpowiedzieć. Następnie poproś użytkownika tylko o potwierdzenie lub poprawienie. To jest umowa, która sprawia, że Fundamenty są uczciwe: fundament istnieje tylko wtedy, gdy baza mówi, że warstwa jest nieobecna lub częściowa.

9. **Samokontrola przerywa w przypadku dryfu.** Brak wymaganych sekcji, uszkodzony graf zależności, niepokryte must-have FR, wymyślone wycinki, zbyt duże wycinki, ukończenie warstwy Fundamentu, sprzeczności między Bazą a Fundamentami — wszystko to przerywa zapis z konkretnym błędem. Brak cichej naprawy.

10. **Konwencja dokumentów bazowych.** `roadmap.md` to dokument bazowy zgodnie z `context/foundation/README.md`. Domyślna obsługa kolizji to archiwizacja, a następnie zastąpienie (historia trafia do `foundation/archive/<dzisiaj>-roadmap.md`); chirurgiczne udoskonalanie jest poza zakresem tej umiejętności (edytuj ręcznie, jeśli tego potrzebujesz).

11. **Tylko język uniwersalny.** Brak odniesień do 10xDevs / kohorty / certyfikacji w jakimkolwiek wyjściu widocznym dla użytkownika lub w jakimkolwiek artefakcie zapisanym na dysku. Umiejętność jest ogólnym generatorem map drogowych.

12. **Nigdy nie łącz automatycznie.** Krok 10 to ogłoszenie, a nie wywołanie. Użytkownik wybiera, kiedy (i który) wycinek przekazać do `/10x-plan`. Automatyczne łączenie pominęłoby przegląd wygenerowanej mapy drogowej przez człowieka.

13. **Definiuj terminy strategiczne w tekście przy pierwszym użyciu.** Słownictwo strategii produktu — `wedge`, `beachhead`, `north star`, `validation milestone`, `primary metric`, `must-have path`, `product-market fit`, `thin end of the wedge`, `riskiest assumption`, `core hypothesis` — to wewnętrzny skrót umiejętności i PRD, a nie wiedza powszechna. Mapa drogowa musi być czytelna od razu dla członka zespołu (lub przyszłego siebie), który nie przeszedł kursu strategii produktu. Przy PIERWSZYM wystąpieniu dowolnego takiego terminu w treści dokumentu, dołącz jednowierszową definicję w tekście (w nawiasie („klin — jedyna cecha, która, jeśli zostanie usunięta, sprawia, że produkt jest ogólny — to…”), wyjaśnienie z myślnikiem lub krótkie zdanie uzupełniające). Nie powtarzaj definicji przy późniejszych użyciach. Jeśli koncepcji nie można zdefiniować w jednym zdaniu, zastąp ją prostym językiem („najmniejszy kompleksowy przepływ, który udowadnia, że produkt działa” jest lepsze niż „klin”, jeśli nie możesz skompresować wyróżniającej cechy klina w jedną klauzulę). To zabezpieczenie dotyczy prozy widocznej dla użytkownika w wygenerowanym dokumencie — nie pytań wywiadu (Krok 5 już je obsługuje) i nie semantyki pól w tym pliku umiejętności. Sprawdzenie samokontroli nr 16 w Kroku 8 to wymusza; obejście jest błędem samokontroli, a nie preferencją stylistyczną.

14. **Oszczędny wywiad z silnymi rekomendacjami — ani ciche automatyczne ramowanie, ani nieograniczone odkrywanie.** Krok 5 zadaje **maksymalnie 3 pytania kotwiczące** (`main_goal`, `north_star`, `top_blocker`); obszary inwestycji są *wyprowadzane* z odpowiedzi. Każde pytanie kotwiczące zawiera jedną silną **Rekomendację** opartą na cytacie z artefaktu, plus 1-2 alternatywy, gdzie każda alternatywa ma własne jednowierszowe uzasadnienie „dlaczego to również jest rozsądne” powiązane z sygnałem artefaktu. Słomiane alternatywy (opcja wymieniona tylko po to, aby Rekomendacja wyglądała dobrze) są zabronione — jeśli artefakty wspierają tylko jedną wartość, przedstaw kotwicę z jedną Rekomendacją i swobodnym nadpisaniem, i powiedz to. Kotwica może zostać **pominięta tylko wtedy, gdy PRD lub Kryteria Sukcesu dosłownie stwierdzają wartość** (np. `timeline_budget: "1 tydzień"` plus „musi zostać uruchomiony przed X” → `main_goal: speed` jest jednoznaczne); nigdy nie pomijaj, gdy istnieje jakakolwiek wiarygodna alternatywa. Dwa tryby awarii, których należy unikać: **(a) performatywne przesłuchanie** — zadawanie pytań, na które artefakty już odpowiadają, lub zadawanie więcej niż 3 pytań; **(b) fałszywa pewność siebie** — ciche decydowanie o kluczowym ujęciu bez oferowania użytkownikowi prawdziwego wyboru. Wyjątek dla niestandardowego kształtu MVP (Krok 5f) to jedyna ścieżka, która pozwala na pytania uzupełniające (do 2, oprócz 3 kotwic). Zalecany następny ruch z Kroku 10 to ta sama zasada zastosowana do przekazania: jedna rekomendacja z jednowierszowym uzasadnieniem, a nie lista „gotowych do planowania”, którą użytkownik musi sortować.

## Uwagi

- Ta umiejętność to **generator dokumentów**. Wynikiem jest `context/foundation/roadmap.md`, kropka. Planowanie zmian odbywa się w `/10x-plan`.
- Wywiad jest celowo oszczędny — maksymalnie 3 pytania kotwiczące (`main_goal`, `north_star`, `top_blocker`), każde zawierające jedną silną Rekomendację plus 1-2 alternatywy z własnym uzasadnieniem „dlaczego to jest rozsądne”. Obszary inwestycji są wyprowadzane z odpowiedzi, a nie zadawane. PRD wykonało już ciężką pracę diagnostyczną; Krok 5 przechwytuje tylko kluczowe wywołania, których artefakty nie mogą samodzielnie zablokować. Wyjątek dla niestandardowego kształtu MVP pozwala na maksymalnie 2 wymiany uzupełniające oprócz 3 kotwic; żadna inna ścieżka nie dodaje pytań uzupełniających.
- Sonda bazowa (Krok 4) zastępuje to, co kiedyś było pytaniem „co już jest na miejscu?”. Subagenci są tańsi niż uwaga użytkownika, a baza kodu jest bardziej niezawodna niż pamięć.
- Sekcja `## Done` jest pusta przy pierwszym generowaniu. Istnieje po to, aby `/10x-archive` miał stabilne miejsce do rejestrowania zamkniętych elementów — gdy zmiana, której `Change ID` odpowiada elementowi mapy drogowej, zostanie zarchiwizowana, `/10x-archive` zmienia status tego elementu na `Status: done` i dodaje wpis `## Done`. NIE wypełniaj jej wstępnie.
- Gdy umiejętność regeneruje istniejącą mapę drogową, poprzedni plik przenosi się do `foundation/archive/<dzisiaj>-roadmap.md`. Odczytanie różnicy między zarchiwizowaną wersją a nową jest najczystszym sposobem na zobaczenie, co zmieniło się w rozumieniu projektu — to jest udogodnienie, dla którego zaprojektowano konwencję dokumentów bazowych.
- Pola statusu cyklu życia `planning` i `in-progress` są zarezerwowane — dziś ta umiejętność emituje tylko `proposed` / `ready` / `blocked`, a `/10x-archive` zmienia status elementu na `done` po archiwizacji. Podłączenie `/10x-plan` i `/10x-implement` do zmiany statusu na `planning` / `in-progress` to przyszłe prace.