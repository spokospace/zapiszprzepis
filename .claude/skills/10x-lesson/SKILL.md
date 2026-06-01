---
name: 10x-lesson
description: Capture a recurring rule or pattern into context/foundation/lessons.md. Use when you spot a class of bug or design pitfall worth surfacing for future reviews and implementations.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

# /10x-lesson — Zapisz powtarzającą się regułę

Dołącz pojedynczy wpis do `context/foundation/lessons.md`, aby przyszłe uruchomienia `/10x-frame`, `/10x-research`, `/10x-plan`, `/10x-plan-review`, `/10x-implement` i `/10x-impl-review` odczytywały go jako wcześniejszy. Jest to proaktywny odpowiednik opcji triage "Akceptuj jako powtarzającą się regułę" w `/10x-impl-review` — wywołaj go w trakcie pracy, gdy zauważysz wzorzec wart uwagi, nie czekając na ustrukturyzowaną recenzję.

"Lekcja" to powtarzająca się reguła — nie jednorazowa poprawka błędu. Kryterium jest: "to zmieniłoby ramy lub poprawkę w przeszłej pracy i będzie się powtarzać". Jeśli jest to opis pojedynczego incydentu, to jest to niewłaściwa umiejętność.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano opis w formie swobodnej** (np. `/10x-lesson feature flags should always have a kill date`), użyj go jako podstawy dla pola Reguła i przejdź do wywiadu.
2. **Jeśli nic nie podano**, odpowiedz:

```
Zapiszę powtarzającą się regułę w context/foundation/lessons.md.

Zadam cztery krótkie pytania, a następnie dodam wpis. Cztery pola to:
  1. Kontekst — gdzie ta reguła ma zastosowanie (podsystem / faza / wzorzec pliku)
  2. Problem — co idzie nie tak bez tej reguły
  3. Reguła — sama reguła, w jednym lub dwóch zdaniach
  4. Dotyczy — które umiejętności powinny to najbardziej uwzględniać (frame / plan / implement / review)

Następnie poczekaj.
```

## Proces

### Krok 1: Wywiad

Użyj AskUserQuestion, aby zebrać cztery pola. Możesz je zgrupować w jednej rundzie czterech swobodnych pytań (każda opcja to po prostu `["I'll fill it in"]` — tzn. użytkownik wybiera "Inne", aby wpisać odpowiedź) lub uruchomić cztery sekwencyjne rundy. Obie formy są w porządku; celem jest, aby to użytkownik, a nie umiejętność, napisał treść.

Nic nie wypełniaj wstępnie. Użytkownik podaje każde pole. Jeśli w wywołaniu przekazano intencję w formie swobodnej, wyświetl ją jako sugestię obok monitu Reguła — nie jako wartość domyślną.

Cztery pola, z jednowierszowymi wskazówkami:

- **Context** — gdzie ta reguła ma zastosowanie? Podsystem / faza / wzorzec pliku. Bądź wystarczająco konkretny, aby przyszła umiejętność mogła dopasować wzorzec (np. "każda faza dodająca flagę funkcji", "badania nad systemami wielodostępnymi", a nie "wszędzie").
- **Problem** — co konkretnie idzie nie tak, jeśli reguła zostanie naruszona? Przytocz przeszły incydent lub powtarzający się kształt awarii. Jedno lub dwa zdania.
- **Rule** — sama reguła, w trybie rozkazującym ("Zawsze...", "Nigdy...", "Przed X, zrób Y"). Jedno lub dwa zdania. Czytelnik przyszłej recenzji powinien być w stanie wkleić to dosłownie do wniosku.
- **Applies to** — lista nazw umiejętności oddzielonych przecinkami, dla których ta reguła powinna być najważniejsza: `frame`, `research`, `plan`, `plan-review`, `implement`, `impl-review`. Użyj `all`, jeśli reguła obejmuje cały cykl życia.

### Krok 2: Echo i potwierdzenie

Wyrenderuj proponowany wpis jako blok markdown i pokaż go użytkownikowi. Użyj AskUserQuestion, aby potwierdzić:

- question: "Dołączyć tę lekcję do `context/foundation/lessons.md`?"
  header: "Potwierdź"
  options:
  - label: "Dołącz"
    description: "Zapisz wpis w pokazanej formie."
  - label: "Edytuj"
    description: "Pozwól mi poprawić jedno lub więcej pól przed zapisaniem."
  - label: "Anuluj"
    description: "Odrzuć — nic nie zapisuj."
    multiSelect: false

Proponowany kształt wpisu (jest to kanoniczny format wpisu lekcji):

```markdown
## <Tytuł reguły — krótkie zdanie rozkazujące, pochodzące z pola Reguła>

- **Context**: <Pole Kontekst>
- **Problem**: <Pole Problem>
- **Rule**: <Pole Reguła>
- **Applies to**: <Pole Dotyczy>
```

Nagłówek H2 JEST tytułem reguły. Utrzymaj go krótko — lista H2 to to, co przyszłe umiejętności skanują najpierw.

### Krok 3: Samodzielne uruchomienie i dołączenie

Jeśli `context/foundation/lessons.md` nie istnieje, utwórz go z tym kanonicznym 5-wierszowym nagłówkiem (osadzonym w tekście — bez oddzielnego pliku szablonu; ten sam nagłówek jest używany przez gałąź triage "Akceptuj jako powtarzającą się regułę" w `/10x-impl-review` i tutaj):

```
# Lessons Learned

> Rejestr tylko do dodawania powtarzających się reguł i wzorców. Odczytywany ponownie na początku przez /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

```

Jeśli plik istnieje, pozostaw go bez zmian i dołącz na końcu. Nie zmieniaj kolejności, nie usuwaj duplikatów ani nie formatuj istniejących wpisów — plik jest tylko do dodawania.

Użyj Edit (lub Write w przypadku samodzielnego uruchomienia), aby wprowadzić zmianę. Po dołączeniu, ponownie odczytaj plik i potwierdź, że nowy H2 jest ostatnią sekcją.

### Krok 4: Echo wyniku

Wydrukuj ścieżkę i tytuł reguły:

```
Dołączono do context/foundation/lessons.md:
  ## <Tytuł reguły>
```

Zatrzymaj się. Nie łącz się z innymi umiejętnościami. Użytkownik wywołał to dla pojedynczego przechwycenia; uszanuj zakres.

## Uwagi

- **Tylko do dodawania.** Nigdy nie edytuj ani nie usuwaj istniejących lekcji za pomocą tej umiejętności. Jeśli reguła wymaga rewizji, użytkownik otwiera plik i edytuje go bezpośrednio — to celowe utrudnienie, ponieważ przepisywanie powtarzających się reguł bez zastanowienia jest trybem awarii, któremu zapobiega ta konwencja.
- **Jeden wpis na wywołanie.** Jeśli użytkownik ma wiele lekcji do przechwycenia, wywołuje umiejętność wiele razy. Grupowe dodawanie sprzyja niedokończonym wpisom.
- **Samodzielne uruchomienie jest domyślne.** Nie mów użytkownikowi "najpierw uruchom /10x-init" — utwórz plik z kanonicznym nagłówkiem przy pierwszym użyciu. (`/10x-init` tworzy szkielet katalogu `/context`; ta umiejętność jest właścicielem `lessons.md` od początku do końca.)
- **Nic nie wypełniaj wstępnie.** W przeciwieństwie do gałęzi triage `/10x-impl-review` (która wstępnie wypełnia Kontekst i Problem z wniosku), ta proaktywna umiejętność oczekuje, że użytkownik sam napisze. Taka jest cena przechwytywania reguł poza ustrukturyzowaną recenzją.
