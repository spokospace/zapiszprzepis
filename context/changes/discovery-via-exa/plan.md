# Discovery via Exa — Plan implementacji

## Przegląd

Dodajemy do `AddRecipeForm` możliwość wyszukiwania przepisów w sieci przez Exa Search API.
Jeden unified input: URL wklejony → istniejący pipeline bez zmian; tekst wpisany →
serwer woła Exa, zwraca 5 wyników, user klika Zapisz przy wybranym, wybrany URL wchodzi
tym samym `addRecipeFromUrl` co zawsze. Żadna linia `inngest/functions.ts` nie zmienia się.

## Analiza stanu obecnego

- `AddRecipeForm` (`src/app/(authenticated)/recipes/recipes-content.tsx:31-89`) —
  klient, `<input type="url">`, `handleSubmit` → `addRecipeFromUrl(formData)`.
- `addRecipeFromUrl` (`src/app/(authenticated)/recipes/add-recipe-action.ts:9-63`) —
  server action: dedup → insert `recipe_shares` → `inngest.send('recipe/extract')` → redirect.
- `src/lib/env.ts` — centralny walidator env-var; każda nowa integracja musi tu lądować
  (lessons.md: `Validate required env vars at module load via a single lib/env.ts`).
- Exa REST API: `POST https://api.exa.ai/search`, nagłówek `x-api-key`. Nie Exa MCP.
- Brak `includeDomains` — świadoma decyzja: czyste Exa search bez filtrowania domen.

## Pożądany stan końcowy

User wpisuje "tiramisu" w pole przepisu i naciska Enter → pojawia się lista 5 wyników
z sieci → klika Zapisz przy wybranym → przepis zapisuje się jak zawsze.
URL wklejony zamiast tekstu → zachowuje się identycznie jak dziś. Zmiana niewidoczna
dla istniejącego flow, niewidoczna dla pipeline.

### Kluczowe odkrycia

- Detekcja URL vs query: `value.startsWith('http://') || value.startsWith('https://')`
  — prosta i wystarczająca; czyste domeny bez protokołu będą traktowane jako query (akceptowalne).
- `alreadySaved` flag: query `SELECT source_url FROM recipes WHERE user_id = $uid AND source_url = ANY($urls)` — jeden dodatkowy request przy każdym wyszukiwaniu Exa.
- `addRecipeFromUrl` przyjmuje `FormData` z polem `url` — każdy wynik Exa może mieć mini-form z hidden input, Zapisz = submit tej formy (zero nowej logiki save).
- `AbortSignal.timeout(10000)` wymagane na każdym outbound fetch (lessons.md).

## Czego NIE robimy

- Nie modyfikujemy `inngest/functions.ts`, `add-recipe-action.ts`, `detect-source-type.ts` ani Supabase schema.
- Nie dodajemy `includeDomains` — brak filtrowania domen, czysty Exa search.
- Nie przekazujemy tytułu z Exa do LLM jako hint (pipeline i tak ekstrahuje tytuł z treści).
- Nie debounce'ujemy wyszukiwania — szukanie wyłącznie na submit/Enter.
- Nie robimy paginacji ani "załaduj więcej" — stałe 5 wyników.

## Podejście do implementacji

Dwa etapy, niezależne: najpierw infrastruktura po stronie serwera (env + server action),
potem UI. Każdy etap jest testowalny osobno: server action można wywołać z curl/dev tools
zanim UI jest gotowy.

## Krytyczne szczegóły implementacji

- **`AbortSignal.timeout`**: Cloudflare Workers ma globalny timeout CPU, ale Exa może
  powoli odpowiadać. Użyj `AbortSignal.timeout(10000)` w fetchu do Exa — bez tego
  Worker zawiesza się przy hungu TCP (lessons.md: outbound fetch in scripts/actions).
- **`EXA_API_KEY` w `env.ts`**: Dodaj jako required (throw przy starcie), import
  wszędzie przez `@/lib/env` — nie `process.env.EXA_API_KEY!` (lessons.md: env vars).

---

## Faza 1: Infrastruktura Exa

### Przegląd

Dodajemy env var i server action, który woła Exa i zwraca gotowe do wyświetlenia wyniki
ze znacznikami `alreadySaved`. UI tej fazy nie dotykamy.

### Wymagane zmiany

#### 1. Env var

**Plik**: `src/lib/env.ts`

**Cel**: Zarejestrować `EXA_API_KEY` jako required env var — throw przy module load gdy brak.

**Kontrakt**: Nowy eksport `EXA_API_KEY: string` dodany do istniejącego `env.ts` na wzór
pozostałych required vars w tym pliku. Import przez `@/lib/env` w server action.

#### 2. Server action — wyszukiwanie przez Exa

**Plik**: `src/app/(authenticated)/recipes/search-via-exa-action.ts` (nowy plik)

**Cel**: Server action `'use server'` przyjmujący `query: string`, wołający Exa REST API,
zwracający listę 5 wyników z flagą `alreadySaved` dla każdego URL.

**Kontrakt**:

```ts
export type ExaResult = {
  url: string
  title: string
  alreadySaved: boolean
}

export type ExaSearchResponse =
  | { results: ExaResult[] }
  | { error: string }

export async function searchViaExa(query: string): Promise<ExaSearchResponse>
```

Implementacja kolejno:
1. Pobierz `userId` z sesji Supabase (`createSupabaseServerClient` + `auth.getSession()`).
2. Wywołaj `POST https://api.exa.ai/search` z `{ query, numResults: 5, type: 'auto' }`,
   nagłówek `x-api-key: EXA_API_KEY`, `AbortSignal.timeout(10000)`.
3. Wyodrębnij tablicę `{ url, title }` z odpowiedzi Exa (`results[]`).
4. Query Supabase: `SELECT source_url FROM recipes WHERE user_id = $uid AND source_url = ANY($urls)`.
5. Dla każdego wyniku: `alreadySaved = savedUrls.has(result.url)`.
6. Zwróć `{ results }` lub `{ error: message }` przy każdym wyjątku.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `pnpm typecheck` przechodzi — `ExaSearchResponse` i `ExaResult` poprawnie wytypowane.
- `pnpm lint` przechodzi — brak unused imports.

#### Weryfikacja ręczna

- Wywołanie server action z "tiramisu" zwraca tablicę ≤5 wyników z polami `url`, `title`, `alreadySaved`.
- Wywołanie z celowo nieprawidłowym kluczem API zwraca `{ error: ... }` (nie rzuca uncaught).
- `EXA_API_KEY` brakujący w `.env.local` powoduje clear error przy starcie dev serwera.

---

## Faza 2: UI — unified input i panel wyników

### Przegląd

Modyfikujemy `AddRecipeForm` tak, żeby jeden input obsługiwał URL (stary flow) i tekst
(nowy flow przez Exa). Dodajemy panel wyników z kartami wyników i przyciskami Zapisz.

### Wymagane zmiany

#### 1. Rozszerzenie AddRecipeForm

**Plik**: `src/app/(authenticated)/recipes/recipes-content.tsx`

**Cel**: Zmienić input z `type="url"` na `type="text"`, dodać detekcję URL vs query
w `handleSubmit`, zarządzać nowym stanem wyników/błędu, renderować panel wyników.

**Kontrakt — zmiany w komponencie**:

- `<input type="text">` zamiast `type="url"`, placeholder: `"Wklej link lub wpisz nazwę przepisu"`.
- Nowy stan: `const [searchState, setSearchState] = useState<SearchState>('idle')` i
  `const [exaResults, setExaResults] = useState<ExaResult[]>([])`.
  ```ts
  type SearchState = 'idle' | 'searching' | 'results' | 'error'
  ```
- `handleSubmit` — detekcja:
  ```ts
  const isUrl = value.startsWith('http://') || value.startsWith('https://')
  if (isUrl) {
    // istniejący flow: addRecipeFromUrl(formData)
  } else {
    setSearchState('searching')
    const res = await searchViaExa(value)
    if ('error' in res) setSearchState('error')
    else { setExaResults(res.results); setSearchState('results') }
  }
  ```
- Pod inputem: warunkowo renderuj `<ExaResultsPanel>` gdy `searchState === 'results'`,
  komunikat błędu gdy `searchState === 'error'`, spinner gdy `searchState === 'searching'`.

#### 2. Komponent panelu wyników

**Plik**: `src/app/(authenticated)/recipes/recipes-content.tsx` (inline lub wyodrębniony
do `src/app/(authenticated)/recipes/exa-results-panel.tsx`)

**Cel**: Wyświetlić listę wyników Exa z przyciskiem Zapisz przy każdym i identyfikacją
wyników już istniejących w kolekcji.

**Kontrakt**:

```ts
type ExaResultsPanelProps = {
  results: ExaResult[]
  onClose: () => void
}
```

Każda karta wyniku zawiera:
- Tytuł (`result.title`)
- Domena wyodrębniona z URL (np. `new URL(result.url).hostname`)
- Badge "Już zapisany" gdy `result.alreadySaved`
- Mini-form z `<input type="hidden" name="url" value={result.url}>` + przycisk "Zapisz"
  (form action = `addRecipeFromUrl`, wzorzec identyczny z istniejącym `AddRecipeForm`)

Przycisk "Zamknij / Nowe wyszukiwanie" resetuje `searchState` do `'idle'`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `pnpm typecheck` przechodzi — `SearchState`, `ExaResult` poprawnie wytypowane w komponentach.
- `pnpm lint` przechodzi.

#### Weryfikacja ręczna

- Wklejony URL (np. `https://kwestiasmaku.com/...`) → zachowanie identyczne jak przed zmianą.
- Wpisany tekst "tiramisu" + Enter → pojawia się panel z ≤5 wynikami.
- Wynik już istniejący w kolekcji usera → badge "Już zapisany".
- Klik Zapisz przy wyniku → przepis ląduje w kolekcji, przekierowanie jak po normalnym dodaniu.
- Symulowany błąd Exa (np. tymczasowo zły klucz) → komunikat "Wyszukiwanie niedostępne — wklej link ręcznie".
- Brak wyników (query nie zwraca niczego) → pusta lista z komunikatem "Brak wyników".

---

## Strategia testowania

### Testy jednostkowe

- `search-via-exa-action.test.ts` — mock `fetch`: test happy path (5 wyników), test Exa HTTP error
  (zwraca `{ error }`), test alreadySaved flag (wynik już w bazie → `alreadySaved: true`).
- Detekcja URL vs query — czysta funkcja, jeśli wyodrębniona: `isUrl('https://...')` → true,
  `isUrl('tiramisu')` → false.

### Kroki testowania ręcznego

1. URL wklejony → istniejący flow bez regresji.
2. Tekst wpisany → Exa search → panel wyników.
3. Klik Zapisz → przepis w kolekcji.
4. Wynik już zapisany → badge widoczny.
5. Exa error → komunikat błędu + możliwość powrotu do URL input.

## Uwagi dotyczące migracji

Brak — zmiany są addytywne. Stary flow URL działa bez modyfikacji. Nie ma migracji Supabase.

## Wymagania wstępne przed startem

- `EXA_API_KEY` — uzyskać klucz z exa.ai (darmowe konto, 1000 req/mies).
- Dodać do `.env.local` i Cloudflare Dashboard (Workers secrets).

## Referencje

- Badania: `context/changes/discovery-via-exa/research.md`
- Notatka kierunkowa: `context/foundation/future-recipe-web-search.md`
- Wzorzec env vars: `src/lib/env.ts` (istniejące required vars)
- Wzorzec server action: `src/app/(authenticated)/recipes/add-recipe-action.ts`
- Wzorzec Supabase server client: `src/lib/supabase/server.ts`

---

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany.

### Faza 1: Infrastruktura Exa

#### Automatyczne

- [x] 1.1 `pnpm typecheck` przechodzi po dodaniu `EXA_API_KEY` do `env.ts` i `ExaSearchResponse` do server action
- [x] 1.2 `pnpm lint` przechodzi

#### Ręczne

- [ ] 1.3 Server action z query "tiramisu" zwraca ≤5 wyników z `url`, `title`, `alreadySaved`
- [ ] 1.4 Błędny klucz API zwraca `{ error: ... }` bez uncaught exception
- [ ] 1.5 Brak `EXA_API_KEY` w `.env.local` — clear error message przy dev start

### Faza 2: UI — unified input i panel wyników

#### Automatyczne

- [x] 2.1 `pnpm typecheck` przechodzi po zmianach w `recipes-content.tsx`
- [x] 2.2 `pnpm lint` przechodzi

#### Ręczne

- [ ] 2.3 URL wklejony → stary flow bez regresji (dedup, redirect)
- [ ] 2.4 Tekst "tiramisu" + Enter → panel wyników pojawia się
- [ ] 2.5 Badge "Już zapisany" widoczny dla wyników istniejących w kolekcji
- [ ] 2.6 Klik Zapisz → przepis w kolekcji, redirect jak normalnie
- [ ] 2.7 Exa error → komunikat "Wyszukiwanie niedostępne" widoczny
- [ ] 2.8 Brak wyników → komunikat "Brak wyników" (nie pusta cisza)
