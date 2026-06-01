---
name: 10x-frame
description: >
  Challenge framing assumptions about WHAT to build before planning HOW. Use
  when input is a "bug + proposed fix", a scope question, a design choice,
  or any case where the observation and the stated cause (or the problem and
  the solution) are presented as one. Trigger phrases: "fix", "bug",
  "broken", "root cause", "should we even", "is this the right", "challenge
  the assumption", "rethink", "before I plan". Use BEFORE /10x-plan, not in
  place of it.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Bash
  - Task
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---

# Frame: Zakwestionuj ramy przed planowaniem

Plany zbudowane na błędnym sformułowaniu problemu są doskonałymi rozwiązaniami dla niewłaściwego pytania. Ta umiejętność służy jednemu celowi: oddzieleniu **obserwacji** od **podanej przyczyny** — i **problemu** od **proponowanego rozwiązania** — zanim rozpocznie się jakiekolwiek planowanie.

Kształt, którym zajmuje się ta umiejętność, jest ogólny: użytkownik opisuje coś (obserwację, postrzegany problem, zakres, który chce podjąć) i proponuje odpowiedź (przyczynę, podejście, strukturę planu) w tym samym zdaniu. Te dwie rzeczy są traktowane jako jeden fakt. Idealny /10x-plan dostarcza wtedy idealne rozwiązanie — a rzeczywisty problem pozostaje, ponieważ ramy były błędne; plan był prawidłowy; użytkownik stracił dzień.

Ta umiejętność to etap ramowania. /10x-plan odpowiada na pytanie *jak to zbudować*. /10x-frame odpowiada na pytanie *co jest właściwie właściwą rzeczą do zaplanowania*.

## Kiedy używać, kiedy pominąć

**Użyj, gdy**: dane wejściowe mają kształt błędu ("X jest zepsute, zbudujmy Y"), kształt zakresu ("powinniśmy podzielić to na dwa plany", "czy to w ogóle właściwy zakres"), kształt projektu ("które podejście w ogóle chcemy") lub kształt założenia ("zakładamy X — czy to prawda?"). Użyj również, gdy stawka jest wysoka, gdy system jest nieznany użytkownikowi, lub gdy /10x-plan ma rozpocząć zadanie, które pachnie podaną przyczyną, a nie zweryfikowaną.

**Pomiń, gdy**: zadanie jest czysto mechaniczną zmianą ("zmień nazwę tej funkcji", "zwiększ wersję zależności"), użytkownik sam już opracował ramy i je zweryfikował ("potwierdziłem to — zaplanuj poprawkę"), lub żądanie jest jasno określonym zakresem funkcji bez podstawowego założenia do zakwestionowania.

W razie wątpliwości, ta umiejętność zadaje krótką serię pytań i szybko kończy działanie, jeśli ramy okażą się solidne. Koszt uruchomienia jej na jasnym żądaniu: ~2–3 pytania. Koszt pominięcia jej na błędnie sformułowanym zadaniu: błędny plan i stracony dzień.

## Związek z innymi umiejętnościami

- `/10x-research` — szeroka eksploracja bazy kodu. Frame może przyjmować dokument badawczy jako dane wejściowe, ale go nie zastępuje.
- `/10x-plan` — akceptuje dane wyjściowe ram jako dane wejściowe. Frame Brief JEST prawidłowym pierwszym argumentem dla /10x-plan.
- `/10x-plan-review` — waliduje istniejący plan. Frame waliduje *założenie* zanim plan powstanie.

Frame Brief jest użyteczny samodzielnie (jako artefakt dyskusji lub do określenia zakresu szybkiej poprawki) — nie wymaga, aby po nim następował /10x-plan.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano ścieżkę pliku lub change-id** (np. `/10x-frame @context/changes/foo/research.md` lub `/10x-frame foo`), rozwiąż ją: `<change-id>` odnosi się do `context/changes/<change-id>/research.md` (przeczytaj, jeśli istnieje). Przeczytaj plik W CAŁOŚCI i przejdź do Kroku 1.
2. **Jeśli opis problemu został podany w tekście**, przejdź do Kroku 1.
3. **Jeśli nic nie zostało podane**, odpowiedz:

```
Pomogę Ci sprawdzić, czy prawidłowo formułujesz problem, zanim zaplanujesz rozwiązanie.

Proszę podać:
1. Obserwację — co się dzieje, co widzisz lub jaki zakres rozważasz?
2. Twoje początkowe ramy — co według Ciebie jest przyczyną, jakie podejście masz na myśli lub jak byś podzielił pracę?
3. (Opcjonalnie) Wszelkie powiązane badania, wcześniejsze incydenty lub pliki, które powinienem przeczytać

Wskazówka: przekaż badania bezpośrednio — `/10x-frame @context/changes/<change-id>/research.md` (lub po prostu `<change-id>`)
```

Następnie poczekaj.

## Proces

### Krok 1: Uchwyć ramy — oddziel obserwację od podanej przyczyny

To najważniejszy krok. Nie pomijaj go. Nie łącz go.

Przeczytaj `context/foundation/lessons.md`, jeśli istnieje, i użyj wcześniejszych lekcji dotyczących kształtowania ram (powtarzające się pułapki ramowania i przyjęte zasady) jako priorytetów podczas konstruowania mapy wymiarów w Kroku 2 — są one kontekstem nośnym, a nie opcjonalnym czytaniem.

Przeczytaj KAŻDY plik, o którym wspomniał użytkownik, W CAŁOŚCI. Następnie wyodrębnij i zapisz trzy rzeczy, **wyraźnie**:

- **Zgłoszona obserwacja** — dosłowna, obserwowalna rzecz. Nie przyczyna. Nie poprawka. Efekt, który widzi użytkownik lub operator, lub postawione pytanie dotyczące zakresu/projektu.
- **Podana przyczyna lub podejście użytkownika** — co według niego powoduje obserwację, lub ramy, które wnosi do pracy.
- **Proponowany kierunek użytkownika** — co chce z tym zrobić.

Powtórz je jako trzy oddzielne punkty i potwierdź:

```
Upewnijmy się, że dobrze to rozumiem:

  Obserwacja (co jest stwierdzone):     [dosłowny efekt lub pytanie dotyczące zakresu/projektu]
  Twoje początkowe ramy:            [teoria lub podejście użytkownika]
  Twój proponowany kierunek:         [co chce z tym zrobić]

Zamierzam zakwestionować ramy, zanim zaplanujemy pracę. Obserwacja jest ustalona
— to jest to, co wiemy. Wszystko inne jest hipotezą, dopóki nie zostanie zweryfikowane.
```

Ramy są w tym momencie zablokowane. Nawet jeśli użytkownik się sprzeciwi ("po prostu zaplanuj poprawkę"), nie łącz obserwacji z ramami. Cała umiejętność opiera się na tym rozdzieleniu.

Jeśli użytkownik nie podał jasnych początkowych ram ("coś jest nie tak, napraw to"), pomiń punkt dotyczący ram i zanotuj, że jest to czysto obserwacyjne — umiejętność staje się bardziej otwarta, ale protokół nadal obowiązuje.

### Krok 1.5: Pytania wyjaśniające przed wysyłką

Ten krok zawsze jest wykonywany. Przed zbudowaniem mapy wymiarów (Krok 2) lub wysłaniem równoległych podagentów (Krok 3), zatrzymaj się na jedną rundę pytań wyjaśniających przy każdym wywołaniu. Celem jest usunięcie niejasności dotyczących *obserwacji i zakresu* — "który z tych elementów jest głównym problemem?", "czy to jedna obserwacja, czy kilka?", "czy obserwowalny jest pojedynczym objawem, czy klasą objawów?" — tak, aby mapa wymiarów była zbudowana w oparciu o skoncentrowaną obserwację, a nie wielopunktową listę zadań.

Użyj AskUserQuestion z **2–3 pytaniami** w jednej rundzie. Każda opcja opisuje obserwację lub pozycję zakresu — co użytkownik faktycznie widzi, lub który fragment pracy chce najpierw zbadać — nigdy przyczynę, podejście lub poprawkę. Zawsze dołącz opcję "Nie jestem pewien / jeszcze ich nie rozdzieliłem", odzwierciedlającą zasadę pewności jako sygnału z Kroku 4.

Te pytania są ograniczone przez poniższą zasadę #4 ("Pytania zawężające ≠ pytania dotyczące rozwiązania"). Pytania przed wysyłką opisują obserwacje lub pozycje zakresu, nigdy przyczyny ani poprawki. Jeśli zauważysz, że tworzysz opcję, która proponuje poprawkę lub podejście, przekroczyłeś terytorium /10x-plan — zatrzymaj się i przepisz ją jako obserwację.

Zapisz odpowiedzi w rejestrze ramowania wraz z zapisem z Kroku 1; Frame Brief z Kroku 6 zachowuje oba jako oddzielne punkty w sekcji "Initial Framing (preserved)" (nowa linia `Pre-dispatch narrowing`). Oryginalna obserwacja, podana przyczyna i proponowany kierunek pozostają dosłowne z Kroku 1; zawężenie z Kroku 1.5 nakłada się na nie, nie jako zamiennik.

Ten krok nie wysyła podagentów — to pozostaje zadaniem Kroku 3.

### Krok 2: Zmapuj wymiary problemu

Skonstruuj **mapę** wymiarów, z których może pochodzić obserwacja — dla SYTUACJI TEGO użytkownika. Nie sięgaj po ogólny szablon; wartość mapy polega na tym, że jest ona dopasowana do systemu, bazy kodu lub przestrzeni projektowej, którą analizujesz.

Jak zbudować mapę:

- **Najpierw przeczytaj.** Otwórz pliki, o których wspomniał użytkownik. Otwórz sąsiednie. Śledź ścieżkę od podanej przyczyny do zaobserwowanego efektu — *czy ta ścieżka to przepływ danych w czasie wykonania, łańcuch decyzji projektowych, czy sekwencja założeń*. Wymiary wynikają z tego, co faktycznie istnieje: etapy wejścia, transformacji, stanu, efektów ubocznych; lub osie przestrzeni projektowej; lub warstwy decyzji o zakresie. Nie wymieniaj wymiarów, dla których nie widziałeś dowodów.
- **Użyj podagentów, gdy powierzchnia jest duża lub nieznana.** Utwórz jednego lub dwóch podagentów Explore z promptami takimi jak: "Śledź ścieżkę od <podanej przyczyny> do <zaobserwowanego efektu>. Wymień każdy odrębny etap lub oś, przez którą przechodzi łańcuch, z odniesieniami do pliku:linii lub dokumentu:sekcji." Mapa to to, co zwracają — a nie to, co zgadłeś przed przeczytaniem.
- **Traktuj każdy wymiar jako możliwe źródło.** Użyteczny wymiar to taki, w którym, gdyby ramy pękły w tym punkcie, zobaczyłbyś mniej więcej tę obserwację. Wymiary, które nie mogłyby wiarygodnie wywołać obserwacji, nie należą do mapy.

**Przypnij obserwację do mapy**: w którym wymiarze ląduje ramowanie użytkownika? Gdzie indziej *mogłaby* pochodzić obserwacja? Ramowanie użytkownika to jeden węzeł na mapie; reszta mapy to przestrzeń hipotez.

Przedstaw mapę z powrotem jako tekst, krótko:

```
Obserwacja może pochodzić z któregokolwiek z tych wymiarów:

  1. [Wymiar A] — [co poszłoby nie tak / co zakłada ramowanie tutaj]
  2. [Wymiar B] — [co poszłoby nie tak / co zakłada ramowanie tutaj]   ← bieżące ramowanie użytkownika
  3. [Wymiar C] — [co poszłoby nie tak / co zakłada ramowanie tutaj]
  4. [Wymiar D] — [co poszłoby nie tak / co zakłada ramowanie tutaj]

Zamierzam zbadać każdy z nich równolegle, zanim podejmę decyzję.
```

### Krok 3: Utwórz równoległe agenty hipotez

Użyj TaskCreate, aby zarejestrować jedno zadanie dla każdego wiarygodnego wymiaru. Następnie utwórz równoległe podagenty — zazwyczaj 2–4, maksymalnie 5 — używając narzędzia Task, **wszystkie w jednej wiadomości** dla współbieżności.

Dla każdej hipotezy podagent bada: "**Jeśli ramy pękły w tym wymiarze, jakich dowodów byśmy się spodziewali i czy takie dowody istnieją?**"

- Użyj `subagent_type: "Explore"` dla "znajdź kod lub dokument, który obsługuje X, pokaż mi strukturę".
- Użyj `subagent_type: "general-purpose"` dla "śledź ten łańcuch i powiedz mi, czy założenie Y jest prawdziwe".

Każdy prompt musi zawierać:

- Dosłowną obserwację z Kroku 1 (dosłownie).
- Konkretną hipotezę wymiarową, która jest testowana.
- Ramowanie oczekiwanych dowodów: "Co byśmy zobaczyli, gdyby TO był wymiar, w którym ramy pękają? Szukaj tego. Zgłoś, czy jest obecne, częściowe, czy nieobecne, z odniesieniami do pliku:linii lub dokumentu:sekcji."
- Dyrektywę tylko do odczytu — bez edycji.

Po powrocie wszystkich, zsyntetyzuj: które hipotezy mają dowody **silne**, **słabe** lub **brak**? Hipoteza, która ma silne dowody, a początkowe ramy użytkownika ich nie miały, jest kandydatem do przeformułowania.

### Krok 4: Pytania zawężające (sokratyczne, nie dotyczące rozwiązania)

Użyj AskUserQuestion. **Pytania i opcje tutaj są fundamentalnie różne od tych w /10x-plan**: w /10x-plan opcje to *wybory rozwiązania*; tutaj opcje to *rozróżnienia hipotez*. Odpowiedź użytkownika zawęża przestrzeń hipotez.

**Zasady dotyczące pytań zawężających:**

- Każde pytanie powinno izolować jeden lub dwa wymiary mapy. Właściwe pytanie to takie, którego odpowiedź włącza lub wyklucza wymiary.
- Opcje opisują **obserwacje lub pozycje projektowe** — co użytkownik faktycznie widzi, lub po której stronie rzeczywistego kompromisu się znajduje — a nie przyczyny lub rozwiązania.
- Nagłówek (`header`) powinien być krótki: np. "Wzorzec", "Kiedy", "Zakres", "Kompromis".
- Celuj w 2–5 pytań łącznie — wystarczająco, aby triangulować, nie za dużo, aby przeciągać.
- ZAWSZE dołącz opcję "Nie jestem pewien / jeszcze nie sprawdziłem". Pewność użytkownika sama w sobie jest sygnałem; fałszywa pewność jest wrogiem.

Pytanie zawężające, które nie zmienia rankingu hipotez, jest zmarnowane. **Zaprojektuj każde pytanie tak, aby było decydujące.** Jedno dobrze ukierunkowane pytanie, na które udzielono szczerej odpowiedzi, często samo rozwiązuje całe pytanie o przeformułowanie.

Jeśli dowody hipotez z Kroku 3 są już rozstrzygające (jedna hipoteza ma silne dowody, inne nie mają żadnych), możesz pominąć pytania i przejść do Kroku 5 — ale powiedz to wyraźnie: "Krok 3 znalazł silne dowody dla [hipotezy] i żadnych dla pozostałych. Pomijam etap pytań; przeformułowanie bezpośrednio."

### Krok 5: Sprawdzenie między systemami — testowanie wiodącej hipotezy pod presją

Przed sfinalizowaniem przeformułowania, przetestuj je pod presją z innej perspektywy niż badanie, które je wygenerowało. Celem jest ujawnienie dowodów, których badanie hipotezy nie zauważyło, a nie potwierdzenie tego, w co już wierzysz.

Wybierz te, które są przydatne w danym przypadku:

- **Niezależne wyszukiwanie.** Utwórz nowego podagenta Explore z promptem, który NIE nazywa wiodącej hipotezy. Opisz tylko obserwację i zapytaj: "Co w tym systemie lub przestrzeni projektowej jest najbardziej prawdopodobną przyczyną? Szukaj bez uprzedzeń." Jeśli agent niezależnie dojdzie do tej samej hipotezy, pewność wzrasta. Jeśli ujawni coś innego, to jest to sygnał, który warto dokładnie przeczytać.
- **Szukaj wcześniejszych wystąpień.** Przeszukaj `context/changes/**/` i `context/archive/**/`, komunikaty commitów i historię problemów pod kątem podobnych obserwacji lub decyzji o zakresie w tym projekcie. Wcześniejsze incydenty i wcześniejsze decyzje często zawierają odpowiedź lub wykluczają jedną.
- **Sprawdź odwrotność.** Jakie inne dowody przewidywałaby wiodąca hipoteza — których jeszcze nie sprawdziłeś? Zweryfikuj je. Co NIE powinno być widoczne, jeśli hipoteza jest prawdziwa? Potwierdź jej brak.
- **Sprawdź ponownie spójność z podanymi ramami użytkownika.** Jeśli ich oryginalne ramy nadal równie dobrze pasują do dowodów, przeformułowanie może być niepotrzebne. Nie zastępuj działających ram bardziej eleganckimi.

Jeśli testowanie pod presją wzmacnia wiodącą hipotezę, zablokuj pewność. Jeśli ujawni wiarygodną alternatywę lub zaprzeczy hipotezie, **zatrzymaj się** i ponownie uruchom Krok 3 z nową hipotezą na mapie. Przeformułowanie jest wartościowe tylko wtedy, gdy przetrwa uczciwą próbę jego obalenia.

### Krok 6: Zsyntetyzuj Frame Brief

Rozwiąż folder zmian przed zapisaniem:

- Jeśli wywołano jako `/10x-frame <change-id>` i `context/changes/<change-id>/` istnieje, zapisz do niego.
- W przeciwnym razie utwórz `<change-id>` w formacie kebab-case z obserwacji i utwórz folder + `change.md` (odzwierciedlając semantykę `/10x-new`) przed zapisaniem.
- Odmów, jeśli rozwiązana ścieżka zaczyna się od `context/archive/` — wydrukuj: "Ta zmiana jest zarchiwizowana. Zamiast tego otwórz nową zmianę za pomocą `/10x-new`." i ZATRZYMAJ.

Zaktualizuj `change.md`: ustaw `updated: <dzisiaj>` i, tylko jeśli bieżący `status` to `new`, zmień na `status: preparing`.

Zapisz brief do `context/changes/<change-id>/frame.md` (pojedynczy artefakt na zmianę).

Użyj tego szablonu:

````markdown
# Frame Brief: [Temat]

> Etap ramowania przed /10x-plan. Ten dokument przedstawia, co *faktycznie*
> jest problemem, oddzielone od tego, co początkowo zakładano.

## Zgłoszona obserwacja

[Dosłowny obserwowalny efekt lub postawione pytanie dotyczące zakresu/projektu — skopiowane z
Kroku 1, bez zmian.]

## Początkowe ramy (zachowane)

- **Podana przyczyna lub podejście użytkownika**: [z Kroku 1]
- **Proponowany kierunek użytkownika**: [z Kroku 1]
- **Zawężenie przed wysyłką**: [z Kroku 1.5 — pozycja obserwacji/zakresu wybrana przez użytkownika, jego słowami; "jeszcze nie rozdzielone" jest samo w sobie ważną odpowiedzią, którą warto zapisać]

## Mapa wymiarów

Obserwacja może pochodzić z któregokolwiek z tych wymiarów:

1. **[Wymiar A]** — [co poszłoby nie tak / co zakłada ramowanie tutaj]
2. **[Wymiar B]** — [...]  ← początkowe ramy
3. **[Wymiar C]** — [...]
4. **[Wymiar D]** — [...]

## Badanie hipotez

| Hipoteza | Dowody | Werdykt |
| --- | --- | --- |
| [Wymiar A: krótkie twierdzenie] | [plik:linia / dokument:sekcja / obserwacje] | SILNE / SŁABE / BRAK |
| [Wymiar B: początkowe ramy] | [dowody] | SILNE / SŁABE / BRAK |
| [Wymiar C] | [dowody] | SILNE / SŁABE / BRAK |
| [Wymiar D] | [dowody] | SILNE / SŁABE / BRAK |

## Sygnały zawężające

Decydujące obserwacje z Kroku 4 (raporty użytkownika + ustalenia podagenta), które
zawęziły przestrzeń hipotez:

- [Obserwacja, która włączyła lub wykluczyła wymiar]
- [Obserwacja, która włączyła lub wykluczyła wymiar]

## Konwencja między systemami

[Jak zazwyczaj obsługuje się tę klasę obserwacji? Czy wiodąca
hipoteza pasuje do konwencji?]

## Przeformułowane (lub potwierdzone) sformułowanie problemu

> **Rzeczywisty problem do zaplanowania to**: [jedno zdanie — korzeń, nie powierzchnia]

[2–3 zdania wyjaśniające, dlaczego jest to prawdziwy problem i co by się zmieniło,
gdyby został rozwiązany. Jeśli oryginalne ramy się sprawdziły, powiedz to wyraźnie:
"Początkowe ramy były poprawne — kontynuuj zgodnie z pierwotnie proponowanym
kierunkiem." Nie twórz przeformułowania, jeśli dowody go nie potwierdzają.]

## Pewność

- **WYSOKA** — silne dowody + zgodność z konwencją + decydujący sygnał zawężający
- **ŚREDNIA** — dowody wskazują w jednym kierunku, ale konwencja lub sygnał są słabsze
- **NISKA** — dowody niejednoznaczne; zalecane dalsze odtworzenie lub
  zebranie dowodów przed planowaniem

[Wybierz jedno. Jeśli NISKA, wymień konkretny krok weryfikacji potrzebny przed /10x-plan.]

## Co zmienia się dla /10x-plan

[1–2 zdania: o czym faktycznie powinien być plan, biorąc pod uwagę przeformułowanie.
Jeśli przeformułowanie to "brak zmian", stwierdź, że oryginalne ramy się sprawdziły.]

## Referencje

- Pliki źródłowe: [plik:linia]
- Powiązane badania: `context/changes/<change-id>/research.md` (jeśli istnieje)
- Zadania badawcze: [lista identyfikatorów TaskCreate z Kroku 3]
````

Zachowaj zwięzłość briefu — celuj w ~80–150 linii. Tabela hipotez jest sercem; wszystko inne ją wspiera.

### Krok 7: Prezentacja i przekazanie

Wydrukuj podsumowanie na jednym ekranie, a następnie zaproponuj przekazanie:

```
═══════════════════════════════════════════════════════════
  RAMOWANIE ZAKOŃCZONE: [Temat]
  Pewność: [WYSOKA/ŚREDNIA/NISKA]
═══════════════════════════════════════════════════════════

  Zgłoszona obserwacja: [jedna linia]
  Początkowe ramy:      [jedna linia]
  Przeformułowany problem:     [jedna linia — lub "Początkowe ramy się sprawdziły"]

  ► Brief: context/changes/<change-id>/frame.md
═══════════════════════════════════════════════════════════
```

Następnie zapytaj:

AskUserQuestion:
- question: "Ramowanie zakończone. Jak chcesz postępować?"
  header: "Następny krok"
  options:
  - label: "Przekaż do /10x-plan"
    description: "Przekaż ten brief do /10x-plan i rozpocznij planowanie implementacji."
  - label: "Najpierw odtwórz / zweryfikuj"
    description: "Pewność jest zbyt niska lub przeformułowanie wymaga ręcznego sprawdzenia przed planowaniem."
  - label: "Omów przed planowaniem"
    description: "Chcę zakwestionować przeformułowanie lub zbadać alternatywy."
  - label: "Zatrzymaj się tutaj"
    description: "Sam brief wystarczy — plan nie jest teraz potrzebny."
    multiSelect: false

Jeśli użytkownik wybierze "Przekaż do /10x-plan", skopiuj polecenie do schowka:

```bash
echo -n "/10x-plan <change-id>" | pbcopy 2>/dev/null || echo -n "/10x-plan <change-id>" | clip.exe 2>/dev/null || echo -n "/10x-plan <change-id>" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-plan <change-id>"
```

I wydrukuj: `→ /10x-plan <change-id> (✓ skopiowano)`

## Krytyczne zabezpieczenia

1. **Dopuszczalny wniosek: "ramy były prawidłowe."** Ta umiejętność nie jest wartościowa tylko wtedy, gdy prowadzi do przeformułowania. Jeśli badanie hipotez potwierdza początkowe ramy użytkownika, TO JEST udane ramowanie — powiedz to jasno i zatrzymaj się. Wytworzone przeformułowania są gorsze niż brak ram: wprowadzają zamieszanie, które użytkownik musi później rozplątać.

2. **Obserwacja i podana przyczyna pozostają oddzielne.** Przez każdy krok. Frame Brief zachowuje oryginalne ramy dosłownie — nawet po przeformułowaniu — ponieważ przyszli czytelnicy (i /10x-plan-review) muszą widzieć, co zakładano, a co odkryto.

3. **Brak projektowania rozwiązania.** Ta umiejętność nigdy nie wybiera podejścia do implementacji. Nie proponuje faz, zmian w plikach ani decyzji technicznych. Tworzy JEDEN artefakt: przeformułowane (lub potwierdzone) sformułowanie problemu. /10x-plan jest odpowiedzialny za rozwiązanie.

4. **Pytania zawężające ≠ pytania dotyczące rozwiązania.** /10x-plan pyta "które podejście?". /10x-frame pyta "gdzie na mapie wymiarów znajduje się rzeczywisty problem?". Ta zasada wiąże zarówno Krok 1.5 (zawężanie zakresu/obserwacji przed wysyłką), jak i Krok 4 (zawężanie hipotez po wysyłce). Opcje opisują obserwacje lub pozycje projektowe, a nie wybory dotyczące sposobu ich rozwiązania. Jeśli zauważysz, że tworzysz pytanie, którego odpowiedź zmienia *kierunek*, przekroczyłeś terytorium /10x-plan — zatrzymaj się.

5. **Przeczytaj materiał źródłowy, zanim sięgniesz po wcześniejsze dane.** Materiał źródłowy oznacza kod, dokumenty, wcześniejsze decyzje lub cokolwiek, na czym faktycznie opiera się ramowanie. Kuszące jest rozpoznanie kształtu z danych treningowych i zaproponowanie przeformułowania przed badaniem. Nie rób tego. Hipotezy muszą pochodzić z mapy wymiarów, którą skonstruowałeś w Kroku 2 z TEGO materiału, a dowody muszą pochodzić z odczytów podagentów TEGO projektu. Pewnie brzmiące przeformułowanie bez dowodów w postaci pliku:linii lub dokumentu:sekcji to tryb awarii, któremu ta umiejętność ma zapobiegać.

6. **Brak sztucznego zwiększania liczby hipotez.** Jeśli tylko dwa wymiary są wiarygodne, zbadaj dwa. Tworzenie agentów do badania hipotez bez wiarygodności marnuje budżet i sygnalizuje fałszywą rygorystyczność.

7. **Ogranicz czas badania.** Ramowanie powinno zazwyczaj zakończyć się w 2–4 rundach podagentów i 2–5 pytaniach. Jeśli przeciąga się to poza ten czas, przypadek prawdopodobnie wymaga odtworzenia lub zebrania dowodów przed dalszą analizą — zalec to i zatrzymaj się.

## Uwagi

- To jest umiejętność **ramowania**. Badaj i raportuj — nie edytuj kodu, nie pisz planów.
- Bądź konkretny. Konkrety z `plik:linia` lub `dokument:sekcja` są lepsze niż ogólniki.
- Rozróżniaj "dowody znalezione w tym projekcie" (weryfikowalne, z plikiem:linią lub dokumentem:sekcją) od "mam przeczucie z poprzednich systemów, które widziałem" (wcześniejsze, niezweryfikowane). Wcześniejsze dane są przydatne do formułowania hipotez; tylko zweryfikowane dowody należą do Frame Brief.
- Jeśli użytkownik sprzeciwi się przeformułowaniu, potraktuj to poważnie — może znać kontekst, którego badanie nie uwzględniło. Ponownie uruchom Krok 3 w odpowiedzi na jego sprzeciw, zamiast bronić przeformułowania.
- Frame Brief to jedyny artefakt. Zachowaj go krótkim, łatwym do zeskanowania i użytecznym dla /10x-plan.