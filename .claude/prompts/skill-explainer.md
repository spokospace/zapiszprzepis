# Wyjaśnienie Umiejętności

Przeanalizuj umiejętność, aby zrozumieć jej mechanikę, uzasadnienie projektu i sposób budowania czegoś podobnego. Po wywołaniu, przeczytaj pliki źródłowe docelowej umiejętności i sporządź ustrukturyzowany raport, który wyjaśni, jak działa umiejętność i dlaczego została tak zbudowana.

## Dane wejściowe

Użytkownik podaje nazwę umiejętności (np. `10x-plan`, `10x-shape`, `10x-new`). Akceptuj ją jako:
- Samą nazwę: `10x-plan`
- Nazwę z prefiksem ukośnika: `/10x-plan`
- Ścieżkę do pliku SKILL.md: `~/.claude/skills/10x-plan/SKILL.md`

Jeśli nie podano nazwy umiejętności, zapytaj:

```
Którą umiejętność chciałbyś, abym wyjaśnił? Podaj nazwę umiejętności (np. `10x-plan`) lub ścieżkę do jej pliku SKILL.md.
```

Następnie poczekaj.

## Odkrywanie

Znajdź pliki źródłowe umiejętności:

1. **Zlokalizuj SKILL.md.** Spróbuj tych ścieżek w kolejności, zatrzymaj się przy pierwszym trafieniu:
   - `~/.claude/skills/<name>/SKILL.md`
   - `.claude/skills/<name>/SKILL.md` (lokalny dla projektu)
   - `.agents/skills/<name>/SKILL.md` (Codex)
   - `.cursor/skills/<name>/SKILL.md` (Cursor)
   - Ścieżka podana przez użytkownika (jeśli podano pełną ścieżkę)

   Jeśli nic nie znaleziono, powiedz użytkownikowi:
   ```
   Nie mogłem znaleźć pliku SKILL.md dla "<name>". Podaj pełną ścieżkę do pliku umiejętności.
   ```
   Następnie poczekaj.

2. **Przeczytaj SKILL.md w całości** — bez obcinania, bez limitu/offsetu.

3. **Sprawdź, czy obok SKILL.md znajduje się katalog `references/`**. Jeśli istnieje, wyświetl jego zawartość i przeczytaj każdy plik `.md` w nim w całości. Są to dokumenty towarzyszące (schematy, szablony, rejestry), które definiują kontrakty egzekwowane przez umiejętność.

## Analiza

Po przeczytaniu wszystkich plików źródłowych, sporządź poniższy raport. Dostosuj głębokość do złożoności umiejętności:

| Rozmiar umiejętności | Głębokość |
|--------------------|-----------|
| Poniżej 150 linii (prosta) | Zwięzła — każda sekcja to 3-5 zdań. Pomiń sekcje, które nie mają zastosowania (np. proste umiejętności rzadko mają orkiestrację sub-agentów lub bramki samooceny). |
| 150-400 linii (średnia) | Standardowa — każda sekcja to krótki akapit. Omów wszystkie 7 sekcji. |
| Powyżej 400 linii (złożona/orkiestrator) | Szczegółowa — tabela anatomii, konkretne odniesienia do linii, rozszerzona analiza mechaniki. Wszystkie 7 sekcji w całości. |

Nie wypełniaj prostych umiejętności ogólnikowym tekstem. Umiejętność składająca się z 95 linii otrzymuje zwięzły, skoncentrowany raport. Orkiestrator składający się z 831 linii otrzymuje dogłębne omówienie.

## Struktura Raportu

Przed szczegółowymi sekcjami, rozpocznij krótkim blokiem przeglądowym, który zorientuje czytelnika. Wydrukuj go dokładnie raz, na początku raportu:

```
## Sekcje w tym raporcie

1. **Problem i Cel** — Dlaczego ta umiejętność istnieje i jaki ból usuwa
2. **Pozycja w Łańcuchu** — Gdzie znajduje się w przepływie pracy: co do niej trafia, co następuje po niej
3. **Przegląd Anatomii** — Mapa pliku SKILL.md sekcja po sekcji
4. **Kluczowe Mechanizmy** — Czynniki behawioralne, które sprawiają, że ta umiejętność działa, z zaznaczeniem części o wysokiej dźwigni
5. **Decyzje Projektowe** — Dlaczego jest zbudowana w ten sposób, a nie inaczej — odrzucone alternatywy
6. **Przewodnik Adaptacji** — Co można zmienić (łatwe / średnie / trudne) z konkretnymi przykładami
7. **Budowanie Czegoś Podobnego** — Ścieżka krok po kroku od pustego pliku do działającej umiejętności podobnej do tej
```

Następnie przejdź do każdej sekcji w całości:

### 1. Problem i Cel

Odpowiedź: **"Dlaczego ta umiejętność istnieje?"**

Wyciągnij z oświadczenia roli i sekcji "Kiedy używać / kiedy pominąć":
- Jaki problem rozwiązuje ta umiejętność? Co działo się, zanim powstała?
- Kiedy użytkownik powinien po nią sięgnąć? Jakie są sygnały wyzwalające?
- Kiedy NIE powinien jej używać? Jaki jest niewłaściwy kontekst?
- Co by się stało, gdyby użytkownik próbował wykonać to zadanie ręcznie bez tej umiejętności?

Nie opisuj tylko tego, co robi umiejętność — wyjaśnij, jaki ból usuwa.

### 2. Pozycja w Łańcuchu

Odpowiedź: **"Gdzie ta umiejętność znajduje się w przepływie pracy?"**

Wyciągnij z sekcji "Relacja z innymi umiejętnościami":
- **Upstream**: Jakie pliki lub artefakty ta umiejętność oczekuje jako dane wejściowe? Która umiejętność je produkuje? (np. `/10x-shape` produkuje `shape-notes.md`, które `/10x-prd` konsumuje)
- **Downstream**: Co ta umiejętność wyprowadza? Która umiejętność konsumuje to dalej? Do jakiego pliku zapisuje?
- **Model przekazywania**: Umiejętności komunikują się poprzez pliki na dysku, a nie poprzez pamięć. Każda umiejętność zapisuje artefakt, zatrzymuje się i przekazuje kontrolę człowiekowi, zanim uruchomi się następna umiejętność. Wyjaśnij, jak ta umiejętność pasuje do tego łańcucha.

Wizualizuj pozycję w łańcuchu, gdy jest to przydatne:
```
[umiejętność upstream] → artefakt wejściowy → TA UMIEJĘTNOŚĆ → artefakt wyjściowy → [umiejętność downstream]
```

### 3. Przegląd Anatomii

Odpowiedź: **"Jakie są sekcje tego SKILL.md i co każda z nich robi?"**

Podziel SKILL.md na sekcje i dla każdej z nich zgłoś:
- **Nazwę sekcji** i przybliżony zakres linii
- **Co robi** — jedno zdanie
- **Dlaczego tam jest** — co by się zepsuło lub pogorszyło, gdyby ta sekcja została usunięta

Przedstaw w formie tabeli dla średnich i złożonych umiejętności:

| Sekcja | Linie | Cel | Dlaczego to ważne |
|---------|-------|---------|----------------|
| YAML frontmatter | 1-8 | Nazwa, opis, dozwolone narzędzia | `description` kontroluje, kiedy umiejętność się aktywuje; `allowed-tools` to twarda granica bezpieczeństwa |
| Oświadczenie roli | 10-15 | Filozofia w jednym zdaniu | Ustanawia behawioralną osobowość umiejętności |
| ... | ... | ... | ... |

Cel: odmitologizować "tysiące linii". Pokaż uczącemu się, że długa umiejętność to tak naprawdę N sekcji, każda z jasnym zadaniem. Całość jest mniej onieśmielająca niż części.

### 4. Kluczowe Mechanizmy

Odpowiedź: **"Jakie są 3-5 czynników behawioralnych, które sprawiają, że TA umiejętność działa, i które części mają największą dźwignię?"**

Ta sekcja musi być specyficzna dla analizowanej umiejętności — nie jest to ogólna lista wzorców umiejętności. Przeczytaj kroki procesu i zidentyfikuj, co napędza zachowanie TEJ umiejętności. Dla każdego mechanizmu:

1. **Nazwij go** — nadaj wzorcowi krótką, opisową nazwę
2. **Wyjaśnij, jak działa** — 2-3 zdania o mechanizmie
3. **Wskaż, gdzie** — które linie lub sekcje SKILL.md go implementują
4. **Zaznacz dźwignię** — oznacz części, gdzie mała zmiana powoduje dużą zmianę zachowania. Typowe wzorce o wysokiej dźwigni to:
   - Pole `description` (kontroluje aktywację), `allowed-tools` (granica bezpieczeństwa)
   - Krytyczne bariery ochronne (twarde zasady behawioralne)
   - Szablony/schematy (kształt wyjścia, od którego mogą zależeć umiejętności downstream)
   - Bramki samooceny (wbudowane testy przed zatwierdzeniem wyjścia)

Przykłady mechanizmów znalezionych w rzeczywistych umiejętnościach (użyj jako odniesienia, nie jako listy kontrolnej):

- **Pytania skalowane złożonością** (`10x-plan`): ocenia zadanie jako LOW/MEDIUM/HIGH, skaluje liczbę pytań, pomija pytania diagnostyczne, gdy istnieją artefakty upstream
- **Orkiestracja sub-agentów** (`10x-research`): uruchamia równoległe agenty, każdy z ukierunkowanym promptem, syntetyzuje wyniki
- **Maszyna stanów napędzana postępem** (`10x-implement`): pola wyboru `## Progress` są jedynym źródłem prawdy, brak bocznego stanu
- **Sokratyczna pętla odkrywania** (`10x-shape`): otwarte pytanie → ujawnienie szarych stref → rekomendacja → wyzwanie → zablokowanie decyzji
- **Mechanizmy anty-uprzedzeniowe** (`10x-infra-research`): adwokat diabła, pre-mortem, krzyżowe sprawdzanie nieznanych-nieznanych

### 5. Decyzje Projektowe

Odpowiedź: **"Dlaczego ta umiejętność jest zbudowana W TEN sposób, a nie inaczej?"**

To jest sekcja, która odpowiada na pytanie "czemu skill jest tak a nie inaczej budowany." Dla każdego głównego wyboru strukturalnego w umiejętności, wyjaśnij:

1. **Dokonany wybór** — co robi umiejętność
2. **Odrzucona alternatywa** — co mogła zrobić zamiast tego
3. **Dlaczego ten sposób wygrywa** — konkretny kompromis, który sprawił, że ten wybór był lepszy

Szukaj decyzji w tych obszarach (nie wszystkie będą miały zastosowanie):

- **Wybór narzędzi**: Dlaczego te `allowed-tools`, a nie inne? (np. dlaczego brak `Agent` w umiejętności, która teoretycznie mogłaby używać sub-agentów?)
- **Zarządzanie stanem**: Dlaczego stan w pliku vs stan w pamięci vs zewnętrzny sidecar?
- **Zachowanie łańcucha**: Dlaczego "STOP, do not chain" zamiast automatycznego kontynuowania? Dlaczego pliki na dysku zamiast przekazywania stanu w pamięci?
- **Strategia walidacji**: Dlaczego walidować w tym momencie, a nie wcześniej/później? Dlaczego te konkretne sprawdzenia?
- **Format wyjścia**: Dlaczego ta struktura szablonu? Dlaczego YAML frontmatter vs zwykły markdown? Dlaczego szablony inline vs pliki referencyjne?
- **Model interakcji**: Dlaczego AskUserQuestion na tym etapie? Dlaczego nie po prostu decydować automatycznie?

Celem jest ujawnienie myślenia inżynierskiego stojącego za umiejętnością. Uczący się, który rozumie odrzucone alternatywy, rozumie przestrzeń projektową — i może dokonywać własnych wyborów podczas budowania czegoś podobnego.

### 6. Przewodnik Adaptacji

Odpowiedź: **"Co mogę zmienić i jak ryzykowne są poszczególne zmiany?"**

Uporządkuj według poziomu trudności z 1-2 konkretnymi przykładami na poziom, specyficznymi dla analizowanej umiejętności:

**Łatwe (niskie ryzyko, natychmiastowy efekt):**
- Co zmienić: np. frazy wyzwalające w `description`, nagłówki sekcji szablonu, etykiety opcji pytań, formatowanie raportu
- Przykład: "Aby dodać polskie frazy wyzwalające, edytuj pole `description` i dodaj 'stwórz plan' obok 'create plan'"
- Co się psuje, jeśli popełnisz błąd: nic krytycznego — w najgorszym przypadku umiejętność aktywuje się w niewłaściwych momentach lub formatowanie wyjścia wygląda inaczej

**Średnie (wymaga zrozumienia łańcucha):**
- Co zmienić: np. kryteria bramki samooceny, wymiary punktacji, kategorie pytań, liczba sub-agentów
- Przykład: "Aby dodać wymiar 'Bezpieczeństwo' do karty wyników przeglądu, dodaj go do listy wymiarów w krokach procesu i zaktualizuj szablon raportu"
- Co się psuje, jeśli popełnisz błąd: umiejętność może produkować niekompletne lub niespójne wyjście, ale nie zepsuje innych umiejętności w łańcuchu

**Trudne (strukturalne, ryzyko zerwania kontraktów łańcucha):**
- Co zmienić: np. lista `allowed-tools`, format pliku wyjściowego, nazewnictwo artefaktów, wartości cyklu życia statusu
- Przykład: "Zmiana nazwy pliku wyjściowego z `plan.md` na `implementation-plan.md` zepsułaby `/10x-implement`, który szuka `plan.md`"
- Co się psuje, jeśli popełnisz błąd: umiejętności downstream, które zależą od dokładnych nazw plików, nagłówków sekcji lub wartości statusu, zawiodą po cichu lub wyprodukują błędne wyjście

### 7. Budowanie Czegoś Podobnego

Odpowiedź: **"Gdybym chciał zbudować własną wersję tej umiejętności, jak bym zaczął?"**

Podaj praktyczną, krok po kroku ścieżkę konstrukcji. Zacznij prosto i buduj — to jest progresywna podróż od "pustego pliku" do "działającej umiejętności".

Zanim zagłębisz się w ręczne kroki, zwróć uwagę na dwa skróty:
- **Podejście konwersacyjne**: Po prostu powiedz swojemu agentowi "zbudujmy umiejętność, która robi X" i iteruj nad SKILL.md razem w 3-4 rundach. To najszybsza ścieżka dla osobistych umiejętności.
- **`/skill-creator`**: Meta-umiejętność Anthropic do budowania umiejętności ze strukturalnymi ocenami. Dostępna pod adresem `github.com/anthropics/skills/tree/main/skills/skill-creator`. Lepsza dla umiejętności współdzielonych lub zintegrowanych z łańcuchem, gdzie chcesz automatycznej weryfikacji.

Oba skróty produkują ten sam SKILL.md — poniższe kroki wyjaśniają, co generują, abyś zrozumiał wyjście i mógł je dopracować:

**Krok 1: Zacznij od promptu.** Przed utworzeniem pliku umiejętności, napisz główną instrukcję jako zwykły prompt. Przetestuj ją w rozmowie. Czy produkuje mniej więcej właściwe wyjście? Iteruj, aż podstawowe zachowanie zadziała.

**Krok 2: Utwórz plik umiejętności.** Utwórz `<skill-name>/SKILL.md` w katalogu swoich umiejętności. Dodaj minimalny frontmatter:
```yaml
---
name: <skill-name>
description: <jednoliniowy opis z frazami wyzwalającymi>
allowed-tools:
  - Read
  - Bash
---
```

**Krok 3: Dodaj strukturę.** Przetłumacz swój prompt na sekcje: oświadczenie roli, kiedy używać/pominąć, początkowa odpowiedź i kroki procesu. Oświadczenie roli ustala osobowość; sekcja "kiedy używać" zapobiega niewłaściwemu użyciu.

**Krok 4: Dodaj bariery ochronne.** Czego ta umiejętność NIGDY nie może robić? Napisz 3-5 krytycznych barier ochronnych. To są linie o największej dźwigni — zapobiegają najbardziej szkodliwym trybom awarii.

**Krok 5: Dodaj granice zakresu.** Napisz sekcję "Czego ta umiejętność NIE robi". Jawne granice zapobiegają rozszerzaniu zakresu i sprawiają, że umiejętność jest przewidywalna.

**Krok 6: (W razie potrzeby) Dodaj odniesienia.** Jeśli umiejętność egzekwuje schemat, szablon lub rejestr, umieść je w katalogu `references/`. Skup SKILL.md na zachowaniu; umieść kontrakty danych w plikach referencyjnych.

**Krok 7: (W razie potrzeby) Dodaj integrację z łańcuchem.** Jeśli ta umiejętność jest częścią łańcucha, zdefiniuj wejście upstream (jaki plik czyta) i wyjście downstream (jaki plik zapisuje). Dodaj sekcję "Relacja z innymi umiejętnościami". Dodaj "STOP, do not chain" do barier ochronnych.

**Krok 8: (W razie potrzeby) Dodaj zaawansowane wzorce.** Na podstawie tego, co demonstruje ta umiejętność, wspomnij, jakie zaawansowane wzorce uczący się mógłby dodać:
- Orkiestracja sub-agentów (jeśli umiejętność uruchamia agentów)
- Skalowanie złożoności (jeśli umiejętność dostosowuje się do rozmiaru wejścia)
- Bramki samooceny (jeśli umiejętność waliduje własne wyjście)
- Wznowienie oparte na punktach kontrolnych (jeśli umiejętność obsługuje pracę wielosesyjną)
- AskUserQuestion dla interaktywnych decyzji

Dla każdego kroku, zanotuj, co analizowana umiejętność robi na tym poziomie, aby uczący się mógł zobaczyć korespondencję między krokami konstrukcji a gotowym produktem.

**Częste błędy, których należy unikać:**
- Rozpoczynanie od zaawansowanych wzorców, zanim podstawowe zachowanie zadziała
- Pisanie zbyt ogólnych barier ochronnych ("bądź ostrożny") zamiast konkretnych ("NIGDY nie łącz automatycznie z następną umiejętnością")
- Zapominanie o sekcji "Czego ta umiejętność NIE robi" — rozszerzanie zakresu to najczęstszy tryb awarii umiejętności
- Uczynienie `description` zbyt szerokim (aktywuje się na wszystko) lub zbyt wąskim (nigdy się nie aktywuje)

## Przypadki Brzegowe

- **Umiejętność nie ma katalogu `references/`**: pomiń analizę odniesień. Nie wspominaj, że brakuje odniesień — większość prostych umiejętności ich nie ma i to jest w porządku.
- **Umiejętność to plik promptu, a nie SKILL.md**: jeśli użytkownik wskaże plik `.claude/prompts/*.md`, wyjaśnij, że prompty są prostsze niż umiejętności (brak frontmatter, brak allowed-tools, brak pozycji w łańcuchu) i przeanalizuj to, co jest. Dostosuj raport, aby pominąć sekcje, które nie mają zastosowania.
- **Umiejętność jest bardzo krótka (poniżej 50 linii)**: sporządź minimalny raport — Problem i Cel + Anatomia + Budowanie Czegoś Podobnego. Pomiń pozycję w łańcuchu, kluczowe mechanizmy i przewodnik adaptacji, jeśli nie ma nic sensownego do powiedzenia.
- **Umiejętność używa wzorców niewymienionych powyżej**: przeanalizuj to, co widzisz. Lista mechanizmów w sekcji 5 jest ilustracyjna, a nie wyczerpująca. Jeśli umiejętność ma unikalny wzorzec, wyjaśnij go.

## Ton

Pisz dla programisty, który potrafi UŻYWAĆ umiejętności, ale chce zrozumieć JAK i DLACZEGO działa. Nie wyjaśniaj, czym jest Claude Code ani jak działają polecenia ukośnika — czytelnik już ich codziennie używa. Skoncentruj się na decyzjach projektowych, częściach nośnych i praktycznej ścieżce do zbudowania własnej umiejętności.