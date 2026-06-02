---
name: 10x-infra-research
description: >
  Research and recommend an MVP deployment platform by combining tech-stack
  context, a short developer interview, and parallel web research scored against
  five agent-friendly platform criteria. Cross-checks the top recommendation
  through three anti-bias lenses (devil's advocate, pre-mortem, unknown unknowns)
  before writing context/foundation/infrastructure.md with a scored platform
  comparison, rationale, and risk register. Use when the user needs to pick a
  hosting / deployment / maintenance platform for an MVP and wants a
  well-researched, bias-checked decision rather than a gut call.
  Trigger phrases: "choose a platform", "where should I deploy", "infra research",
  "deployment platform for my MVP", "wybierz platformę", "gdzie deployować",
  "infrastructure decision", "hosting choice", "jaka platforma do deploymentu".
  Use AFTER /10x-prd or /10x-tech-stack-selector, BEFORE /10x-implement.
argument-hint: "[path-to-tech-stack-or-prd]"
allowed-tools:
  - Read
  - Write
  - Bash
  - WebFetch
  - WebSearch
  - AskUserQuestion
  - Agent
  - TaskCreate
  - TaskUpdate
---

# Badanie platformy: Świadoma platforma wdrożeniowa dla MVP

Ta umiejętność prowadzi do **świadomej decyzji dotyczącej infrastruktury** — nie jest to rekomendacja oparta na przeczuciach, lecz na stosie technologicznym projektu, ograniczeniach operacyjnych dewelopera, świeżych badaniach internetowych oraz trzech soczewkach anty-uprzedzeniowych, które poddają zwycięską platformę testom warunków skrajnych przed zarejestrowaniem decyzji.

Jedynym rezultatem jest plik `context/foundation/infrastructure.md` — trzecia umowa decyzyjna w łańcuchu fundamentów po `prd.md` (co i dla kogo) i `tech-stack.md` (z czym budować). Zawiera: porównanie platform z ocenami, uzasadnienie rekomendacji, historię operacyjną (podgląd / sekrety / wycofywanie / zatwierdzanie / logi) oraz rejestr ryzyka z wstępnie wypełnionymi notatkami dotyczącymi łagodzenia.

## Kiedy używać, kiedy pominąć

**Użyj, gdy**: użytkownik musi wybrać platformę wdrożeniową/hostingową dla MVP i chce ustrukturyzowanej, opartej na badaniach decyzji. Umiejętność działa najlepiej, gdy istnieje `context/foundation/tech-stack.md` — wykorzystuje stos jako twarde ograniczenie podczas oceny platform.

**Pomiń, gdy**: platforma jest już wybrana, a użytkownik potrzebuje pomocy w konfiguracji CI/CD lub pisaniu Dockerfile'ów — te kwestie wykraczają poza zakres tej umiejętności (patrz Cele nieobjęte). Pomiń również, gdy użytkownik pyta o architekturę na skalę produkcyjną; ta umiejętność koncentruje się na wdrożeniach MVP.

## Związek z innymi umiejętnościami

- `/10x-prd` — upstream. Tworzy `context/foundation/prd.md` z kontekstem produktu. Opcjonalne wejście.
- `/10x-tech-stack-selector` — upstream. Tworzy `context/foundation/tech-stack.md`. Główne wejście z twardymi ograniczeniami — ładuje je, jeśli jest obecne.
- `/10x-stack-assess` — pokrewne. Ocenia istniejący stos pod kątem przyjazności dla agentów. Badanie infrastruktury jest uzupełnieniem wdrożenia.
- `/10x-implement` — downstream. Odczytuje `context/foundation/infrastructure.md`, aby informować o krokach wdrożenia podczas implementacji.

## Cele nieobjęte

Ta umiejętność **nie**:
- Buduje obrazów Docker ani nie pisze Dockerfile'ów.
- Konfiguruje potoków CI/CD.
- Planuje poza zakresem MVP (prognozy kosztów średnioterminowych są w porządku; HA w wielu regionach wykracza poza zakres).

## Wymagane dane wejściowe

1. `references/agent-friendly-criteria.md` — w pakiecie. Pięć kryteriów platformy używanych jako soczewka oceny.

## Opcjonalne dane wejściowe

1. `context/foundation/tech-stack.md` — jeśli jest obecny, umiejętność odczytuje język, framework i środowisko uruchomieniowe, aby odfiltrować platformy, które ich nie obsługują.
2. `context/foundation/prd.md` — jeśli jest obecny, umiejętność odczytuje kontekst produktu (skala użytkowników, wymagania dotyczące opóźnień) w celu ważenia badań.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano argument ścieżki** (np. `/10x-infra-research @context/foundation/tech-stack.md`), usuń początkowe `@`, jeśli jest obecne, i użyj ścieżki jako lokalizacji stosu technologicznego dla tego uruchomienia.
2. **Jeśli brak argumentu**, sprawdź `context/foundation/tech-stack.md`. Załaduj go, jeśli jest obecny; kontynuuj bez niego, jeśli go brakuje.

## Przepływ pracy

### Krok 0 — Konfiguracja i ładowanie kontekstu

Załaduj pliki kontekstu. Dla każdego istniejącego pliku, odczytaj go i wyodrębnij odpowiednie pola:

- `context/foundation/tech-stack.md` → język, framework, środowisko uruchomieniowe, baza danych (twarde ograniczenia dla kompatybilności platformy)
- `context/foundation/prd.md` → oczekiwana skala użytkowników, wymagania dotyczące opóźnień/dostępności (miękkie wagi dla oceny platformy)

Załaduj `references/agent-friendly-criteria.md` — to jest soczewka oceny używana w Kroku 3.

Wyświetl, co zostało załadowane:

```
Context loaded:
  Tech stack:    <language> / <framework> / <runtime>  [or "not found — will infer from cwd"]
  PRD context:   <scale / latency notes>               [or "not found — skipping"]
  Platform criteria: references/agent-friendly-criteria.md ✓
```

### Krok 1 — Wywiad z deweloperem (5 pytań)

Zadaj użytkownikowi pięć pytań typu Tak / Nie / Nie wiem. Użyj narzędzia `AskUserQuestion` dla każdego z nich, po jednym na raz. Zbierz wszystkie odpowiedzi przed przejściem do badań.

**Pytanie 1**

AskUserQuestion:
- question: "Czy Twoja aplikacja wymaga trwałych połączeń po stronie serwera — WebSockets, long-polling, czy procesów roboczych w tle, które muszą pozostać aktywne między żądaniami?"
  header: "Ograniczenia platformy"
  options:
  - label: "Tak"
    description: "Aplikacja potrzebuje zawsze aktywnych procesów lub długotrwałych połączeń."
  - label: "Nie"
    description: "Tylko żądanie/odpowiedź — każde żądanie jest bezstanowe."
  - label: "Nie wiem"
    description: "Jeszcze nie jestem pewien."
  multiSelect: false

**Pytanie 2**

AskUserQuestion:
- question: "Czy minimalizacja miesięcznych kosztów jest najwyższym priorytetem na etapie MVP, czy ważniejsze jest doświadczenie dewelopera i szybkość iteracji?"
  header: "Preferencje dotyczące kompromisów"
  options:
  - label: "Minimalizuj koszty"
    description: "Chcę najtańszą możliwą opcję, nawet jeśli DX jest trudniejszy."
  - label: "Priorytetyzuj DX"
    description: "Zapłacę rozsądną kwotę za płynniejszy cykl rozwoju."
  - label: "Nie wiem / mniej więcej równo"
    description: "Brak silnych preferencji."
  multiSelect: false

**Pytanie 3**

AskUserQuestion:
- question: "Czy Ty lub Twój zespół macie już praktyczne doświadczenie z jakąś konkretną platformą, na którą czulibyście się komfortowo wdrażając?"
  header: "Istniejąca znajomość"
  options:
  - label: "Tak — Vercel / Netlify"
    description: "Komfortowo z platformami w stylu JAMstack."
  - label: "Tak — Cloudflare (Workers / Pages)"
    description: "Komfortowo z wdrożeniami typu edge-first."
  - label: "Tak — Railway / Render / Fly.io"
    description: "Komfortowo z PaaS opartymi na kontenerach."
  - label: "Tak — AWS / GCP / Azure"
    description: "Komfortowo z infrastrukturą hiperskalera."
  - label: "Brak silnej znajomości"
    description: "Otwarty na to, co najlepiej pasuje."
  multiSelect: false

**Pytanie 4**

AskUserQuestion:
- question: "Czy spodziewasz się, że aplikacja będzie obsługiwać użytkowników globalnie (ważne edge/CDN) czy głównie z jednego regionu?"
  header: "Zasięg geograficzny"
  options:
  - label: "Globalnie — opóźnienia między regionami mają znaczenie"
    description: "Użytkownicy będą na różnych kontynentach."
  - label: "Jeden region jest w porządku"
    description: "Wszyscy użytkownicy są w jednym kraju / regionie."
  - label: "Jeszcze nie wiem"
    description: "Nie jestem pewien co do docelowej geografii."
  multiSelect: false

**Pytanie 5**

AskUserQuestion:
- question: "Czy wdrożenie będzie wymagało współlokowanych usług zarządzanych — bazy danych, przechowywania obiektów, kolejek — z tej samej platformy, czy zewnętrzni dostawcy są w porządku?"
  header: "Współlokacja usług"
  options:
  - label: "Preferowana współlokacja"
    description: "Chcę bazę danych, pamięć masową itp. od tego samego dostawcy, aby było prosto."
  - label: "Zewnętrzni dostawcy są w porządku"
    description: "Użyję oddzielnych usług (np. Supabase, Upstash, Cloudflare R2)."
  - label: "Jeszcze nie wiem"
    description: "Jeszcze nie zdecydowałem o warstwie danych."
  multiSelect: false

Zapisz wszystkie pięć odpowiedzi jako ograniczenia badawcze przed przejściem do Kroku 2.

### Krok 2 — Równoległe badanie platform

Użyj subagentów do równoległego badania platform. Celem jest zebranie wystarczającej ilości sygnałów, aby ocenić każdą platformę pod kątem pięciu kryteriów z `references/agent-friendly-criteria.md`, przefiltrowanych przez twarde ograniczenia ze stosu technologicznego i odpowiedzi z wywiadu.

**Pula kandydatów na platformy** (zbadaj je, a następnie oceń i zawęź):

| Platforma | Główny przypadek użycia |
|---|---|
| Cloudflare Workers + Pages | Edge-first, serverless JS/TS, globalny CDN |
| Vercel | Frontend + funkcje serverless, natywny Next.js |
| Netlify | Frontend + serverless, JAMstack, prymitywy formularzy/uwierzytelniania |
| Fly.io | PaaS oparty na kontenerach, trwałe procesy, wiele regionów |
| Railway | Full-stack PaaS, współlokowane bazy danych, szybki DX |
| Render | Hosting kontenerów/statyczny, darmowy poziom, zadania cron |

Dla każdej platformy uruchom subagenta z ukierunkowanym monitem badawczym. Uruchom wszystkie sześć równolegle:

```
Research [Platform Name] as an MVP deployment target.

Focus on:
1. Supported runtimes and languages (especially: <language from tech stack>)
2. CLI tooling — what commands deploy, rollback, and tail logs?
3. Whether docs are available as markdown/llms.txt on GitHub
4. Free tier and estimated cost at 10k-100k monthly requests
5. Persistent process / WebSocket support (yes / no / limited)
6. Co-located managed services (database, storage, queues)
7. MCP server or Claude/AI agent integration (if any)
8. Known limitations or gotchas for <framework from tech stack>
9. Current status of every feature mentioned above: GA / beta / preview / deprecated / region-limited.
   For any non-GA feature, capture the explicit caveat and the date the status was checked.

Return: a brief factual summary (200-300 words) with evidence links. Mark every
beta/preview/region-limited capability inline so it carries forward into the risk register.
```

Użyj `WebSearch` lub `WebFetch`, aby znaleźć aktualne strony z cennikami, oficjalną dokumentację i najnowsze porównania społeczności (szukaj treści z lat 2024-2025).

Po zakończeniu pracy przez wszystkich subagentów, zsyntetyzuj ich ustalenia w matrycę punktacji.

### Krok 3 — Ocena i lista skrócona

Oceń każdą zbadana platformę pod kątem pięciu kryteriów z `references/agent-friendly-criteria.md`. Najpierw zastosuj twarde filtry:

**Twarde filtry** (platforma, która ich nie przejdzie, jest usuwana z listy skróconej):
- Jeśli pytanie 1 z wywiadu = "Tak (wymagane trwałe połączenia)" → usuń platformy, które nie mogą uruchamiać trwałych procesów (Netlify, Vercel tylko serverless).
- Jeśli stos technologiczny używa środowiska uruchomieniowego nieobsługiwanego przez platformę → usuń tę platformę.

**Punktacja** (Zaliczone / Częściowo / Niezaliczone dla każdego kryterium):

| Platforma | CLI-first | Zarządzane/Serverless | Dokumentacja czytelna dla agenta | Stabilne API wdrożeniowe | MCP / Integracja | Razem |
|---|---|---|---|---|---|---|
| Cloudflare | | | | | | |
| Vercel | | | | | | |
| Netlify | | | | | | |
| Fly.io | | | | | | |
| Railway | | | | | | |
| Render | | | | | | |

Miękko waż kryteria według odpowiedzi z wywiadu:
- Pytanie 2 "minimalizuj koszty" → karaj platformy z drogimi podstawowymi poziomami.
- Pytanie 3 "istniejąca znajomość" → rozstrzygaj remisy na korzyść znanej platformy.
- Pytanie 4 "globalny zasięg" → preferuj platformy natywne dla edge.
- Pytanie 5 "preferowana współlokacja" → preferuj platformy ze zintegrowanymi bazami danych.

**Skróć listę do 3 najlepszych platform** według łącznej punktacji (po filtrach i wagach). Przedstaw listę skróconą z jednoparograficznym uzasadnieniem dla każdej platformy przed przejściem do weryfikacji krzyżowej.

Wydrukuj dla użytkownika:

```
Shortlisted platforms:
  1. <Platform A> — <one-sentence rationale>
  2. <Platform B> — <one-sentence rationale>
  3. <Platform C> — <one-sentence rationale>

Running anti-bias cross-check on the top recommendation (<Platform A>)...
```

### Krok 4 — Weryfikacja krzyżowa anty-uprzedzeniowa

Uruchom trzy monity weryfikacji krzyżowej dla najwyżej ocenianej platformy. Wykonaj je samodzielnie (nie uruchamiaj subagentów) — to Ty jesteś sceptykiem.

**Weryfikacja krzyżowa 1 — Adwokat diabła**

Mentalnie zastosuj tę soczewkę i zapisz wynik jako numerowaną listę słabych stron (3-5 pozycji):

> Działaj jako niezwykle sceptyczny i doświadczony architekt oprogramowania. Twoim jedynym zadaniem jest znalezienie wszystkich możliwych słabych stron, ukrytych kosztów, ryzyk technicznych i powodów, dla których wdrożenie `<tech stack>` na `<Platform A>` mogłoby zakończyć się niepowodzeniem w praktyce dla tego MVP. Bądź konkretny — nazwij tryby awarii, a nie kategorie.

**Weryfikacja krzyżowa 2 — Pre-mortem**

Mentalnie zastosuj tę soczewkę i napisz krótką narrację (150-200 słów):

> Zespół wdrożył `<tech stack>` na `<Platform A>` dla swojego MVP. Sześć miesięcy później decyzja okazała się kompletną katastrofą. Przejdź przez błędne założenia, decyzje techniczne i niedoszacowane ryzyka, które doprowadziły do tej porażki — krok po kroku.

**Weryfikacja krzyżowa 3 — Nieznane niewiadome**

Mentalnie zastosuj tę soczewkę i przedstaw 3-5 rzeczy, o których użytkownik może nie wiedzieć:

> Podczas wdrażania `<tech stack>` na `<Platform A>`, jakie są „nieznane niewiadome” — rzeczy, o których użytkownik powinien wiedzieć przed rozpoczęciem pracy, a które nie są oczywiste ze strony marketingowej platformy ani dokumentacji?

Po wszystkich trzech weryfikacjach krzyżowych przedstaw wyniki użytkownikowi i zapytaj:

AskUserQuestion:
- question: "Weryfikacja krzyżowa anty-uprzedzeniowa wykazała pewne ryzyka dla <Platform A>. Jak chcesz postąpić?"
  header: "Wynik weryfikacji krzyżowej"
  options:
  - label: "Kontynuuj z <Platform A> — ryzyka zanotowane"
    description: "Ryzyka są do opanowania. Uwzględnij je w rejestrze ryzyka w wynikach."
  - label: "Zmień na <Platform B>"
    description: "Ryzyka są wystarczająco znaczące, aby preferować drugą opcję."
  - label: "Zmień na <Platform C>"
    description: "Ryzyka są wystarczająco znaczące, aby preferować trzecią opcję."
  multiSelect: false

Zastosuj wybór użytkownika. Jeśli zmienią na B lub C, ponownie uruchom trzy weryfikacje krzyżowe dla nowego najlepszego wyboru i przedstaw wyniki (nie ma potrzeby pytać ponownie — zanotuj i kontynuuj).

### Krok 5 — Zapisz wynik

Sprawdź kolizję:

```bash
test -f context/foundation/infrastructure.md
```

Jeśli plik istnieje, zapytaj:

AskUserQuestion:
- question: "context/foundation/infrastructure.md już istnieje. Jak chcesz postąpić?"
  header: "Kolizja"
  options:
  - label: "Nadpisz (Zalecane)"
    description: "Zastąp istniejący plik. Poprzednia wersja zostanie utracona, chyba że zostanie zatwierdzona."
  - label: "Zapisz jako infrastructure-v2.md"
    description: "Zachowaj historię. Nowy plik zostanie zapisany w następnym dostępnym miejscu wersji."
  - label: "Przerwij"
    description: "Wyjdź bez zapisu. Rekomendacja zostanie zachowana tylko w czacie."
  multiSelect: false

Zbuduj plik wyjściowy:

```markdown
---
project: <project name from tech-stack.md, prd.md, or cwd directory name>
researched_at: <ISO 8601 date>
recommended_platform: <platform name>
runner_up: <platform name>
context_type: mvp
tech_stack:
  language: <language>
  framework: <framework>
  runtime: <runtime>
---

## Rekomendacja

**Wdróż na <Nazwa Platformy>.**

<2-3 zdania uzasadnienia: dlaczego ta platforma dla tego konkretnego stosu technologicznego i tych konkretnych ograniczeń. Powołaj się na punktację i odpowiedzi z wywiadu, które doprowadziły do decyzji.>

## Porównanie platform

<Pełna matryca punktacji z Kroku 3, z jednoparograficznymi notatkami dla każdej platformy wyjaśniającymi każdą ocenę.>

### Platformy na krótkiej liście

#### 1. <Platforma A> (Zalecana)

<Dlaczego wygrała: kluczowe mocne strony w stosunku do kryteriów i ograniczeń.>

#### 2. <Platforma B>

<Dlaczego zajęła drugie miejsce: mocne strony i różnica w stosunku do rekomendacji.>

#### 3. <Platforma C>

<Dlaczego zajęła trzecie miejsce: mocne strony i różnica w stosunku do rekomendacji.>

## Weryfikacja krzyżowa anty-uprzedzeniowa: <Zalecana Platforma>

### Adwokat diabła — Słabe strony

<Numerowana lista 3-5 konkretnych słabych stron ujawnionych w weryfikacji krzyżowej 1.>

### Pre-Mortem — Jak to mogło się nie udać

<150-200 słów narracji o niepowodzeniu z weryfikacji krzyżowej 2.>

### Nieznane niewiadome

<Lista punktowana 3-5 nieoczywistych ryzyk z weryfikacji krzyżowej 3.>

## Historia operacyjna

Jak wybrana platforma faktycznie działa na co dzień. Jedna konkretna odpowiedź na linię — nie kategoria.

- **Wdrożenia podglądowe**: <jak kompilacje PR / gałęzi stają się adresami URL podglądu; czy wymagają ochrony (np. Cloudflare Access); wszelkie warunki dostępności, takie jak PR-y forka>
- **Sekrety**: <gdzie znajdują się zmienne środowiskowe i tokeny (platform vault, GitHub Secrets, Workers Secrets); kto może je odczytać; przepływ rotacji>
- **Wycofywanie**: <komenda lub sekwencja kliknięć do przywrócenia; typowy czas przywrócenia; wszelkie uwagi dotyczące danych, takie jak migracje DB, które nie są automatycznie wycofywane>
- **Zatwierdzanie**: <które działania wymagają człowieka (publikacja do produkcji, rotacja głównego sekretu, usunięcie bazy danych); które agent może wykonać bez nadzoru>
- **Logi**: <jak agent odczytuje logi potoku i środowiska uruchomieniowego tylko do odczytu — konkretne komendy CLI lub narzędzia MCP>

## Rejestr ryzyka

Dla każdego zidentyfikowanego ryzyka: nazwa, soczewka weryfikacji krzyżowej, która je ujawniła, prawdopodobieństwo, wpływ i konkretny krok łagodzący. Powiązanie każdego ryzyka z soczewką sprawia, że rejestr jest audytowalny — przyszły czytelnik może zobaczyć, *dlaczego* każdy element znajduje się na liście.

| Ryzyko | Źródło | Prawdopodobieństwo | Wpływ | Łagodzenie |
|---|---|---|---|---|
| <ryzyko> | Adwokat diabła / Pre-mortem / Nieznane niewiadome / Wynik badań | <N/Ś/W> | <N/Ś/W> | <konkretny krok> |

## Rozpoczęcie pracy

<3-5 konkretnych pierwszych kroków do wdrożenia projektu na zalecaną platformę. Specyficzne dla stosu technologicznego — nie ogólne. Np. "Zainstaluj wrangler: npm i -g wrangler", "Uruchom: wrangler init <nazwa-projektu>".>

## Poza zakresem

W niniejszych badaniach nie oceniano następujących kwestii:
- Konfiguracja obrazu Docker
- Konfiguracja potoku CI/CD
- Architektura na skalę produkcyjną (wiele regionów, HA, DR)
```

Zapisz do `context/foundation/infrastructure.md` (lub ścieżki z wersją, jeśli wybrano). Utwórz `context/foundation/`, jeśli nie istnieje.

Po zapisie skopiuj wskazówkę dotyczącą następnego kroku do schowka:

```bash
echo -n "/10x-implement" | pbcopy 2>/dev/null || echo -n "/10x-implement" | clip.exe 2>/dev/null || echo -n "/10x-implement" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-implement"
```

Wydrukuj:

```
═══════════════════════════════════════════════════════════
  DECYZJA DOTYCZĄCA INFRASTRUKTURY ZAREJESTROWANA
═══════════════════════════════════════════════════════════

  Platforma:      <zalecana platforma>
  Drugie miejsce: <platforma na drugim miejscu>
  Sprawdzenia uprzedzeń:   3 / 3 zaliczone

  ► Decyzja:    context/foundation/infrastructure.md
  ► Następny krok:        /10x-implement  (✓ skopiowano do schowka)
═══════════════════════════════════════════════════════════
```

STOP. Nie przechodź automatycznie do `/10x-implement` — użytkownik uruchamia go, gdy jest gotowy.

## Wynik

Zapisano pojedynczy plik: `context/foundation/infrastructure.md` (lub `infrastructure-vN.md`, jeśli wybrano zapis z wersją).

## Referencje

- `references/agent-friendly-criteria.md` — pięć kryteriów platformy, wskazówki dotyczące punktacji i uwagi dotyczące wag.

## Krytyczne zabezpieczenia

1. **Badaj przed rekomendowaniem.** Nigdy nie rekomenduj platformy wyłącznie na podstawie znajomości danych szkoleniowych. Zawsze przeprowadzaj równoległe badania internetowe (Krok 2) za pomocą `WebSearch` / `WebFetch` przed punktacją. Przestarzałe wrażenia dotyczące cen lub obsługi funkcji prowadzą do błędnych rekomendacji.

2. **Stos technologiczny jest twardym ograniczeniem, a nie preferencją.** Jeśli stos technologiczny wymaga środowiska uruchomieniowego, którego platforma nie obsługuje (np. Python na środowisku uruchomieniowym edge tylko dla JS), ta platforma jest odrzucana — żadna ilość punktacji tego nie zmieni.

3. **Trzech kandydatów, nie jeden.** Zawsze skracaj listę do trzech platform. Użytkownik potrzebuje alternatyw na wypadek, gdyby najlepszy wybór został zablokowany przez koszty, uzależnienie od dostawcy lub ograniczenia organizacyjne.

4. **Anty-uprzedzenia są niepodlegające negocjacjom.** Trzy monity weryfikacji krzyżowej (adwokat diabła, pre-mortem, nieznane niewiadome) są uruchamiane przy każdym wywołaniu. Nie pomijaj ich, nawet jeśli najlepsza platforma jest oczywistym wyborem. Weryfikacja krzyżowa ujawnia ryzyka, które oczywiste wybory ukrywają.

5. **Odpowiedzi z wywiadu napędzają wagi, a nie wykluczenia.** Z wyjątkiem twardego filtra dotyczącego trwałych połączeń vs. serverless, odpowiedzi z wywiadu dostosowują wagi — nie dyskwalifikują platform. Użytkownik wrażliwy na koszty może nadal wybrać Fly.io, jeśli wynik DX jest wystarczająco wysoki; odpowiedź z wywiadu informuje o punktacji, a nie o puli kandydatów.

6. **Zakres to MVP, nie produkcja.** Umiejętność optymalizuje szybkość iteracji, niskie koszty operacyjne i koszty przy niskim ruchu. Nie wprowadzaj kwestii związanych ze skalą produkcyjną (przełączanie awaryjne w wielu regionach, zobowiązania SLA, dedykowane poziomy wsparcia), chyba że PRD wyraźnie tego wymaga.

7. **Etykiety wewnętrzne umiejętności pozostają wewnętrzne.** Rozmawiając z użytkownikiem, nigdy nie odwołuj się do numerów kroków ani wewnętrznych nazw pól. Używaj prostego języka: „porównanie platform”, „zalecana opcja”, „rejestr ryzyka”.

8. **Zweryfikuj polecenia „Rozpoczęcie pracy” z dokładnymi wersjami w stosie technologicznym, a nie ogólną dokumentacją platformy.** Adaptery platform, CLI i narzędzia do wdrażania szybko ewoluują — przepływ pracy, który był kanoniczny w jednej głównej wersji, może zostać zastąpiony lub być aktywnie błędny w następnej. Przed napisaniem jakiegokolwiek polecenia CLI lub lokalnej rekomendacji deweloperskiej w sekcji „Rozpoczęcie pracy” sprawdź, co faktycznie robi dziś konkretna wersja adaptera/narzędzia w `tech-stack.md`. Zwróć szczególną uwagę na: (a) czy serwer deweloperski frameworka już zapewnia wierność środowiska uruchomieniowego dla docelowej platformy (czyniąc oddzielne polecenie deweloperskie natywne dla platformy zbędnym lub przestarzałym), (b) czy interfejsy API, klucze konfiguracyjne lub wzorce dostępu do środowiska zmieniły się między głównymi wersjami, oraz (c) czy narzędzia platformy zostały połączone, zmienione nazwy lub wycofane między tym, co opisuje ogólna dokumentacja, a tym, co faktycznie dostarczają przypięte wersje projektu. Wszelkie różnice w zachowaniu wynikające z wersji należy przedstawić jako „Nieznane niewiadome” w weryfikacji krzyżowej i odzwierciedlić tylko prawidłowy, zgodny z wersją przepływ pracy w sekcji „Rozpoczęcie pracy”. Nigdy nie kopiuj poleceń CLI dosłownie ze stron marketingowych platformy lub ogólnych samouczków bez potwierdzenia, że mają zastosowanie do dokładnych używanych wersji stosu.