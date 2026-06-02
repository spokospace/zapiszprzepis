---
name: 10x-stack-assess
description: >
  Assess an existing project's stack for agent-friendliness using the 4 quality
  gates (typed, convention-based, popular in training data, well-documented) as
  an evaluation lens. Detects stack components from cwd, scores each against the
  gates, identifies compensation strategies for failures, and writes
  context/foundation/stack-assessment.md with per-component scores, gap analysis,
  and ready-to-paste CLAUDE.md/AGENTS.md entries. Use when the user has an
  existing project and wants to evaluate how well their stack supports AI agent
  workflows. Trigger phrases: "assess my stack", "evaluate my project",
  "is my stack agent-friendly", "oceń mój stack", "sprawdź projekt",
  "stack assessment", "brownfield assessment".
  Use AFTER /10x-prd (brownfield), BEFORE /10x-health-check.
argument-hint: "[path-to-prd]"
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---

# Ocena stosu: Oceń istniejący stos pod kątem przyjazności dla agentów

Ta umiejętność jest odpowiednikiem brownfield dla `/10x-tech-stack-selector`. Podczas gdy tech-stack-selector pomaga użytkownikom greenfield **wybrać** stos, stack-assess pomaga użytkownikom brownfield **ocenić** ich stos. Wykorzystuje te same cztery bramki jakości przyjazne dla agentów (`references/agent-friendly-criteria.md`), ale stosuje je jako soczewkę oceny, a nie filtr wyboru.

Umiejętność ta znajduje się w łańcuchu brownfield: `/10x-shape → /10x-prd → /10x-stack-assess → /10x-health-check`. Jej jedyne zadanie: ocenić istniejący stos pod kątem bramek jakości i stworzyć ustrukturyzowaną ocenę z konkretnymi strategiami kompensacji.

Podstawową wartością brownfield jest **ścieżka kompensacji** — gdy bramka zawiedzie, umiejętność nie zaleca wymiany stosu. Dokumentuje, co należy dodać do plików instrukcji (CLAUDE.md / AGENTS.md), aby agent mógł skutecznie działać pomimo luki.

## Kiedy używać, kiedy pominąć

**Użyj, gdy**: użytkownik ma istniejący projekt i chce ocenić, jak dobrze jego stos wspiera przepływy pracy agentów AI. Katalog projektu powinien zawierać rozpoznawalne znaczniki projektu (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `Gemfile`, `composer.json`, `*.csproj`, `pubspec.yaml`). Opcjonalnie, `context/foundation/prd.md` (brownfield) istnieje — jeśli jest obecny, umiejętność używa go do kontekstualizacji oceny (np. które komponenty są w zakresie zmian).

**Pomiń, gdy**: użytkownik rozpoczyna nowy projekt od zera — przekieruj do `/10x-tech-stack-selector`. Pomiń również, gdy użytkownik chce tylko audytu zależności lub skanowania bezpieczeństwa bez ram bramek jakości — to jest obszar `/10x-health-check`.

## Związek z innymi umiejętnościami

- `/10x-shape` — upstream. Tworzy `shape-notes.md` z `context_type: brownfield`.
- `/10x-prd` — upstream. Tworzy `context/foundation/prd.md` (szablon brownfield). Opcjonalne wejście — umiejętność może działać bez PRD.
- `/10x-tech-stack-selector` — równoległy greenfield. Te same bramki jakości, inne zadanie (wybór vs ocena).
- `/10x-health-check` — konsument downstream. Odczytuje `context/foundation/stack-assessment.md`, aby skupić kontrole zdrowia na zidentyfikowanych lukach.

## Wymagane dane wejściowe

1. Istniejąca baza kodu w bieżącym katalogu z co najmniej jednym rozpoznawalnym znacznikiem projektu.
2. `references/agent-friendly-criteria.md` — w pakiecie. Cztery bramki jakości i ścieżka kompensacji.

## Opcjonalne dane wejściowe

1. `context/foundation/prd.md` — jeśli jest obecny i ma `context_type: brownfield`, umiejętność używa `## Scope of Change` i `## Current System Overview` z PRD, aby skupić ocenę na odpowiednich komponentach stosu.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano argument ścieżki** (np. `/10x-stack-assess @context/foundation/prd.md`), usuń wiodące `@`, jeśli jest obecne, i użyj ścieżki jako lokalizacji PRD dla tego uruchomienia. PRD jest opcjonalnym kontekstem, a nie warunkiem wstępnym — umiejętność działa bez niego.
2. **Jeśli nie podano argumentu**, sprawdź `context/foundation/prd.md`. Jeśli jest obecny i ma `context_type: brownfield`, załaduj go dla kontekstu. Jeśli nieobecny, kontynuuj bez kontekstu PRD.

## Przepływ pracy

### Krok 0 — Warunek wstępny Cwd

Wykryj znaczniki projektu:

```bash
find . -maxdepth 1 \( -name "package.json" -o -name "Cargo.toml" -o -name "pyproject.toml" -o -name "go.mod" -o -name "Gemfile" -o -name "composer.json" -o -name "*.csproj" -o -name "pubspec.yaml" \) 2>/dev/null
```

Jeśli **nie znaleziono znaczników**, wydrukuj:

```
No project markers found in the current directory. /10x-stack-assess requires an existing codebase.
If you're starting from scratch, use /10x-tech-stack-selector instead.
```

Następnie ZATRZYMAJ.

Jeśli znaleziono znaczniki, przejdź do Kroku 1.

### Krok 1 — Wykryj komponenty stosu

Odczytaj pliki projektu, aby zidentyfikować stos. Wykrywanie jest oparte na plikach — odczytaj to, co jest na dysku, nie zgaduj.

**Źródła wykrywania według rodziny języków:**

| Rodzina języków | Pliki znaczników | Co wyodrębnić |
|---|---|---|
| JS/TS | `package.json`, `tsconfig.json`, `next.config.*`, `astro.config.*`, `vite.config.*`, `svelte.config.*`, `nuxt.config.*`, `angular.json`, `.eslintrc*`, `prettier.config.*`, `jest.config.*`, `vitest.config.*`, `playwright.config.*` | Język (JS vs TS — obecność `tsconfig.json`), framework, narzędzie do budowania, runner testów, linter, formatter, menedżer pakietów (z pliku blokady: `package-lock.json` → npm, `yarn.lock` → yarn, `pnpm-lock.yaml` → pnpm, `bun.lockb` → bun) |
| Python | `pyproject.toml`, `setup.py`, `setup.cfg`, `requirements.txt`, `Pipfile`, `poetry.lock`, `uv.lock` | Framework (Django, FastAPI, Flask — z zależności), sprawdzanie typów (mypy/pyright w zależnościach lub konfiguracji), runner testów (pytest/unittest), menedżer pakietów |
| Rust | `Cargo.toml` | Edycja, zależności dla frameworka webowego (Actix, Axum, Rocket), framework testowy |
| Go | `go.mod` | Wersja Go, framework webowy (Gin, Echo, Fiber, Chi, stdlib), framework testowy |
| Ruby | `Gemfile` | Framework (Rails, Sinatra), wersja Ruby, sprawdzanie typów (Sorbet/RBS), framework testowy (RSpec, Minitest) |
| PHP | `composer.json` | Framework (Laravel, Symfony), wersja PHP, sprawdzanie typów (PHPStan/Psalm), framework testowy (PHPUnit, Pest) |
| .NET | `*.csproj`, `*.sln` | Framework (wersja .NET, ASP.NET), język (C#/F#), framework testowy (xUnit, NUnit) |
| Dart | `pubspec.yaml` | Framework (Flutter, serwer Dart), framework testowy |

**Dodatkowe sygnały do sprawdzenia:**

- CI/CD: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/config.yml`, `cloudbuild.yaml`
- Wdrożenie: `Dockerfile`, `docker-compose.yml`, `fly.toml`, `vercel.json`, `netlify.toml`, `wrangler.toml`, `render.yaml`, `railway.json`, `Procfile`
- Pliki instrukcji: `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, `.github/copilot-instructions.md`
- Jakość konfiguracji: `.editorconfig`, `.prettierrc*`, `.eslintrc*`, `tsconfig.json` (sprawdzenie trybu strict)

Wyświetl wykryty stos użytkownikowi:

```
Detected stack:
  Language:        <language> (<typed: yes/no>)
  Framework:       <framework> (<version if detectable>)
  Build tool:      <build tool>
  Test runner:     <test runner or "not detected">
  Package manager: <package manager>
  CI/CD:           <provider or "not detected">
  Deployment:      <target or "not detected">
  Instruction files: <list or "none">
```

Poproś o potwierdzenie:

AskUserQuestion:
- question: "Is this detection accurate? Anything missing or wrong?"
  header: "Stack"
  options:
  - label: "Accurate — proceed (Recommended)"
    description: "Continue with this detected stack."
  - label: "Correct something"
    description: "I'll fix the detection before scoring."
  multiSelect: false

Jeśli "Correct something": zapytaj, który komponent poprawić, zastosuj nadpisanie w pamięci, kontynuuj.

### Krok 2 — Ocena pod kątem bramek jakości

Załaduj `references/agent-friendly-criteria.md`.

Dla każdego wykrytego komponentu (język, framework, narzędzie do budowania, runner testów) oceń pod kątem czterech bramek. Ocena jest na poziomie komponentu, a nie projektu — projekt może mieć język z typowaniem, ale framework nieoparty na konwencjach.

**Zasady oceniania:**

#### Bramka 1: Typowany

- **Zaliczone**: język domyślnie używa jawnych typów (TypeScript, Rust, Go, Java, Kotlin, C#, Dart) LUB projekt ma skonfigurowane sprawdzanie typów (Python + mypy/pyright w zależnościach/konfiguracji, Ruby + Sorbet/RBS, PHP + PHPStan/Psalm).
- **Niezaliczone**: JavaScript bez TypeScript, Python bez skonfigurowanego sprawdzania typów, Ruby bez Sorbet/RBS, PHP bez analizy statycznej.
- **Dowód**: podaj konkretny plik/konfigurację, która potwierdza ocenę (np. "`tsconfig.json` obecny z `strict: true`" lub "brak `mypy` w `pyproject.toml [tool.mypy]` lub zależnościach deweloperskich").

#### Bramka 2: Oparta na konwencjach

- **Zaliczone**: framework ma silne opinie na temat układu folderów, routingu, konfiguracji (Next.js App Router, Rails, Django, Spring Boot, Astro, Angular, Laravel, .NET).
- **Niezaliczone**: framework jest minimalistyczny/nieopiniotwórczy, a projekt nie ma udokumentowanych konwencji (Express, Koa, Flask bez blueprintów, Sinatra, czysty Vite + React).
- **Częściowo zaliczone**: minimalistyczny framework, ALE projekt ma udokumentowane konwencje w plikach instrukcji (CLAUDE.md, AGENTS.md) lub widoczny dokument konwencji. Ocena jako zaliczone z uwagą.
- **Dowód**: podaj siłę konwencji frameworka lub jej brak.

#### Bramka 3: Popularny w danych treningowych

- **Ocena dla rodziny języków** (kluczowa — patrz `references/agent-friendly-criteria.md`). Oceniaj w ramach rodziny języków, a nie globalnie.
- **Zaliczone**: framework jest głównym wyborem w swoim ekosystemie językowym (React, Next.js, Vue, Angular w JS; Django, FastAPI, Flask w Pythonie; Rails w Ruby; Spring w Javie; Laravel w PHP; .NET w C#; Flutter w Dart).
- **Niezaliczone**: niszowy lub bardzo nowy framework z ograniczonymi danymi treningowymi w ramach własnej rodziny języków.
- **Dowód**: nazwij framework i jego pozycję w ekosystemie językowym.

#### Bramka 4: Dobrze udokumentowany

- **Zaliczone**: framework ma aktualną, wersjonowaną oficjalną dokumentację.
- **Niezaliczone**: dokumentacja jest rozproszona, nieaktualna lub wiki utrzymywane przez społeczność jest niezsynchronizowane.
- **Dowód**: zanotuj obserwację jakości dokumentacji.

**Wyświetl macierz ocen:**

```
Quality Gate Assessment:

| Component  | Typed | Convention | Training Data | Documented | Verdict    |
|------------|-------|------------|---------------|------------|------------|
| Language   | ✓/✗   | —          | —             | —          | pass/fail  |
| Framework  | —     | ✓/✗        | ✓/✗           | ✓/✗        | pass/fail  |
| Build tool | —     | ✓/✗        | ✓/✗           | ✓/✗        | pass/fail  |
| Test runner| —     | —          | ✓/✗           | ✓/✗        | pass/fail  |

Legend: ✓ = pass, ✗ = fail, ~ = partial, — = not applicable
```

### Krok 3 — Zidentyfikuj strategie kompensacji

Dla każdej niezaliczonej bramki, stwórz konkretną strategię kompensacji. Kompensacja oznacza konkretne wpisy do dodania do plików instrukcji (CLAUDE.md / AGENTS.md), aby agent mógł skutecznie działać pomimo luki.

**Szablony kompensacji dla niezaliczonej bramki:**

**Typowany: niezaliczone** →
- Dodaj konwencję jawnych adnotacji typów do CLAUDE.md ("Cały nowy kod musi zawierać adnotacje typów na granicach funkcji")
- Dodaj regułę walidacji na granicach ("Użyj Zod/Pydantic/JSON Schema na granicach API")
- Jeśli Python: dodaj rekomendację konfiguracji mypy
- Jeśli JS: dodaj ścieżkę migracji TypeScript lub podpowiedzi typów JSDoc

**Oparty na konwencjach: niezaliczone** →
- Udokumentuj konwencje struktury folderów w CLAUDE.md ("Trasy znajdują się w src/routes/, middleware w src/middleware/, ...")
- Udokumentuj konwencje nazewnictwa ("Pliki: kebab-case, eksporty: PascalCase dla komponentów, camelCase dla funkcji")
- Udokumentuj kolejność rejestracji middleware/pluginów
- Udokumentuj wzorzec obsługi błędów

**Popularny w danych treningowych: niezaliczone** →
- Dodaj przykłady idiomów specyficznych dla frameworka do CLAUDE.md
- Podlinkuj do oficjalnej dokumentacji w pliku instrukcji
- Dodaj reguły "preferuj wzorzec X zamiast Y" dla wyborów specyficznych dla frameworka
- Zauważ, że agent może potrzebować więcej wskazówek dla tego frameworka

**Dobrze udokumentowany: niezaliczone** →
- Przypnij wersję frameworka w pliku instrukcji
- Dodaj linki do najlepszej dostępnej dokumentacji
- Dołącz wbudowane przykłady typowych wzorców
- Zauważ specyficzne dla wersji dziwactwa

Każdy wpis kompensacji musi być **gotowy do wklejenia** do pliku instrukcji — nie ogólna porada, ale rzeczywisty tekst reguły.

### Krok 4 — Określ ogólny werdykt

Na podstawie macierzy ocen i dostępnej kompensacji:

- **ready**: wszystkie bramki zaliczone dla wszystkich komponentów. Stos jest przyjazny dla agentów od razu po wyjęciu z pudełka.
- **ready-with-compensation**: niektóre bramki niezaliczone, ale wszystkie niepowodzenia mają jasne strategie kompensacji. Stos działa z udokumentowanymi konwencjami.
- **significant-friction**: wiele bramek niezaliczone ORAZ kompensacja jest ciężka (np. język bez typowania + framework nieoparty na konwencjach + niszowy w danych treningowych). Agent będzie potrzebował znacznego kierowania.

Werdykt jest informacyjny, nie blokujący. Nawet `significant-friction` nie oznacza "zmień stos" — oznacza "zaplanuj więcej czasu na tworzenie plików instrukcji i spodziewaj się więcej cykli korekcji agenta".

### Krok 5 — Napisz ocenę

Sprawdź kolizję:

```bash
test -f context/foundation/stack-assessment.md
```

Jeśli plik istnieje, zapytaj:

AskUserQuestion:
- question: "context/foundation/stack-assessment.md already exists. How would you like to proceed?"
  header: "Collision"
  options:
  - label: "Overwrite (Recommended)"
    description: "Replace the existing assessment. The prior version is lost unless committed."
  - label: "Save as stack-assessment-v2.md"
    description: "Preserve history. New assessment lands at the next available version slot."
  - label: "Abort"
    description: "Exit without writing. The conversation assessment is preserved in chat only."
  multiSelect: false

Zbuduj plik wyjściowy:

```markdown
---
project: <project name from package.json/Cargo.toml/etc or directory name>
assessed_at: <ISO 8601 timestamp>
agent_readiness: <ready | ready-with-compensation | significant-friction>
context_type: brownfield
stack_components:
  language: <language>
  framework: <framework>
  build_tool: <build tool>
  test_runner: <test runner or null>
  package_manager: <package manager>
  ci_provider: <provider or null>
  deployment_target: <target or null>
gates_passed: <N>
gates_failed: <N>
---

## Stack Components

<detected stack details — one paragraph per component, noting version where detectable>

## Quality Gate Assessment

<the scoring matrix from Step 2, with evidence for each score>

### Gate Details

<per-gate breakdown with evidence citations — which file/config proved each score>

## Gaps & Compensation

<for each failed gate: what failed, why it matters for agent workflows, and the concrete compensation strategy>

### Recommended Instruction File Additions

<ready-to-paste CLAUDE.md/AGENTS.md entries for each compensation strategy, formatted as markdown rule blocks the user can copy directly>

## Summary

<overall verdict, key strengths, key gaps, and recommended next step (/10x-health-check)>
```

Zapisz do `context/foundation/stack-assessment.md` (tworząc `context/foundation/`, jeśli nie istnieje).

Po zapisie skopiuj polecenie następnego kroku i ogłoś:

```bash
echo -n "/10x-health-check" | pbcopy 2>/dev/null || echo -n "/10x-health-check" | clip.exe 2>/dev/null || echo -n "/10x-health-check" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-health-check"
```

Wydrukuj:

```
═══════════════════════════════════════════════════════════
  STACK ASSESSED
═══════════════════════════════════════════════════════════

  Project:       <project name>
  Readiness:     <ready | ready-with-compensation | significant-friction>
  Gates passed:  <N> / <total>

  ► Assessment:  context/foundation/stack-assessment.md
  ► Next:        /10x-health-check  (✓ copied to clipboard)
═══════════════════════════════════════════════════════════
```

ZATRZYMAJ. Nie łącz automatycznie z `/10x-health-check` — użytkownik uruchamia go, gdy jest gotowy.

## Wynik

Zapisany pojedynczy plik: `context/foundation/stack-assessment.md` (lub `stack-assessment-vN.md`, jeśli wybrano wersjonowany zapis).

## Referencje

- `references/agent-friendly-criteria.md` — cztery bramki jakości, zastrzeżenie dotyczące rodziny języków, ścieżka kompensacji.

## Krytyczne zabezpieczenia

1. **Cwd jest warunkiem wstępnym.** Umiejętność wymaga istniejącej bazy kodu z rozpoznawalnymi znacznikami projektu. Brak oceny wyłącznie na podstawie kontekstu rozmowy.

2. **Oceniaj, nie zalecaj wymiany.** Umiejętność nigdy nie zaleca zmiany stosów. Ocenia to, co istnieje i dostarcza strategie kompensacji. Użytkownik wybrał swój stos z powodów, których umiejętność nie zna — uszanuj ten wybór.

3. **Ocena dla rodziny języków dla bramki 3.** Oceniaj "popularny w danych treningowych" w ramach rodziny języków, a nie globalnie. Django jest popularne w Pythonie; to, że ma mniej pobrań npm niż React, jest nieistotne.

4. **Kompensacja jest konkretna, nie ogólna.** Każdy wpis kompensacji musi być gotową do wklejenia regułą pliku instrukcji. "Dodaj lepszą dokumentację" nie jest kompensacją; "Dodaj do CLAUDE.md: `## Routing — Trasy są rejestrowane w src/routes/index.ts. Każdy plik trasy eksportuje domyślny handler Hono. Middleware działa w kolejności rejestracji.`" jest kompensacją.

5. **Dowody dla każdej oceny.** Każde zaliczenie lub niezaliczenie bramki musi cytować konkretny plik, sekcję konfiguracji lub jej brak, które uzasadniają ocenę. Brak oceny opartej na "odczuciach".

6. **Etykiety wewnętrzne umiejętności pozostają wewnętrzne.** Rozmawiając z użytkownikiem, nigdy nie odwołuj się do numerów bramek ("Bramka 1"), liter kroków ("Krok 2") ani wewnętrznych nazw pól (`agent_readiness`, `gates_passed`). Używaj prostego języka: "bezpieczeństwo typów twojego stosu", "ogólna gotowość agenta", "ile kryteriów spełnia twój stos".

7. **Tylko język uniwersalny.** Brak prywatnych ścieżek skarbca ani brandingu specyficznego dla organizacji w dostarczanej treści.