# Reguły projektu zapiszprzepis

## Commits, issues and PRs — English only

Git commit subjects **and** bodies, and every issue and PR title, description and comment (reviews, label rationale, claim/status comments, backlog adoption comments included), must be written in English, even when `plan.md`, `change.md`, prompts or the conversation are in Polish.

**Why:** Keeps the git log consistent with the project's already-English file and identifier names (`createSupabaseServerClient`, `signInWithEmail`, …) and with the broader open-source convention. Polish words in Conventional-Commits subjects (observed during F-01 phase commits, e.g. „bootstrap środowiska Supabase", „klienty SSR + proxy") create mixed-language history that future tooling and contributors have to work around.

**How to apply:**
- English in commit subjects and bodies, including the phase-end ritual `<type>(<change-id>): <phase title> (p<N>)` — translate the Polish phase title from `plan.md` to a short English phrase rather than copying verbatim.
- The epilogue commit's "close out plan" body is also English.
- When proposing a commit message via `AskUserQuestion`, draft it in English; the user can still override.
- Issues and PRs: title, body and every comment in English. Polish UI copy is quoted verbatim in quotes or backticks (e.g. „Dodaj do ulubionych”, `Dodała/Dodał`); the surrounding sentence is English. Polish design-handoff names (`Wersje przepisu.dc.html`) stay as they are.
- Existing Polish issue bodies (e.g. epic #201) are not rewritten just for language; translate a section only when the issue is edited for another reason.
- `plan.md`, `change.md`, specs under `.ai/specs/`, and chat stay in whichever language they were started in.

## One account (`spokospace`) — review and merge

The project has exactly one GitHub account, `spokospace`: owner, author of every PR (Claude sessions included) and the reviewer. **A PR whose tests pass may be merged.**

**Why:** GitHub blocks approving or requesting changes on your own PR, and every PR here is "your own". Rules built for several people (skip self-authored PRs, wait for an approval or a separate QA reviewer) would block every PR forever.

**How to apply:**
- Never skip a PR because its author is `spokospace` (`om-review-prs` and the other `om-*` skills included). Post the review as a `COMMENT`; the pipeline label (`merge-queue` / `changes-requested`) carries the verdict.
- Merge (squash) when the validation gate — `pnpm typecheck`, `pnpm lint`, `pnpm test` — passes on the PR head merged with the current `master`. Workers Builds runs only on `master` (preview builds for PR branches are off to save Cloudflare build minutes), so a PR has no Cloudflare check to wait for; after merging, confirm the `master` build passed (`SDLC.md`). Manual QA (`needs-qa`) is advisory for this account; this rule overrides the QA gate in `SDLC.md`. Note on the PR that it merged on green tests without manual QA.
- Still never merge: a draft, a PR with a merge conflict, a PR labeled `do-not-merge` / `blocked`, or one whose description or runbook requires a manual production step first (e.g. a migration applied through the Management API) until the owner confirms that step is done.

## Przebudowa (epik E01) — zasady projektowe: WCAG, czytelność, model

Obowiązują **każdy ekran** przebudowy (publiczna aplikacja, wysoka czytelność; grupa docelowa obejmuje osoby starsze). Backlog: `.ai/specs/backlog-przebudowa.md`. Tokeny i prymitywy: `src/app/globals.css` + `src/app/components/ui/`.

- **WCAG 2.2 AA to standard każdego ekranu:** kontrast tekstu ≥ 4,5:1 (duże nagłówki 3:1), elementy UI i obramowania pól 3:1, cele dotyku ≥ 48 px, widoczny focus (`outline: 3px solid #1d4ed8; offset 2px`), linki podkreślone, ikony zawsze z podpisem (jedyny wyjątek: serce na zdjęciu karty — patrz „Ulubione” niżej).
- **Czytelność dla starszych osób:** treść 19 px (mobile), tekst pomocniczy ≥ 16 px w kolorze `#374151`, przyciski główne 56 px, bez przewijania strony w poziomie (WCAG 1.4.10, pilnuje `pnpm test:reflow`). Wyjątek: karuzela kart (`CardCarousel`) przewija się w swoim pasku. Żadnego gestu bez przycisku-odpowiednika, więc karuzela ma zawsze przyciski „Poprzednie” / „Następne”.
- **Pomarańcz z białym tekstem to `#c2410c`** — nigdy `#f97316` ani `#ea580c` z białym tekstem (2,8:1). Używaj tokenów (`bg-action`, `text-ink`, `border-field`…), nie surowych hexów.
- **Model:** jeden przepis na dany link źródłowy (globalny dedup, bez duplikatów). Publiczny slug bez loginu: `/przepis/{nazwa}`. „Moje przepisy” = dodane przeze mnie jako pierwsza osoba; gdy ktoś doda link, który już jest, przepis trafia do jego Ulubionych. „Ulubione” = serce, dowolne przepisy (nigdy gwiazdka): na stronie przepisu przycisk z podpisem; na kartach list samo serce w białym kółku 48 px na zdjęciu, z nazwą dostępną dla czytników („Dodaj do ulubionych: {tytuł}”).
- **Źródło zamiast loginu** na kartach i przepisie (np. `aniagotuje.pl`, „YouTube · {kanał}”). „Kto dodał”: drobna linijka „Dodała/Dodał {nazwa}” z linkiem do `/u/{username}`.
- **Badge źródła = ikona/logo + skrócony tekst** (decyzja właściciela, nadpisuje makiety i handoff README §39 „Facebook · {profil}”; **nie cofać do prefiksu „Facebook ·”**). Logo platformy niesie nazwę platformy, więc tekst jest możliwie krótki: **Facebook → logo „f” + sama nazwa autora** („Kulinarna Wiola”, bez słowa „Facebook”; gdy autor nieznany — samo „Facebook”); YouTube → „YouTube · {kanał}”; blog → domena bez `www.` lub skrót nazwy (`blogspot`/`wordpress`). Ogon marketingowy po spacjowanym myślniku ucinany (`trimAuthorTail`, #413). Źródłem prawdy są `src/lib/recipe-source.ts`, `src/app/components/source-badge.tsx` i ich testy — nie makiety `.dc.html`.
- **Dostęp:** gość przegląda i szuka; zalogowany (Facebook/Google) ma ulubione i galerię; dodawanie przepisów tylko z pełnym dostępem (kod lub płatność). Płeć wybierana raz przy pierwszym logowaniu, nieedytowalna.
- **Wariant projektowy:** styl 1c (wysoka czytelność) + struktura nawigacji 1a. Wariant 1b (dolna nawigacja) niewdrażany.
- **Nagłówek (decyzje właściciela, nadpisują starsze makiety i specy):**
  - Nazwa to zawsze „Zapisz Przepis” (dwa słowa); w zdaniach z odmianą „w aplikacji Zapisz Przepis”; adres „zapiszprzepis.pl” (#339, pilnuje `brand-logo.test.ts`).
  - Nagłówek poniżej 1024 px, dla wszystkich (gość, zalogowany, pełny dostęp): napis „Zapisz Przepis” (sam tekst, bez ikony) · „Szukaj” · „MENU” (handoff v8, #340). Od `lg` logo = ikona `logo-icon.svg` + napis. To samo logo z ikoną (`BrandLogo`) na ekranach konta: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/confirm`. Zawsze przez `src/app/components/brand-logo.tsx` (`BrandLogo` / `LogoIcon` + `LogoWordmark`); nigdy `logo-lettering.svg` ani stare `logo.svg` (#320, #331, #334 — pilnuje `brand-logo.test.ts`).
  - „Dodaj przepis” w nagłówku tylko od `lg`; poniżej jest w MENU („Moje”, bez pełnego dostępu z kłódką) i jako kafel na stronie głównej (#340). „Szukaj” ukryty na `/szukaj`.
  - „Powiadomienia” poniżej `lg` to wiersz w MENU („Moje”) + licznik na przycisku MENU; dzwonek w nagłówku tylko od `lg` (#323). Gość: „Zaloguj się” / „Załóż konto” są w MENU (#324), od `lg` w nagłówku.
  - Jeden link wstecz na ekran: „← Wróć” zastępuje logo pod stroną startową. Na stronie przepisu otwartej z listy nagłówek nazywa listę („← Wyniki”, „← Ciasteczka”) — poniżej `lg` nie ma osobnego paska listy ani „N z M”; od `lg` zostaje rząd A9 (#344, zastępuje #324 dla strony przepisu).
  - Źródłem prawdy jest `src/app/components/app-header.tsx` i jego testy — handoff `.dc.html` w tych punktach jest nieaktualny.

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

## Weryfikacja ekranów zalogowanego — konto QA (dev-only)

Agent **nie wpisuje haseł** w formularz logowania (Supabase auth to zewnętrzny host). Ekrany zalogowanego sprawdzaj na lokalnym dev serwerze przez `/api/dev/login`. Pełna instrukcja: **[docs/dev-qa-login.md](docs/dev-qa-login.md)**.

- `/api/dev/login?as=full&next=/ścieżka` → `qa-full@zapiszprzepis.pl`, pełny dostęp (może dodawać przepisy),
- `/api/dev/login?as=free&next=/ścieżka` → `qa-free@zapiszprzepis.pl`, bez pełnego dostępu (ulubione, galeria, zablokowany kafel „Dodaj przepis”).
- Przełączanie kont = po prostu otwórz drugi URL (nadpisuje sesję). Wylogowanie z menu działa normalnie.
- W worktree: skopiuj `.env.local` z głównego checkoutu (jest w `.gitignore`) i odpal dev na wolnym porcie.
- 404 = route wyłączony / brak zmiennych → zgłoś ekran jako „niezweryfikowany”, nie obchodź. 409 = mail nie jest potwierdzonym kontem.
- **Lokalny dev = produkcyjna baza.** Zapisy kont QA to prawdziwe wiersze: trzymaj je minimalne i sprzątaj po teście (np. odznacz serce). **Nigdy nie dodawaj przepisów jako konto QA** — trafiłyby do publicznego katalogu.
- Nie zakładaj, nie usuwaj i nie zmieniaj kont QA samodzielnie — robi to właściciel w Supabase Dashboard.
