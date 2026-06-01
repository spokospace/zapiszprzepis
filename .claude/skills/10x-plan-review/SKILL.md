---
name: 10x-plan-review
description: >
  Review implementation plans for substance, feasibility, and architectural fitness.
  Use when user asks to review a plan, says "is this plan good", "check my plan",
  "review this plan", mentions plan review, or references a plan file and asks
  for feedback. Also trigger when user finishes /10x-plan and wants validation
  before starting /10x-implement.
---

# Przegląd planu

Wykryj problemy merytoryczne w planie implementacji, zanim zostanie napisana choćby jedna linia kodu. Wadliwy plan kosztuje godziny — wadliwy przegląd kosztuje minuty.

Tam, gdzie `/10x-impl-review` pyta „czy zbudowaliśmy to, co zaplanowaliśmy?”, to narzędzie pyta „czy ten plan faktycznie zadziała?”.

Dwa tryby:
- **Świeży przegląd**: analiza → ustalenia → interaktywne sortowanie
- **Wznowienie sortowania**: załaduj zapisany raport i przejdź do sortowania poszczególnych problemów

## Rozwiązanie wejściowe

1. Argument wskazuje na zapisany plik przeglądu (zawiera `<!-- PLAN-REVIEW-REPORT -->`) → **wznów sortowanie** (przejdź do kroku 6)
2. Argument to `<change-id>` i istnieje `context/changes/<change-id>/plan.md` → przejrzyj ten plan
3. Podano ścieżkę planu (np. `@context/changes/<change-id>/plan.md`) → użyj jej
4. Brak argumentu → wyświetl `context/changes/*/plan.md` (najnowszy według `change.md.updated`) za pomocą AskUserQuestion
5. Flaga `--quick` → tryb tylko dokumentu (pominięcie kroku 3)

Jeśli rozwiązana ścieżka planu zaczyna się od `context/archive/`, odmów zapisania przeglądu: wydrukuj "This change is archived. Reviews are not appended to archived plans." i ZATRZYMAJ.

## Krok 1: Ładowanie i skanowanie spójności wewnętrznej

W pełni odczytaj plik planu. Odczytaj również siostrzany plik `plan-brief.md` w tym samym folderze zmian, jeśli istnieje. Odczytaj `context/foundation/lessons.md`, jeśli jest obecny, i użyj zaakceptowanych reguł jako priorytetów podczas skanowania pod kątem problemów merytorycznych / wykonalności / naruszeń kontraktu — ustalenie, które powtarza znaną, powtarzającą się regułę, powinno mieć większą, a nie mniejszą wagę. Wyodrębnij:
- **Pożądany stan końcowy** i **Kryteria sukcesu**
- **Analiza stanu bieżącego** — udokumentowane ograniczenia i pułapki
- **Granice zakresu** — „Czego NIE robimy”
- **Fazy** — ścieżki plików, zmiany, zależności
- **Decyzje** i **założenia** (jawne i niejawne)
- **Sekcja postępu** — kanoniczny blok `## Progress` na dole planu (patrz `references/progress-format.md`)

Przed jakąkolwiek weryfikacją kodu, sprawdź plan pod kątem jego wewnętrznej spójności. Te trzy skany często wychwytują najcenniejsze problemy — problemy, które autor planu odkrył, ale nie doprowadził do końca:

- **Sprzeczność**: czy analiza stanu bieżącego dokumentuje ograniczenie, które implementacja ignoruje? (np. „npm nie uruchamia preuninstall dla zależności”, a fazy na tym polegają) Czy elementy z „Czego NIE robimy” pojawiają się ponownie w fazach? Czy faza zakłada zachowanie, które gdzie indziej jest uznane za wadliwe?
- **Luka w obietnicy**: każda zdolność obiecana w Pożądanym Stanie Końcowym / Kryteriach Sukcesu / Notatkach Migracyjnych powinna mieć fazę wspierającą. Jeśli kryteria sukcesu mówią „ograniczenie szybkości działa”, ale żadna faza tego nie buduje, implementator napotyka lukę w trakcie budowy.
- **Naruszenia kontraktu** (gdy plan definiuje lub używa punktów końcowych API): śledź przepływ danych między punktami końcowymi — jeśli krok B potrzebuje tokena/ID z kroku A, czy odpowiedź A go zawiera? Zaznacz nierozwiązane decyzje projektowe, które implementator musiałby zgadywać (który punkt końcowy, która metoda autoryzacji, które przechowywanie dla stanu ograniczenia szybkości).
- **Dotknięte powierzchnie kontraktu**: jeśli `docs/reference/contract-surfaces.md` istnieje w projekcie, odczytaj go i wyodrębnij listę nagłówków H2 jako nazwy powierzchni. Uruchom `grep -F` na tekście planu z jednym `-e <surface name>` na nagłówek. Dla każdego trafienia, odczytaj odpowiednią sekcję H2 `contract-surfaces.md` i zweryfikuj (a) czy plan dokładnie raportuje aktualny kształt powierzchni, oraz (b) czy jakakolwiek zmiana nazwy lub schematu jest oznaczona jako łamiąca z historią migracji dla konsumentów niższego szczebla. Jeśli plik nie istnieje, pomiń to sprawdzenie cicho — jest to konwencja opt-in, samoczynnie uruchamiana przy pierwszym użyciu przez `/10x-contract` lub gałąź sortowania `/10x-impl-review`. Lista grep pochodząca z H2 oznacza: gdy konsument dodaje nową powierzchnię do swojego pliku, następny przegląd planu automatycznie ją wykrywa — nie jest potrzebna edycja SKILL.md.
- **Spójność Postęp↔Faza** (kontrakt mechaniczny — patrz `references/progress-format.md`):
  - Dokładnie jeden nagłówek `## Progress` na dole plan.md.
  - Każda `## Phase N: <name>` w treści planu ma pasujący `### Phase N: <name>` w Progress.
  - Każdy punkt kryteriów sukcesu (pod `#### Automated Verification:` / `#### Manual Verification:`) w bloku fazy ma pasujący `- [ ] N.M <title>` (lub `- [x]`) w odpowiedniej podsekcji Progress.
  - Bloki fazy zawierają tylko zwykłe punkty `- ` — bez `- [ ]` lub `- [x]` poza sekcją Progress.
  Traktuj każdy z nich jako KRYTYCZNE ustalenie w ramach Kompletności Planu — `/10x-implement` nie będzie w stanie przetworzyć źle sformułowanej sekcji Progress.

## Krok 2: Ugruntowanie

Szybko, bez podagentów:
- **Ścieżki**: `ls -l` dla ≥5 ścieżek plików, które plan twierdzi, że modyfikuje. Nieistniejące ścieżki są krytyczne.
- **Symbole**: grep dla konkretnych funkcji/kluczy konfiguracyjnych, do których odwołuje się plan.
- **Spójność brief↔plan**: czy fazy, decyzje, zakres pasują?

Raportuj w linii: `Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓`. Eskaluj do ustalenia tylko w przypadku niepowodzenia.

## Krok 3: Weryfikacja bazy kodu (tylko tryb głęboki)

Pomiń, jeśli `--quick`.

Z kroków 1–2 zidentyfikuj **3–5 najbardziej ryzykownych twierdzeń** w planie — rzeczy, które, jeśli są błędne, wymuszają znaczną przeróbkę. Uruchom **jednego** sub-agenta (`subagent_type: "general-purpose"`) z trzema połączonymi zadaniami:

1. **Zweryfikuj najbardziej ryzykowne twierdzenia** w stosunku do rzeczywistego kodu. Dla każdego: co pokazuje kod, czy potwierdza, czy zaprzecza planowi, z dowodami file:line.
2. **Skanowanie promienia rażenia**: dla funkcji, stałych lub punktów końcowych, które plan modyfikuje, przeszukaj bazę kodu pod kątem innych wywołań/importerów niewymienionych w planie. Są to pliki, o których plan nie wie, że na nie wpływa.
3. **Sprawdzenie wzorca** (tylko jeśli plan wprowadza nowe wzorce): czy istniejące pliki w dotkniętych obszarach już to rozwiązują? Proliferacja wzorców jest częstym odkryciem.

Daj sub-agentowi ukierunkowane pytania z odpowiednimi ścieżkami plików — nie wyrzucaj całego planu. Skoncentrowane zapytanie znajduje więcej niż szerokie przeszukiwanie, ponieważ agent wie, czego szukać.

## Krok 4: Analiza merytoryczna

Przeanalizuj plan pod kątem pięciu wymiarów. Twórz ustalenia tylko dla rzeczywistych problemów — nie dodawaj „nie znaleziono problemów”.

### Zgodność ze stanem końcowym
Czy przechodząc fazy sekwencyjnie, system osiąga określony stan końcowy? Czy wszystkie kryteria sukcesu mogłyby zostać spełnione, podczas gdy cel pozostaje nieosiągnięty? Czy istnieje jakaś luka „ostatniej mili”, gdzie plan wykonuje 90% i zatrzymuje się?

### Oszczędna realizacja
Dla każdej fazy: „gdybym to usunął, czy stan końcowy nadal byłby osiągalny?” Zwróć uwagę na przedwczesną abstrakcję, dodatki „skoro już tu jesteśmy”, framework-gdzie-funkcja-by-wystarczyła, sprzeczności zakresu (elementy „nie robimy” pojawiające się w fazach).

### Dopasowanie architektoniczne
Czy to pasuje do istniejącego systemu? Nowe wzorce tam, gdzie istniejące by działały (proliferacja wzorców). Czyste granice modułów i prawidłowy kierunek zależności. Zmiany o dużym promieniu rażenia — fazy dotykające wielu plików w różnych modułach, zmiany w współdzielonych narzędziach. Niejasne „refaktoryzuj w razie potrzeby” lub „zaktualizuj odpowiednio”, które będą się rozrastać.

### Martwe punkty
Czego plan nie wziął pod uwagę? Ścieżki błędów (opisana tylko ścieżka sukcesu?), historia wycofywania (faza 3 zawodzi — czy możemy cofnąć?), wpływ zasobów/kosztów (wywołania API, praca obliczeniowa — ile to kosztuje przy oczekiwanym użyciu?), zmiany wartości domyślnych (domyślna wartość, która potraja koszt lub czas, powinna być wskazana), luki w testowaniu, granice bezpieczeństwa.

### Kompletność planu
Czy dokument jest wykonalny? Czy ścieżki plików są specyficzne (nie „gdzieś w src/")? Czy zmiany są na poziomie funkcji/metody? Czy kryteria sukcesu zawierają uruchamialne polecenia? Sekcje TBD, TODO lub sekcje zastępcze?

## Krok 5: Kompilacja ustaleń

Każde ustalenie zawiera:

- **ID**: F1, F2, F3…
- **Waga**: KRYTYCZNE / OSTRZEŻENIE / OBSERWACJA (jak źle, jeśli zignorowane)
- **Wpływ**: NISKI / ŚREDNI / WYSOKI (ile uwagi wymaga decyzja)
- **Wymiar**: jeden z: Zgodność ze stanem końcowym / Oszczędna realizacja / Dopasowanie architektoniczne / Martwe punkty / Kompletność planu
- **Tytuł**: jedna linia
- **Lokalizacja**: sekcja planu lub faza
- **Szczegóły**: co jest nie tak z dowodami — twierdzenie planu kontra to, co jest faktycznie prawdą, lub czego brakuje
- **Opcje naprawy**: 1 lub 2 (patrz poniżej)

### Wpływ

Ortogonalny do wagi. KRYTYCZNE z NISKIM wpływem (oczywista poprawka) jest tanie w rozwiązaniu; OSTRZEŻENIE z WYSOKIM wpływem (niejasne kompromisy, szeroki zasięg) zasługuje na dokładne przemyślenie.

| Wpływ | Znaczenie |
|---|---|
| 🏃 **NISKI** | Szybka decyzja. Poprawka jest oczywista i wąsko zakrojona. Bezpieczne do grupowania. |
| 🔎 **ŚREDNI** | Warto się zatrzymać. Prawdziwy kompromis lub nietrywialna edycja — pomyśl przed podjęciem decyzji. |
| 🔬 **WYSOKI** | Stawki architektoniczne. Szeroki promień rażenia, strategiczne implikacje lub niejasna najlepsza ścieżka. |

### Opcje naprawy

Domyślnie **jedna** poprawka. Przedstaw dwie tylko wtedy, gdy istnieje prawdziwy kompromis, który inteligentny recenzent chciałby rozważyć — nie każde ustalenie ma alternatywy warte tworzenia.

**Kiedy oferować dwie poprawki**: gdy podejście A i podejście B mają rzeczywistą zaletę, której brakuje drugiemu (np. „minimalna edycja, która łata objaw” kontra „refaktoryzacja, która usuwa klasę problemu”). Jeśli znajdziesz się na wymyślaniu słabej drugiej opcji, aby spełnić szablon, nie rób tego — przedstaw jedną poprawkę i przejdź dalej.

**Ustalenia o NISKIM wpływie**: pomiń dekompozycję — po prostu `Fix: [jedna linia]`. Hałas nie jest pomocny, gdy odpowiedź jest oczywista.

**Ustalenia o ŚREDNIM/WYSOKIM wpływie**: każda opcja otrzymuje:
```
[1-zdaniowe podejście] · Siła: [zaleta, najlepiej oparta na dowodach z planu/bazy kodu] · Kompromis: [koszt lub ryzyko] · Pewność: WYSOKA|ŚREDNIA|NISKA — [1-liniowe dlaczego] · Martwy punkt: [czego nie zweryfikowaliśmy, lub "Brak znaczących"]
```

Oferując dwie opcje, oznacz dokładnie jedną `⭐ Recommended`.

### Werdykty wymiarów i werdykt ogólny

Każdy wymiar: **ZALICZONY** / **OSTRZEŻENIE** / **NIEZALICZONY**.

- **SOLIDNY** — bezpieczny do wdrożenia. Wszystkie ZALICZONE lub ZALICZONE z drobnymi ostrzeżeniami.
- **DO POPRAWY** — wymaga ukierunkowanych poprawek. Wiele ostrzeżeń lub 1 niekrytyczny NIEZALICZONY.
- **DO PRZEMYŚLENIA** — fundamentalne problemy. Wiele NIEZALICZONYCH lub błędne podejście.

Posortuj ustalenia według wagi: KRYTYCZNE → OSTRZEŻENIE → OBSERWACJA. Ogranicz do 10 — skonsoliduj powiązane ustalenia, jeśli masz ich więcej.

## Krok 6: Przedstaw raport i zaoferuj zapisanie

Zwykły tekst, rysowanie ramek. Ustalenia pogrupowane według wagi; pomiń puste grupy. Wymiary ZALICZONE pojawiają się tylko w tabeli werdyktów, nigdy jako ustalenia.

```
═══════════════════════════════════════════════════════════
  PRZEGLĄD PLANU: [Tytuł planu]
  Tryb: Głęboki / Szybki  |  Data: RRRR-MM-DD
  Ustalenia: [N krytycznych] [N ostrzeżeń] [N obserwacji]
═══════════════════════════════════════════════════════════

  Zgodność ze stanem końcowym    ZALICZONY    ✅
  Oszczędna realizacja         OSTRZEŻENIE ⚠️   (1 ustalenie)
  Dopasowanie architektoniczne  ZALICZONY    ✅
  Martwe punkty            NIEZALICZONY    ❌   (1 ustalenie)
  Kompletność planu      OSTRZEŻENIE ⚠️   (1 ustalenie)

  Ugruntowanie: 5/5 ścieżek ✓, 3/3 symboli ✓, brief↔plan ✓
  ► Ogólnie: DO POPRAWY

═══════════════════════════════════════════════════════════
  KRYTYCZNE USTALENIA ❌
═══════════════════════════════════════════════════════════

  F1 — Brak wycofywania dla uzupełniania 50M wierszy
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Waga:  ❌ KRYTYCZNE
    Wpływ:    🔬 WYSOKI — stawki architektoniczne; pomyśl dokładnie przed podjęciem decyzji
    Wymiar: Martwe punkty
    Lokalizacja:  Faza 3 — Zmiany w bazie danych

    Szczegóły:
    Plan dodaje kolumnę NOT NULL do użytkowników (50M wierszy), ale żadna faza
    nie obejmuje wycofywania, jeśli uzupełnianie danych nie powiedzie się w trakcie. Częściowe uzupełnianie
    pozostawia tabelę w niespójnym stanie.

    Poprawka A ⭐ Zalecana: Uczyń kolumnę dopuszczającą wartości null + oddzielne, restartowalne uzupełnianie
      Siła:   Restartowalne; częściowy postęp nie jest destrukcyjny; pasuje do
                  wzorca użytego dla users.email_verified_at w ostatnim kwartale.
      Kompromis:   Dwa wdrożenia (dodaj dopuszczające wartości null → uzupełnij → wymuś NOT NULL).
      Pewność: WYSOKA — to dokładnie to podejście zostało czysto wdrożone 3 miesiące temu.
      Martwy punkt: Krok wymuszania nadal potrzebuje własnej notatki o wycofywaniu.

    Poprawka B: Dodaj jawną fazę wycofywania z pełną migawką tabeli
      Siła:   Pojedyncze wdrożenie; wycofywanie jest atomowe.
      Kompromis:   Migawka 50M wierszy jest kosztowna pod względem miejsca na dysku i czasu blokady.
      Pewność: ŚREDNIA — nie zmierzono kosztu migawki na tabeli tej wielkości.
      Martwy punkt: Opóźnienie replikacji podczas migawki jest niezweryfikowane.

═══════════════════════════════════════════════════════════
  OSTRZEŻENIA ⚠️
═══════════════════════════════════════════════════════════

  F2 — Wzorzec dostawcy dla 2 źródeł konfiguracji
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Waga:  ⚠️ OSTRZEŻENIE
    Wpływ:    🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
    Wymiar: Oszczędna realizacja
    Lokalizacja:  Faza 1 — Refaktoryzacja konfiguracji

    Szczegóły:
    Plan buduje pełny system konfiguracji w oparciu o wzorzec dostawcy dla tylko dwóch
    źródeł (env + plik). Bezpośrednie scalenie słowników osiąga ten sam stan końcowy
    z ~1/3 kodu.

    Poprawka: Zastąp abstrakcję dostawcy konfiguracji bezpośrednim scaleniem słowników w
         load_config(). Wprowadź wzorzec dostawcy tylko wtedy, gdy pojawi się trzecie
         źródło.
      Siła:   Mniej kodu, mniej koncepcji do utrzymania.
      Kompromis:   Jeśli trzecie źródło pojawi się wkrótce, refaktoryzujemy dwukrotnie.
      Pewność: WYSOKA — istniejąca baza kodu wszędzie indziej stosuje ten wzorzec „dodawania abstrakcji
                  w razie potrzeby”.
      Martwy punkt: Plany dotyczące dodatkowych źródeł konfiguracji nie zostały zbadane.

  ···

  F3 — Nieprecyzyjne „refaktoryzuj narzędzia w razie potrzeby”
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Waga:  ⚠️ OSTRZEŻENIE
    Wpływ:    🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
    Wymiar: Kompletność planu
    Lokalizacja:  Faza 2

    Szczegóły:
    „Refaktoryzuj format_output w razie potrzeby” — format_output jest importowany przez
    12 plików w 4 modułach. Implementator nie ma wskazówek.

    Poprawka: Określ dokładne zmiany sygnatury i wymień wywołujących, którzy wymagają aktualizacji.

═══════════════════════════════════════════════════════════
```

### Zasady formatowania raportu

- **Linia tytułu ustalenia** zawiera tylko ID i krótki tytuł — nic więcej. Wszystko inne znajduje się poniżej jako oznaczone pola, dzięki czemu każdy wiersz jest krótki i łatwy do skanowania.
- **Zawsze łącz ikony ze słowem.** Nigdy nie używaj samej ikony jako jedynego sygnału — `❌ KRYTYCZNE`, a nie tylko `❌`. Dzięki temu raport jest czytelny podczas szybkiego przeglądania i nie zmusza użytkownika do zapamiętywania znaczenia każdej ikony.
- **Wpływ zawsze zawiera swoje jednowierszowe znaczenie** (skopiuj z tabeli Wpływ — „stawki architektoniczne; pomyśl dokładnie przed podjęciem decyzji” / „prawdziwy kompromis; zatrzymaj się, aby to przemyśleć” / „szybka decyzja; poprawka jest oczywista i wąsko zakrojona”). Dzięki temu NISKI/ŚREDNI/WYSOKI jest zrozumiały w miejscu użycia, zamiast polegać na tym, że użytkownik pamięta tabelę.
- Waga, Wpływ, Wymiar, Lokalizacja znajdują się każdy w osobnej linii z wyrównanymi etykietami. Szczegóły zaczynają się w osobnej linii pod etykietą `Detail:`, dzięki czemu mogą naturalnie zawijać się.

Następnie zapytaj:

```
question: "Przegląd planu zakończony. Jak chcesz postąpić?"
header: "Przegląd planu — [N] ustaleń"
options:
  - label: "Sortuj ustalenia"
    description: "Przejdź przez każde ustalenie i podejmij decyzję."
  - label: "Zapisz raport i sortuj później"
    description: "Zapisz pełny raport. Wznów za pomocą /10x-plan-review <report-path>."
  - label: "Tylko zapisz raport"
    description: "Zapisz i zakończ — sam zajmę się ustaleniami."
multiSelect: false
```

### Zapisywanie raportu

Zapisz do `context/changes/<change-id>/reviews/plan-review.md` (jeden przegląd planu na folder zmiany; ponowne uruchomienie nadpisuje). Zaktualizuj `change.md`: `status: plan_reviewed`, `updated: <today>`.

```markdown
<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: [Tytuł planu]

- **Plan**: [ścieżka pliku planu]
- **Tryb**: Głęboki / Szybki
- **Data**: RRRR-MM-DD
- **Werdykt**: [SOLIDNY/DO POPRAWY/DO PRZEMYŚLENIA]
- **Ustalenia**: [N krytycznych] [N ostrzeżeń] [N obserwacji]

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność ze stanem końcowym | ZALICZONY/OSTRZEŻENIE/NIEZALICZONY |
| Oszczędna realizacja | ZALICZONY/OSTRZEŻENIE/NIEZALICZONY |
| Dopasowanie architektoniczne | ZALICZONY/OSTRZEŻENIE/NIEZALICZONY |
| Martwe punkty | ZALICZONY/OSTRZEŻENIE/NIEZALICZONY |
| Kompletność planu | ZALICZONY/OSTRZEŻENIE/NIEZALICZONY |

## Ugruntowanie
[linia ugruntowania]

## Ustalenia

### F1 — Brak wycofywania dla uzupełniania 50M wierszy

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🔬 WYSOKI — stawki architektoniczne; pomyśl dokładnie przed podjęciem decyzji
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 3 — Zmiany w bazie danych
- **Szczegóły**: Plan dodaje kolumnę NOT NULL do użytkowników (50M wierszy), ale żadna faza nie obejmuje wycofywania, jeśli uzupełnianie danych nie powiedzie się w trakcie.
- **Poprawka A ⭐ Zalecana**: Uczyń kolumnę dopuszczającą wartości null + oddzielne, restartowalne uzupełnianie
  - Siła: Restartowalne; częściowy postęp nie jest destrukcyjny.
  - Kompromis: Dwa wdrożenia.
  - Pewność: WYSOKA — to podejście zostało czysto wdrożone w ostatnim kwartale.
  - Martwy punkt: Krok wymuszania nadal potrzebuje własnej notatki o wycofywaniu.
- **Poprawka B**: Dodaj jawną fazę wycofywania z pełną migawką tabeli
  - Siła: Pojedyncze wdrożenie; wycofywanie jest atomowe.
  - Kompromis: Migawka 50M wierszy jest kosztowna pod względem miejsca na dysku i czasu blokady.
  - Pewność: ŚREDNIA — koszt migawki niezweryfikowany dla tej wielkości.
  - Martwy punkt: Opóźnienie replikacji podczas migawki jest niezweryfikowane.
- **Decyzja**: OCZEKUJĄCA

### F3 — Nieprecyzyjne „refaktoryzuj narzędzia w razie potrzeby”

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2
- **Szczegóły**: „Refaktoryzuj format_output w razie potrzeby” — importowany przez 12 plików w 4 modułach.
- **Poprawka**: Określ dokładne zmiany sygnatury i wymień wywołujących, którzy wymagają aktualizacji.
- **Decyzja**: OCZEKUJĄCA
```

Znacznik `<!-- PLAN-REVIEW-REPORT -->` i pola `Decision: PENDING` umożliwiają tryb wznowienia.

„Zapisz i sortuj później” → zapisz, wydrukuj ścieżkę, przypomnij o uruchomieniu `/10x-plan-review <saved-report-path>`.
„Sortuj” → przejdź do kroku 7.

## Krok 7: Interaktywne sortowanie

### Tryb wznowienia

Jeśli wprowadzono za pomocą zapisanego pliku: odczytaj go, przeanalizuj nagłówki `### F`, filtruj do `Decision: PENDING`. Jeśli brak, powiedz „Wszystkie ustalenia posortowane” i zatrzymaj się.

### Pętla sortowania

Przejdź przez ustalenia w kolejności ważności (KRYTYCZNE → OSTRZEŻENIE → OBSERWACJA). Dla każdego:

**Z 2 opcjami naprawy:**
```
question: "F[N] — [tytuł]\n\nWaga: [ikona wagi] [WAGA]\nWpływ: [ikona wpływu] [POZIOM] — [znaczenie]\nWymiar: [wymiar]\nLokalizacja: [lokalizacja]\n\nSzczegóły: [szczegóły]\n\n[Blok poprawki A]\n\n[Blok poprawki B]"
header: "Ustalenie [bieżące] z [całkowita pozostała liczba]"
options:
  - label: "Zastosuj poprawkę A ⭐"
    description: "[Jednowierszowa poprawka A]"
  - label: "Zastosuj poprawkę B"
    description: "[Jednowierszowa poprawka B]"
  - label: "Napraw inaczej"
    description: "Inne podejście — porozmawiajmy."
  - label: "Pomiń"
    description: "Nie warto teraz się tym zajmować."
  - label: "Akceptuj ryzyko"
    description: "Zrozumiano — zajmę się tym podczas implementacji."
  - label: "Nie zgadzam się"
    description: "To nie jest problem — odrzuć."
multiSelect: false
```

**Z 1 opcją naprawy:** te same opcje, ale zastąp „Zastosuj poprawkę A/B” pojedynczym „Napraw w planie”.

**Obsługa odpowiedzi:**
- **Zastosuj poprawkę A/B / Napraw w planie**: pokaż dokładną edycję planu (przed/po). Krótkie potwierdzenie, a następnie zastosuj. Oznacz NAPRAWIONE (zapisz, która poprawka, np. „Naprawiono za pomocą poprawki A”).
- **Napraw inaczej**: zapytaj o preferowane podejście, zastosuj, oznacz NAPRAWIONE.
- **Pomiń** → POMINIĘTE. **Akceptuj ryzyko** → ZAAKCEPTOWANE. **Nie zgadzam się** → ODRZUCONE. Idź dalej, nie kłóć się.

Po każdej decyzji, jeśli pracujesz z zapisanego pliku, zaktualizuj jego pole `Decision:`.

### Podsumowanie

```
═══════════════════════════════════════════════════════════
  SORTOWANIE ZAKOŃCZONE
═══════════════════════════════════════════════════════════

  Naprawiono:     F1 (Poprawka A), F3   (2)
  Pominięto:   F4               (1)
  Zaakceptowano:  F2               (1)
  Odrzucono: F5               (1)

  ► Werdykt po poprawkach: [zaktualizowany, jeśli poprawki go zmieniły, np. DO POPRAWY → SOLIDNY]
═══════════════════════════════════════════════════════════
```

## Uwagi

- To jest umiejętność **przeglądu**. Analizuj i raportuj — nie przepisuj planu, chyba że zostanie to poproszone podczas sortowania.
- Bądź konkretny. „Faza 3 wprowadza drugi system zdarzeń obok istniejącego EventBus w `src/core/events.ts`” — a nie „architektura może mieć problemy”.
- Rozróżnij „nie zadziała” (NIEZALICZONY) od „może być lepiej” (OSTRZEŻENIE).
- Jeśli plan jest naprawdę dobry, powiedz to krótko i zakończ. Nie twórz ustaleń.
- Wpływ dotyczy **wysiłku decyzyjnego**, a nie **wagi**. NISKI wpływ na KRYTYCZNE ustalenie oznacza, że poprawka jest oczywista; WYSOKI wpływ na OSTRZEŻENIE oznacza, że kompromis jest realny.
- Dwie opcje naprawy tylko wtedy, gdy istnieje prawdziwy kompromis. Nie wymyślaj alternatyw dla trywialnych poprawek.
- Podczas sortowania utrzymuj tempo. Użytkownik już przeczytał raport — przedstaw ustalenie, podejmij decyzję, idź dalej.
- Podczas stosowania poprawki do planu, dokonuj minimalnych, ukierunkowanych edycji. Nie restrukturyzuj całego planu dla jednego ustalenia.