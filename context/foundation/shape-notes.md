---
project: "ZapiszPrzepis — Discovery via Exa"
version: 1
context_type: brownfield
created: 2026-07-04
updated: 2026-07-04
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "preview type"
      decision: "Exa data only (title, og:image, source, snippet) — no extraction on preview; pipeline runs only after 'Zapisz'"
    - topic: "voice search tech"
      decision: "Web Speech API (browser-native, free, Chrome Android supports Polish)"
    - topic: "search trigger"
      decision: "search on Enter/submit — never debounce (each request = 1 Exa quota)"
    - topic: "preview page background"
      decision: "light beige background to visually distinguish from saved recipes"
    - topic: "save behavior"
      decision: "reuse addRecipeFromUrl(url) — button disabled + 'Zapisuję…'; user can still read or go back"
    - topic: "home redesign"
      decision: "logout moved to icon in top corner; larger 'Moje przepisy' button; discovery search below it"
  frs_drafted: 6
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 1
  hard_deadline: "2026-07-06"
  after_hours_only: true
---

## Current System

ZapiszPrzepis — Next.js PWA wdrożona na Cloudflare Workers (OpenNext), domena `zapiszprzepis.pl`. Stos: Next.js, Supabase (PostgreSQL + magic-link auth + Storage), Inngest (async job runner), Firecrawl/OpenAI (ekstrakcja przepisów), pnpm.

Użytkownicy: mama autora (jedna osoba; prywatna kolekcja per-user z RLS).

**Co istnieje dziś:**
- `RecipeSearch` — filtrowanie własnej kolekcji po tytule/składniku (`?q=` param, JS .includes() po pobranych wierszach)
- `addRecipeFromUrl(url)` — server action: dedup URL, Supabase insert do `recipe_shares`, trigger Inngest event `recipe/extract`
- Inngest pipeline: pobierz treść (Firecrawl/yt-dlp) → ekstrakcja (OpenAI) → redakcja składników → zapis do `recipes`
- Supabase `recipes` tabela: title, slug, description, image_url, ingredients (jsonb), steps (jsonb), source_type, source_url, category enum, youtube_id
- Auth: magic-link w pełni wpięty; długożyjąca sesja; middleware SSR

**Ból / luka:** brak odkrywania **nowych** przepisów. Użytkownik może tylko przeglądać własną kolekcję — nie może znaleźć przepisu z internetu bez wyjścia z aplikacji i samodzielnego szukania.

**Wyzwalacz tej zmiany:** Exa REST API (obsługiwane przez Cloudflare Workers przez zwykły `fetch`) umożliwia szybkie przeszukiwanie internetu po przepisy; istniejący pipeline obsługuje save z dowolnego URL — brakuje tylko UI discovery i wywołania Exa.

## Vision & Problem Statement

Dodanie **wyszukiwarki przepisów z internetu** (discovery) do istniejącej aplikacji. Użytkownik wpisuje hasło (lub mówi do mikrofonu) → dostaje listę wyników z internetu → klika wynik → widzi podgląd → może zapisać do kolekcji jednym kliknięciem.

Delta: dziś użytkownik musi znaleźć przepis poza aplikacją i dopiero wtedy użyć Web Share Target. Po tej zmianie całe odkrywanie + zapis odbywa się wewnątrz aplikacji.

## User & Persona

Bez zmian — mama autora (Android, Chrome). Nowa funkcja jest dla niej opcjonalną ścieżką: zamiast share'owania z FB/YT, może szukać bezpośrednio w aplikacji wpisując lub mówiąc nazwę dania.

## Access Control

Bez zmian w modelu uwierzytelniania. Wyszukiwarka discovery dostępna tylko dla zalogowanego użytkownika (ta sama sesja magic-link). Brak nowych ról, brak dostępu publicznego do wyników Exa. `EXA_API_KEY` przechowywany jako Cloudflare secret (server-side only, nigdy w kliencie).

Nie planowane zmiany — obecny model zachowany.

## Success Criteria

### Primary

Użytkownik wpisuje hasło w aplikacji i w ciągu < 2 sekund widzi listę wyników przepisów z internetu; kliknięcie „Zapisz" przy wyniku uruchamia istniejący pipeline i przepis pojawia się w kolekcji tak samo jak przy share'owaniu.

### Secondary

Głosowe wyszukiwanie działa na Chrome Android — mama mówi nazwę dania, pole tekstowe się wypełnia i wyniki pojawiają się po rozpoznaniu mowy.

### Guardrails

- **Istniejący RecipeSearch** (filtrowanie własnej kolekcji) działa bez zmian
- **addRecipeFromUrl pipeline** działa identycznie jak przy Web Share Target — brak regresji
- **EXA_API_KEY** nigdy nie trafia do klienta; całe wywołanie Exa odbywa się w server action
- **Limit Exa** (1000 req/mies.) nie jest przekraczany — search tylko na submit, nie debounce

## Functional Requirements

### Strona główna

- FR-001: Użytkownik po zalogowaniu widzi stronę główną z: przyciskiem „Moje przepisy" (duży, centralny), wyszukiwarką discovery (pod nim) oraz ikoną/menu nawigacji w górnym rogu (z opcją wylogowania). Priorytet: must-have. Zmiana: modified
  > Sokrates: Rozważono kontrargument: „mama jest przyzwyczajona do obecnego layoutu". Rozwiązanie: zachowano — obecny layout z wylogowaniem na stronie głównej to tymczasowy placeholder, nie finalny design. Mama ma sesję długożyjącą i nie klika Wyloguj w codziennym użytkowaniu.

### Wyszukiwarka discovery

- FR-002: Użytkownik może wpisać zapytanie w pole wyszukiwania i nacisnąć Enter (lub kliknąć Szukaj) — aplikacja pobiera wyniki z Exa REST API. Priorytet: must-have. Zmiana: new
  > Sokrates: Rozważono kontrargument: „user oczekuje wyników w trakcie pisania (Google Suggest)". Rozwiązanie: zachowano search-on-submit — debounce = każdy znak to 1 request = spalony limit 1000 req/mies.

- FR-003: Użytkownik może kliknąć przycisk mikrofonu przy polu wyszukiwania — przeglądarka nagrywa mowę (Web Speech API), przepisuje ją do pola tekstowego i uruchamia wyszukiwanie. Priorytet: must-have. Zmiana: new
  > Sokrates: Rozważono kontrargument: „Web Speech API ma słabe rozpoznawanie polskiego". Rozwiązanie: zachowano — Chrome Android używa Google Speech Recognition, który dobrze obsługuje polski. Ryzyko: mama może nie używać mikrofonu w praktyce; akceptowalne.

- FR-004: Wyniki wyszukiwania wyświetlane są jako lista kart: tytuł, miniaturka (og:image), nazwa domeny źródłowej, krótki snippet. Karty z URL-ami już zapisanymi w kolekcji użytkownika są oznaczone (np. „Już zapisano"). Priorytet: must-have. Zmiana: new
  > Sokrates: Rozważono kontrargument: „zapytanie Supabase do sprawdzenia każdego URL wynikowego dodaje opóźnienie". Rozwiązanie: zachowano — jeden batch SELECT (WHERE source_url IN (...)), nie N zapytań. Bez dedupu mama może zapisać ten sam przepis dwa razy.

### Podgląd wynikowy

- FR-005: Kliknięcie karty wynikowej otwiera stronę podglądu w istniejącym designie przepisu (jasnobeżowe tło odróżniające od zapisanych), pokazując dane z Exa: tytuł, miniaturka, źródło, snippet. Przycisk „Zapisz" i stała nawigacja (strzałka Wstecz) na górze. Pipeline ekstrakcji NIE jest uruchamiany przy podglądzie. Priorytet: must-have. Zmiana: new
  > Sokrates: Rozważono kontrargument: „snippet z Exa może być niewystarczający do oceny przepisu". Rozwiązanie: zachowano — tytuł + zdjęcie + źródło to ta sama ilość informacji co Facebook preview; mama podejmuje decyzję o zapisaniu dokładnie tak samo jak na FB.

- FR-006: Kliknięcie „Zapisz" na stronie podglądu wywołuje istniejące `addRecipeFromUrl(url)` — przycisk zmienia się na „Zapisuję… pojawi się w Moich Przepisach za chwilę" i staje się nieaktywny; użytkownik może nadal czytać podgląd lub kliknąć Wstecz. Priorytet: must-have. Zmiana: new (reuse istniejącego pipeline)
  > Sokrates: Rozważono kontrargument: „user klika Zapisz i nie wie gdzie szukać wynikowego przepisu". Rozwiązanie: zachowano z komunikatem wskazującym kierunek — ten sam wzorzec co Web Share Target.

## Business Logic

Brak zmiany logiki domenowej. Jest to zmiana infrastrukturalna/UI — nowe źródło URL-i (wyniki Exa) zasilające istniejący pipeline ekstrakcji. Reguła domenowa pozostaje niezmieniona:

> URL → ekstrakcja (Firecrawl/OpenAI) → normalizacja (język + miary + struktura) → archiwizacja

Exa dostarcza URL-e; cała decyzja domenowa (klasyfikacja kategorii, normalizacja języka, strukturyzacja składników) jest obsługiwana przez istniejący pipeline bez modyfikacji.

## Non-Functional Requirements

- Odpowiedź Exa REST API < 2 sekundy p95 (Exa typowo < 500ms)
- Web Speech API działa na Chrome Android — głosowe rozpoznawanie polskiego (Google Speech Recognition)
- `EXA_API_KEY` wyłącznie server-side (Cloudflare secret, wzorzec jak istniejące klucze Firecrawl/OpenAI)
- Dedup check = jeden batch SELECT, nie N zapytań — brak wpływu na czas ładowania wyników
- Nie pogarsza się wydajność istniejącego `RecipeSearch` (własna baza, niezależna ścieżka)

## Constraints & Preserved Behavior

- **RecipeSearch** (filtrowanie po własnej kolekcji, `?q=` param) działa bez zmian — nowe i stare ścieżki wyszukiwania są niezależne
- **addRecipeFromUrl + Inngest pipeline** bez modyfikacji — wywołanie z podglądu Exa jest identyczne jak z Web Share Target
- **Limit Exa**: 1000 req/mies. (free tier) — nigdy search-on-debounce; tylko search-on-submit
- **RLS per-user**: `Zapisz` tworzy `recipe_shares` z user_id z sesji — bez zmian w politykach Supabase
- **Cloudflare Workers**: wywołanie Exa przez zwykły `fetch` (nie Node.js) — bez nowych bundlerów ani runtime

## Non-Goals

- **Paginacja wyników Exa** — Exa zwraca domyślnie 10 wyników; paginacja wraca gdy limit okaże się niewystarczający
- **Filtrowanie po kuchni / diecie w interfejsie** — Exa nie ma kategorii „recipe"; brak UI filtrów
- **Cachowanie wyników Exa** — dla 1 użytkownika niepotrzebne
- **iOS / Safari — głos** — Web Speech API ma niepełne wsparcie w Safari; brak gwarancji na iOS
- **Ocenianie / filtrowanie wyników Exa przed zapisem** — brak ratingu, thumbs up/down itp.
- **Pełna ekstrakcja w widoku podglądu** (przed kliknięciem Zapisz) — pipeline odpala się tylko po Zapisz, tak jak przy Web Share Target

## Quality cross-check

Wszystkie 6 elementów kontroli jakości są obecne:
- Kontrola dostępu: obecna — magic-link bez zmian; EXA_API_KEY server-side
- Logika biznesowa: obecna — „brak zmiany logiki domenowej; zmiana infrastrukturalna" (prawidłowe dla brownfield)
- Artefakty projektu: obecne
- Potwierdzenie kosztów czasowych: obecne — 1 dzień / deadline 2026-07-06
- Non-goals: obecne — 6 pozycji
- Zachowane zachowanie: obecne — Constraints & Preserved Behavior jawnie wymienia co nie może się zepsuć

## Open Questions

1. **Co gdy Web Speech API nie jest dostępne?** (HTTP zamiast HTTPS, lub przeglądarka inna niż Chrome) — czy mikrofon po prostu ukryty, czy pokazuje błąd? Do zdecydowania przy implementacji.

## Forward: tech-stack (informacyjne)

- Exa REST API: `POST https://api.exa.ai/search`, nagłówek `x-api-key: EXA_API_KEY`, payload `{query, type: 'auto', numResults: 10}` — bez `contents` i bez `includeDomains` (Exa samodzielnie filtruje jakość wyników)
- Server action: nowy `searchRecipesOnline(query: string)` analogiczny do istniejących server actions
- Web Speech API: `window.SpeechRecognition || window.webkitSpeechRecognition`, lang: `'pl-PL'`
- Dedup: jeden `supabase.from('recipe_shares').select('source_url').in('source_url', urls)` w server action
- Ważna uwaga z notatki: NIE używać Exa MCP — MCP to narzędzie deweloperskie Claude Code, nie działa w aplikacji
