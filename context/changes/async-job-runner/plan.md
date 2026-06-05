# F-01 Trigger.dev async job runner — Plan implementacji

## Przegląd

Wprowadzić Trigger.dev jako runtime dla zadań asynchronicznych (1–3 min p95 per FR-003), żeby ekstrakcja przepisów w S-01..S-04 mogła odbywać się poza request-path Workera (10 ms CPU + ~30 s wall time). Dla F-01 budujemy minimalny end-to-end: jeden przykładowy task triggerowany z Server Action w Workersie, polling statusu przez Trigger.dev SDK, brak webhook callback, brak DB. Przy okazji centralizujemy odczyt env vars w `src/lib/env.ts` (lessons.md #6) — wzorzec wymagany dla każdej kolejnej integracji (OpenAI, Firecrawl, Whisper).

## Analiza stanu obecnego

- **Trigger.dev nieobecny**: `package.json` nie ma `@trigger.dev/*`, brak `trigger.config.ts`, brak katalogu `src/trigger/`.
- **Brak `src/lib/env.ts`**: `src/lib/supabase/server.ts:8-9` i `src/lib/supabase/proxy.ts` (→ `middleware.ts` po workaround #962) używają `process.env.NEXT_PUBLIC_SUPABASE_URL!` i `..._ANON_KEY!` — lessons.md #6 explicitly flaguje to jako tryb awarii.
- **Brak `src/app/api/`**: żadnego Route Handlera dotąd; Server Actions (`src/app/login/actions.ts`, `src/app/(actions)/sign-out.ts`) są jedynym istniejącym kanałem.
- **Workerd ograniczenia** (`context/foundation/infrastructure.md`): 10 ms CPU per invocation (free tier) + ~30 s HTTP wall time. Workers może *triggerować* task (lekki HTTP call do Trigger.dev API), ale nie może wykonywać 1–3 min logiki — F-01 udowadnia obejście.
- **Cost guardrail**: PRD NFR ≤ 10 zł/mc per użytkownik. Trigger.dev Cloud free tier: 5 000 runs/mc — ~50 przepisów/mc z PRD `target_scale.users: small` zmieści się 100× w limicie.
- **Roadmap niewiadome F-01** (`context/foundation/roadmap.md:78-80`): (a) workerd compat z Trigger.dev SDK, (b) webhook callback URL + secret pattern. Decyzja: (a) zostaje smoke testem fazy 2 (jeśli SDK się wyłoży, dowiemy się lokalnie zanim deploy), (b) odpada w całości — wybieramy polling, nie webhook.
- **Lessons.md kluczowe dla tego zadania**:
  - #5 `AbortSignal.timeout` dla outbound `fetch` w background-job code — explicit "Trigger.dev" wymieniony.
  - #6 `src/lib/env.ts` centralizacja — wymieniony "Trigger.dev token, etc." jako naturalny moment wprowadzenia.
- **Test infrastructure**: Vitest + Playwright żyją (`vitest.config.ts`, `playwright.config.ts`); konwencja unit testów co-located w `src/lib/*.test.ts`.

## Pożądany stan końcowy

Po zakończeniu planu:

- `pnpm dev` + UI `/test-trigger` lokalnie: klik "Trigger" → otrzymujemy `runId` w <1 s → klik "Sprawdź status" za ~6 s → widzimy `completed` + `output` (status z httpbin + duration_ms).
- `https://zapiszprzepis.pl/test-trigger` (production) wykonuje ten sam flow — Trigger.dev dashboard pokazuje uruchomienie, structured logs Workers (`wrangler tail`) korelują z `runId`.
- `src/lib/env.ts` istnieje, eksportuje walidowane stałe (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_ID`); import w `server.ts`, `middleware.ts`, `check-auth.ts` zamiast `process.env.X!`.
- `vitest` pokrywa `src/lib/env.ts` (missing var throws z jasnym komunikatem, valid vars return).
- `README.md` ma sekcję `## Background jobs (Trigger.dev)` z setupem, polecaniami i linkiem do dashboard.
- F-01 status w roadmap.md: `ready` → `done` (po wszystkich fazach).

### Kluczowe odkrycia

- **Trigger.dev Cloud free tier** wystarcza: 5 000 runs/mc + 50 GB egress; per PRD target ~50 przepisów/mc = 1% wykorzystania.
- **Polling vs webhook**: wybór polling (Q2) eliminuje publiczny endpoint `/api/jobs/callback`, brak webhook secret rotation, brak HMAC. Per FR-003 "mama wraca do aplikacji po 1-3 minutach" — push i tak by jej nie pomógł.
- **`@trigger.dev/sdk` v3** używa Node.js + ESM; Server Actions w Next.js 16 App Router runują na Node po stronie serwera per `@opennextjs/cloudflare` adapter — SDK powinien działać bez `compatibility_flags` zmian (do potwierdzenia w fazie 2 smoke).
- **Webhook callback i tabela `jobs` są poza zakresem** (wynikają z architektury polling + brak DB); S-01 doda `recipes.trigger_run_id` jako persistence layer.

## Czego NIE robimy

- **Webhook callback endpoint** (`/api/jobs/callback`) — polling przez `runs.retrieve` SDK; jeśli kiedyś push będzie potrzebny, osobna zmiana.
- **Tabela `jobs` w Supabase** — runId trzymany w client state (Server Action zwraca, klient renderuje); w S-01 dodaje się `recipes.trigger_run_id`.
- **Dead-letter / error UX dla failed tasks** — S-07 (error-ux-and-author-alerts) jest dedicated do tego per roadmap.
- **CI/CD integration** — `npx trigger.dev deploy` uruchamiamy lokalnie; GitHub Actions wjedzie później jeśli będzie potrzebny.
- **OpenTelemetry / paid observability backend** — świadoma decyzja per `infrastructure.md` risk register; structured `console.log` + dashboard Trigger.dev + `wrangler tail` z `runId` korelacją wystarczają dla 1-user MVP.
- **Real-time UI updates (Supabase Realtime)** — pollingowy "Sprawdź status" przycisk wystarcza; FR-010 (placeholder „Zapisuję…") jest nice-to-have, nie F-01.
- **Production logic taska (scraping, LLM)** — to S-01. Przykładowy task w F-01 to czysty smoke (outbound fetch + sleep) bez logiki przepisów.

## Podejście do implementacji

Trzy fazy w kolejności ryzyka i blast radius:

1. **Faza 1 (refactor zerowy behavior change)**: wprowadzić `src/lib/env.ts`, zmigrować istniejące `SUPABASE_*` importerów. Najpierw — bo dotyka istniejącego F-01 auth scaffold i musi przejść `pnpm build` + magic-link manualny smoke ZANIM dodamy Trigger.dev. Jeśli coś się zepsuje, odkryjemy to bez nowych zależności.
2. **Faza 2 (Trigger.dev + przykładowy task + lokalny smoke)**: install SDK + projekt na Trigger.dev Cloud + `trigger.config.ts` + `src/trigger/example.ts` + 2 Server Actions + test page `/test-trigger`. Smoke z `pnpm dev` — jeśli SDK nie działa z Next.js 16, dowiemy się TU, bez deploy.
3. **Faza 3 (production deploy + testy + dokumentacja)**: `trigger.dev deploy` + `pnpm deploy` Workersa + production smoke + Vitest dla `lib/env.ts` + README.

**Decyzja: refactor env PRZED Trigger.dev** — alternatywą byłoby dodać `TRIGGER_*` bezpośrednio (zostawiając `SUPABASE_*` z `!`), ale wtedy nigdy bez bólu nie wrócimy do refaktoru auth. Lessons.md #6 mówi explicitly "Apply the same pattern to any new third-party integration" — natural moment jest TERAZ.

**Decyzja: polling zamiast webhook** — patrz "Kluczowe odkrycia". Plus: zero publicznej powierzchni ataku, prostszy security model, brak secret rotation.

**Decyzja: production smoke jako jedyna definicja done** — workerd compat ujawni się na produkcji najpełniej; lokalny `pnpm dev` używa Node runtime, NIE workerd (per `infrastructure.md` Nieznane niewiadome #1). Ufamy fazie 2 lokalnemu smoke jako sygnałowi *czy SDK w ogóle działa*, ale prawdziwy test to faza 3 deploy.

## Krytyczne szczegóły implementacji

- **`@opennextjs/cloudflare` a Trigger.dev SDK**: SDK używa ESM i `fetch` (Web standard); Workers fetch jest dostępny natywnie. Jeśli okaże się że SDK importuje `node:fs` lub inne Node-only modules przy bundlu, alternatywą jest wywołanie Trigger.dev REST API (`POST https://api.trigger.dev/api/v1/tasks/example/trigger`) zamiast SDK. Decyzja jeśli się tak stanie: zostań przy REST API, nie używaj SDK — to jest właśnie powód dla którego F-01 *najpierw* robi local smoke.
- **Kolejność: `npx trigger.dev login` lokalnie** musi nastąpić zanim cokolwiek innego (faza 2). Bez zalogowanego CLI nie zaprojektujemy `trigger.config.ts` poprawnie (potrzebne project ref). To ręczny krok, nie automatyzowany.
- **Server-only `lib/env.ts` + client.ts exception**: Next.js inline'uje `process.env.NEXT_PUBLIC_*` w client bundle TYLKO dla LITERALNYCH dostępów (`process.env.NEXT_PUBLIC_X`). Dynamic `requireEnv(name)` z string variable nie podlega inline. Stąd `lib/env.ts` jest świadomie server-only (`import 'server-only'` na top), a `src/lib/supabase/client.ts` (kod browserowy) zostaje z literalnymi `process.env.NEXT_PUBLIC_*!` i NIE jest migrowany. Inny wzorzec spowodowałby crash strony logowania.

---

## Faza 1: `src/lib/env.ts` — centralizacja walidacji env vars

### Przegląd

Utworzyć moduł, który waliduje wymagane env vary na module-load i throw'uje z czytelnym komunikatem. Zmigrować trzy istniejących importerów `SUPABASE_*` (server.ts, middleware.ts, check-auth.ts). Behavior bez zmian — magic-link auth musi działać identycznie po fazie.

### Wymagane zmiany

#### 1. Utwórz `src/lib/env.ts`

**Plik**: `src/lib/env.ts` (nowy)

**Cel**: Pojedyncza prawda dla wymaganych env vars. Throw na module-load jeśli któryś brakuje. Eksportować jako stałe (nie funkcje) żeby TypeScript widział typ `string`, nie `string | undefined`.

**Kontrakt**:
- **Pierwsza linia pliku: `import 'server-only'`** — oficjalny Next.js wzorzec, rzuca przy build jeśli ktoś zaimportuje moduł w client component. Ochrona przed regresją server/client mix.
- Named exports (string): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL` (opcjonalne — `process.env.NEXT_PUBLIC_SITE_URL ?? undefined`)
- Wewnętrzny helper `requireEnv(name: string): string` rzuca `Error('Missing required env: ' + name)` przy `undefined` lub pustym stringu
- Plik czytany jest tylko po stronie server (Workers / Node) — bezpiecznie używać `process.env`
- `NEXT_PUBLIC_*` zostają jako `NEXT_PUBLIC_SUPABASE_URL` itp. w `requireEnv('NEXT_PUBLIC_SUPABASE_URL')` — wartość czyta serwer w runtime, walidacja przy module load

#### 2. Zmigrować `src/lib/supabase/server.ts`

**Plik**: `src/lib/supabase/server.ts`

**Cel**: Zastąpić `process.env.NEXT_PUBLIC_SUPABASE_URL!` i `..._ANON_KEY!` importami z `@/lib/env`.

**Kontrakt**:
- Add `import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'`
- Usuń non-null assertions na `process.env.NEXT_PUBLIC_SUPABASE_*`
- Per CLAUDE.md global rule: import + first usage w jednym Edit (Pint/ESLint by skasował unused import inaczej)

#### 3. Zmigrować `src/middleware.ts`

**Plik**: `src/middleware.ts`

**Cel**: To samo dla middleware (post-#962 workaround). Sprawdzić, gdzie dokładnie żyją odniesienia — mogą być w wewnętrznym pliku `src/lib/supabase/proxy.ts` zamiast samego `middleware.ts`.

**Kontrakt**:
- Znaleźć i zmigrować wszystkie `process.env.NEXT_PUBLIC_SUPABASE_*!` w `src/middleware.ts` lub `src/lib/supabase/proxy.ts` (zależnie od tego, gdzie są dziś)
- Import + first usage w jednym Edit

#### 4. NIE migrować `scripts/check-auth.ts` (świadoma decyzja, ustalone w implementacji)

**Plik**: `scripts/check-auth.ts` — **bez zmian**

**Cel**: Udokumentować dlaczego skrypt zostaje z własną walidacją.

**Kontrakt**:
- `scripts/check-auth.ts:5-12` JUŻ ma explicit walidację: `if (!url) { console.error('✗ Brak NEXT_PUBLIC_SUPABASE_URL...'); process.exit(1) }`. To dokładnie wzorzec, który lessons.md #6 zaleca — tylko zlokalizowany w jednym pliku zamiast w `lib/env.ts`. Nie ma `process.env.X!` non-null assertion, nie ma problemu który lessons.md adresuje.
- `scripts/check-auth.ts` jest uruchamiany przez `node --env-file=.env.local --import tsx scripts/check-auth.ts` — czysty Node bez Next.js bundlera. Pakiet `server-only` (od Fazy 1 / #1) ma conditional exports: `react-server` condition → empty.js (no-op); default → `throw new Error(...)`. Node nie ustawia `react-server` condition, więc import `@/lib/env` z `server-only` na top **wywaliłby skrypt przy module load** → kryterium 1.8 (`pnpm check:auth` exit 0) permanent fail.
- Skrypt zostaje jak jest. Reguła lessons.md #6 dotyczy app code (Server Components, middleware, Route Handlers), nie one-off Node scriptów ze świadomą lokalną walidacją.

#### 5. NIE migrować `src/lib/supabase/client.ts` (świadoma decyzja)

**Plik**: `src/lib/supabase/client.ts` — **bez zmian**

**Cel**: Udokumentować dlaczego ten plik ZOSTAJE z `process.env.NEXT_PUBLIC_SUPABASE_URL!` i `..._ANON_KEY!` literalami.

**Kontrakt**:
- `client.ts` jest client-side code (`createBrowserClient` → `createSupabaseBrowserClient()`), uruchamia się w przeglądarce.
- `lib/env.ts` ma `import 'server-only'` — import w client componencie błąd build.
- Next.js inline'uje `NEXT_PUBLIC_*` w client bundle TYLKO przy LITERALNYCH dostępach (`process.env.NEXT_PUBLIC_X`). Wzorzec `requireEnv('NEXT_PUBLIC_X')` z dynamicznym name parameter NIE jest inline'owany — w browser `process.env` nie istnieje → undefined → throw.
- Dodać krótki komentarz na top `client.ts` (~3 linie) wyjaśniający, dlaczego literal `process.env.NEXT_PUBLIC_*!` zostaje TYLKO tutaj:
  ```ts
  // client-side: Next.js inlines NEXT_PUBLIC_* at build time for literal access only.
  // Cannot route through server-only @/lib/env. See plan.md F1 (plan review 2026-06-04).
  ```

#### 6. Update `.env.local.example`

**Plik**: `.env.local.example`

**Cel**: Zaktualizować dokumentację wymaganych vars (jeśli sekcja jeszcze nie wymienia, dopisać; Trigger.dev wejdzie w fazie 2 — teraz tylko Supabase + SITE_URL).

**Kontrakt**:
- Pozostawić istniejące 3 var (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`) z komentarzami "(required)" / "(optional)"
- Dodać jednolinijkowy nagłówek: `# Validated at module load via src/lib/env.ts`

#### 7. Weryfikacja behavior unchanged

**Plik**: brak — verification

**Cel**: `pnpm build` + `pnpm exec tsc --noEmit` + `pnpm lint` zielone. Magic-link manualny smoke (otwórz `pnpm dev`, login formularz, wpisać email, otrzymać `/login?sent=1`) bez regresji.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `src/lib/env.ts` istnieje, eksportuje `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `src/lib/supabase/server.ts` importuje z `@/lib/env`, brak `process.env.NEXT_PUBLIC_SUPABASE_*!`
- `src/middleware.ts` (lub `src/lib/supabase/proxy.ts`) importuje z `@/lib/env`, brak `process.env.NEXT_PUBLIC_SUPABASE_*!`
- `scripts/check-auth.ts` importuje z `@/lib/env` (lub równoważne relative)
- `pnpm exec tsc --noEmit` exit 0
- `pnpm lint` exit 0
- `pnpm build` exit 0
- `pnpm check:auth` exit 0 (smoke pinguje Supabase auth/v1/health)
- Grep weryfikacja: brak `process.env.NEXT_PUBLIC_SUPABASE_URL!` w `src/**/*` POZA `src/lib/supabase/client.ts` (świadomie pozostawione literale, patrz Faza 1 / #5)

#### Weryfikacja ręczna

- `pnpm dev` → `http://localhost:3000/login` → wpisać email → submit → redirect na `/login?sent=1`, link magiczny w skrzynce wskazuje na `localhost:3000/auth/callback?code=...` (lokalna konfiguracja Supabase Site URL)

---

## Faza 2: Trigger.dev install + przykładowy task + lokalny smoke

### Przegląd

Założyć projekt na Trigger.dev Cloud, dodać SDK, zdefiniować `trigger.config.ts`, napisać przykładowy task, dwie Server Actions, prostą stronę testową. Lokalny smoke z `pnpm dev` — kluczowy sygnał czy SDK żyje z Workers-stylem builda Next.js 16.

### Wymagane zmiany

#### 1. Setup konta Trigger.dev (ręczny krok)

**Plik**: brak — setup

**Cel**: Utworzyć account/organization na Trigger.dev Cloud, projekt o nazwie `zapiszprzepis`, pobrać `TRIGGER_SECRET_KEY` (dev env) i `TRIGGER_PROJECT_ID`. Zalogować CLI lokalnie.

**Kontrakt**:
- Konto utworzone na https://cloud.trigger.dev (free tier)
- Projekt `zapiszprzepis` utworzony, project ref skopiowany
- `npx trigger.dev@latest login` zakończony sukcesem (tworzy `~/.config/trigger/auth.json` lub równoważne)
- Sekrety zapisane w `.env.local` (NIE w `.env.local.example` — tam tylko nazwa var)

#### 2. Install Trigger.dev SDK

**Plik**: `package.json`

**Cel**: Dodać runtime SDK + CLI dev tool.

**Kontrakt**:
- `pnpm add @trigger.dev/sdk` (najnowsza stabilna v3)
- `pnpm add -D @trigger.dev/cli` (lub używać `npx trigger.dev` per docs — decyzja w trakcie install)
- `pnpm-lock.yaml` zaktualizowany

#### 3. Utwórz `trigger.config.ts`

**Plik**: `trigger.config.ts` (root)

**Cel**: Konfiguracja Trigger.dev — projekt, runtime, katalogi z taskami.

**Kontrakt**:
- `project: "<TRIGGER_PROJECT_ID z .env.local>"`
- `runtime: "node"`
- `dirs: ["./src/trigger"]`
- `maxDuration: 300` (5 min — z marginesem nad PRD p95 3 min)
- `retries: { default: { maxAttempts: 3 } }` (default; per-task może override)

#### 4. Rozszerz `src/lib/env.ts` o Trigger.dev vars

**Plik**: `src/lib/env.ts`

**Cel**: Dodać `TRIGGER_SECRET_KEY` (required dla Server Action triggering) jako walidowany export. `TRIGGER_PROJECT_ID` typowo ląduje w `trigger.config.ts` jako literal (Trigger.dev tak rekomenduje), więc niekoniecznie w env.ts.

**Kontrakt**:
- Add `export const TRIGGER_SECRET_KEY = requireEnv('TRIGGER_SECRET_KEY')`
- Per CLAUDE.md: import + first usage w jednym Edit (z fazą 2.6 Server Action)

#### 5. Utwórz `src/trigger/example.ts`

**Plik**: `src/trigger/example.ts` (nowy)

**Cel**: Przykładowy task dowodzący async + outbound fetch. Sleep 5s + fetch do publicznego endpointu (primary + fallback dla odporności na padający third-party) + structured logs z `runId`.

**Kontrakt**:
- Export `exampleTask = task({ id: 'example', retry: { maxAttempts: 3 }, run: async (payload, { ctx }) => { ... } })`
- `payload` typ: `{ url?: string }` (default primary)
- Stałe na top modułu:
  - `const PRIMARY_URL = 'https://httpbin.org/anything'`
  - `const FALLBACK_URL = 'https://api.github.com/zen'` (krótki tekst, zawsze online, bez auth)
- Struktura `run`:
  1. `console.log(JSON.stringify({ event: 'task.started', runId: ctx.run.id, payload }))`
  2. `await new Promise(r => setTimeout(r, 5000))` (sleep)
  3. Helper `tryFetch(url)`: `fetch(url, { signal: AbortSignal.timeout(10_000) })` — per lessons.md #5
  4. Próba primary URL; na catch (timeout, network) → log warning + próba FALLBACK_URL
  5. Returns `{ status: res.status, bytes: <body length>, source: 'primary' | 'fallback', triggered_at, completed_at, duration_ms }`
  6. `console.log(JSON.stringify({ event: 'task.completed', runId: ctx.run.id, status: res.status, source, duration_ms }))`

#### 6. Server Action `triggerExample`

**Plik**: `src/app/(actions)/trigger-example.ts` (nowy)

**Cel**: Server Action, którą wywołuje UI test page; triggeruje task przez Trigger.dev SDK, zwraca `runId` do clienta.

**Kontrakt**:
- `'use server'` na top
- `import { tasks } from '@trigger.dev/sdk/v3'` + import `TRIGGER_SECRET_KEY` (lub auto z env)
- `import type { exampleTask } from '@/trigger/example'` (typowanie payload + return)
- Export `triggerExample(): Promise<{ runId: string }>`
- Wewnątrz: `const handle = await tasks.trigger<typeof exampleTask>('example', {})` + `console.log({ event: 'trigger.dispatched', runId: handle.id })` + `return { runId: handle.id }`
- Brak DB write — runId zwracany przez API, client trzyma w stanie

#### 7. Server Action `getExampleStatus`

**Plik**: `src/app/(actions)/get-example-status.ts` (nowy)

**Cel**: Server Action pyta Trigger.dev SDK o status `runId`.

**Kontrakt**:
- `'use server'`
- `import { runs } from '@trigger.dev/sdk/v3'`
- Export `getExampleStatus(runId: string): Promise<{ status: string, output?: unknown, error?: string }>`
- `const run = await runs.retrieve(runId)` + zwróć `{ status: run.status, output: run.output, error: run.error?.message }`
- `console.log({ event: 'status.checked', runId, status: run.status })`

#### 8a. Middleware bypass dla `/test-trigger`

**Plik**: `src/middleware.ts`

**Cel**: `/test-trigger` ma być dostępne bez logowania (dev page; mama nie jest beneficjentem F-01). Bez bypass'u nielogowany użytkownik dostaje redirect na `/login` per `middleware.ts:22-24`.

**Kontrakt**:
- Dodać explicit bypass W FUNKCJI `middleware()` (NIE w regex `config.matcher` — regex byłby brittle), w stylu istniejącego bypass'u `/auth/callback` z linii 10-12:
  ```ts
  // DELETE w S-01 (replace przez real share-target flow). Faza 2 F-01 dev page.
  if (pathname.startsWith('/test-trigger')) {
    return response
  }
  ```
- Umieszczenie: PRZED regułą `if (pathname === '/login' || ...)` (linia 15) — czyli dokładnie po bypass'u `/auth/callback`.
- Per CLAUDE.md global rule: edit musi być pojedynczy (dodaje tylko 3 linie + komentarz, nic nie usuwa).

#### 8b. Test page `/test-trigger`

**Plik**: `src/app/test-trigger/page.tsx` (nowy)

**Cel**: Prosty UI — 2 przyciski (Trigger / Sprawdź status), wyświetla `runId` + ostatni status. Bez stylowania poza Tailwind klasami; to dev-only page.

**Kontrakt**:
- Client Component (`'use client'`)
- `useState<{ runId: string | null, status: string | null, output: unknown | null }>`
- Button "Triggeruj task" wywołuje `triggerExample()` jako Server Action, setuje `runId`
- Button "Sprawdź status" wywołuje `getExampleStatus(runId)`, setuje `status` + `output`
- Renderuje `<pre>{JSON.stringify(state, null, 2)}</pre>` poniżej
- **Uwaga**: strona musi zostać dostępna BEZ autentykacji w middleware — dodać `/test-trigger` do public paths matcher (lub komentarz "DELETE w S-01 po replace przez prawdziwy share-target flow")

#### 9. Update `.env.local.example`

**Plik**: `.env.local.example`

**Cel**: Dodać dokumentację `TRIGGER_SECRET_KEY` i `TRIGGER_PROJECT_ID` (oba required).

**Kontrakt**:
- Sekcja `# Trigger.dev (required for F-01 async jobs)`
- `TRIGGER_SECRET_KEY=tr_dev_xxxxxxxxxxxx` (placeholder pokazujący format)
- `TRIGGER_PROJECT_ID=proj_xxxxxxxxxxxx`

#### 10. Lokalny smoke z `pnpm dev`

**Plik**: brak — verification

**Kontrakt**:
- `pnpm dev` startuje bez błędów
- W osobnym terminalu: `npx trigger.dev@latest dev` (lub `pnpm trigger:dev` jeśli dodamy script — opcjonalne)
- Wizyta `http://localhost:3000/test-trigger`
- Klik "Triggeruj" → w <1 s widać `runId` w UI; w dashboard Trigger.dev pojawia się run
- Czekamy ~6 s; klik "Sprawdź status" → widać `status: completed`, `output.status: 200` (httpbin OK)
- Logi: `pnpm dev` console pokazuje `event: trigger.dispatched`; `trigger.dev dev` console pokazuje `event: task.started/completed`; ID `runId` korelują

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `package.json` zawiera `@trigger.dev/sdk`
- `trigger.config.ts` istnieje i przechodzi `pnpm exec tsc --noEmit`
- `src/trigger/example.ts` istnieje, eksportuje `exampleTask`
- `src/app/(actions)/trigger-example.ts` i `src/app/(actions)/get-example-status.ts` istnieją
- `src/app/test-trigger/page.tsx` istnieje
- `src/lib/env.ts` eksportuje `TRIGGER_SECRET_KEY`
- `.env.local.example` zawiera komentarze `TRIGGER_SECRET_KEY` i `TRIGGER_PROJECT_ID`
- `pnpm exec tsc --noEmit` exit 0
- `pnpm lint` exit 0
- `pnpm build` exit 0
- Grep: `src/trigger/example.ts` zawiera `AbortSignal.timeout` (lessons.md #5 compliance)
- `src/middleware.ts` zawiera explicit bypass `if (pathname.startsWith('/test-trigger'))` z komentarzem `DELETE w S-01` (lub strona ładuje się bez auth redirect)

#### Weryfikacja ręczna

- `pnpm dev` + `npx trigger.dev dev` — oba startują bez błędów
- `http://localhost:3000/test-trigger` ładuje się bez 302 do `/login`
- Klik "Triggeruj task" → `runId` widoczny w UI w <1 s; jednoczesny wpis w Trigger.dev dashboard
- Klik "Sprawdź status" po ~6 s → `status: completed`, `output.status: 200`
- Console `pnpm dev`: log `event: trigger.dispatched` z `runId`
- Console `trigger.dev dev`: log `event: task.started` + `event: task.completed` z tym samym `runId`
- `runId` jest tym samym stringiem w 3 miejscach (Server Action log, task log, dashboard URL)

---

## Faza 3: Production deploy + Vitest + dokumentacja

### Przegląd

Wdrożyć Trigger.dev tasks na production environment Trigger.dev Cloud, zdeployować nową wersję Workersa, zweryfikować production smoke z `https://zapiszprzepis.pl/test-trigger`. Dodać Vitest dla `lib/env.ts`. Udokumentować workflow w README.

### Wymagane zmiany

#### 1. Trigger.dev production deploy

**Plik**: brak — deploy command

**Cel**: Wgranie tasków z `src/trigger/` do production env Trigger.dev. Pobranie production `TRIGGER_SECRET_KEY`.

**Kontrakt**:
- Na dashboard Trigger.dev: utworzyć "production" environment, skopiować production `TRIGGER_SECRET_KEY` (różni się od dev key)
- Lokalnie: `npx trigger.dev@latest deploy --env prod`
- Verify: w dashboard, environment "Production", task `example` widoczny, version > 0

#### 2. Dodać `TRIGGER_SECRET_KEY` do Workers env (runtime + build)

**Plik**: Cloudflare Workers dashboard (manual, dokumentowane w README)

**Cel**: Zgodnie z `infrastructure.md` krok #4: env vary w 2 scope (Build + Runtime). `TRIGGER_SECRET_KEY` musi być w obu (Server Action runuje w runtime; build potrzebuje go jeśli używamy `next.config` static check — bezpieczniej duplikować).

**Kontrakt**:
- Settings → Variables and Secrets: `TRIGGER_SECRET_KEY` = `<production key>` jako **Secret** (NIE Variable, NIE Build var)
- **Build scope NIE jest potrzebny** — `TRIGGER_SECRET_KEY` jest server-only secret używany w Server Action runtime, nie inline'owany w build. Per `infrastructure.md` krok #4: "Build variables will not be accessible at runtime" — Build scope służy tylko do inline'owania `NEXT_PUBLIC_*` przy build. Jeśli `pnpm exec opennextjs-cloudflare build` poskarży się na brak `TRIGGER_SECRET_KEY` przy build, to symptom innego błędu (najprawdopodobniej top-level access poza Server Action lub server-only validation czytanego w build optymalizacjach) — NIE rozwiązywać przez dodanie Build var.

#### 3. Workers deploy

**Plik**: brak — deploy command

**Cel**: Wgranie zaktualizowanego kodu Workersa (z `src/trigger/`, Server Actions, test page) na produkcję.

**Kontrakt**:
- `pnpm deploy` (per `package.json` scripts: `opennextjs-cloudflare build && opennextjs-cloudflare deploy`)
- LUB: push do master branch — Workers Builds automatycznie deployuje
- Verify deploy: `wrangler tail --status error --format json` przez 30 s, brak nowych błędów

#### 4. Production smoke

**Plik**: brak — verification

**Kontrakt**:
- `https://zapiszprzepis.pl/test-trigger` ładuje się (publiczna ścieżka per matcher z fazy 2)
- Klik "Triggeruj task" → `runId` widoczny w <1 s
- Wizyta dashboard Trigger.dev → environment Production → run pojawia się
- Klik "Sprawdź status" po ~6-8 s → `status: completed`, `output.status: 200`
- `wrangler tail` w drugim oknie pokazuje `event: trigger.dispatched` z tym samym `runId` co dashboard

#### 5. Vitest test dla `src/lib/env.ts`

**Plik**: `src/lib/env.test.ts` (nowy, co-located per istniejąca konwencja)

**Cel**: Pokrycie kontraktu walidacji — missing var rzuca z jasnym komunikatem, valid vary nie rzucają.

**Kontrakt**:
- ~4-6 test cases:
  - Helper `requireEnv` (jeśli wyeksportowany) z valid input → zwraca string
  - `requireEnv` z `undefined` → rzuca `Error` z komunikatem zawierającym nazwę var
  - `requireEnv` z empty string `''` → rzuca
  - Test module-level imports: vi.stubEnv z valid env → import success; vi.stubEnv z brakującym → throws at import
- **Uwaga**: testy module-load wymagają dynamic import + `vi.resetModules()`. Per Vitest docs, użyć `await import('./env')` w `try/catch`.

#### 6. README sekcja Background jobs

**Plik**: `README.md`

**Cel**: Dokumentacja nowego workflow — setup, lokalny dev, production deploy, dashboard.

**Kontrakt**:
- Sekcja `## Background jobs (Trigger.dev)` po `## Testing`, przed `## Deployment`
- Podsekcja "Setup": link do dashboard, jak uzyskać `TRIGGER_SECRET_KEY` + `TRIGGER_PROJECT_ID`, gdzie wpisać (`.env.local`, Workers dashboard)
- Podsekcja "Local development": `pnpm dev` + `npx trigger.dev dev` w drugim terminalu, link do `/test-trigger`
- Podsekcja "Production deployment": `npx trigger.dev deploy --env prod`, potem `pnpm deploy` (Workers); jeśli Trigger.dev środowiska divergują od kodu Workersa, deploy out-of-sync ostrzeżenie
- Podsekcja "Troubleshooting": link do dashboard, `wrangler tail` dla korelacji `runId`, gdzie szukać logów strukturalnych

#### 7. Update roadmap.md status F-01

**Plik**: `context/foundation/roadmap.md`

**Cel**: Status F-01 `ready` → `done` (na końcu fazy 3, po pomyślnym smoke).

**Kontrakt**:
- W tabeli "W skrócie": status F-01 zmienić na `done`
- W sekcji `## Fundamenty` → `### F-01`: status zmienić na `done`
- Opcjonalnie: dodać commit SHA jako referencję w `Done` section (jeśli istnieje)

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `src/lib/env.test.ts` istnieje z 4+ test cases
- `pnpm test:run` exit 0, env.test.ts cases pass
- `pnpm exec tsc --noEmit` exit 0
- `pnpm lint` exit 0
- `pnpm build` exit 0
- `README.md` zawiera sekcję `## Background jobs (Trigger.dev)`
- `context/foundation/roadmap.md` F-01 status to `done`

#### Weryfikacja ręczna

- Production smoke: `https://zapiszprzepis.pl/test-trigger` flow działa end-to-end
- Trigger.dev dashboard environment "Production" pokazuje task `example` + completed run
- `wrangler tail` koreluje `runId` z dashboard
- README rendered na GitHub jest czytelny, troubleshooting section ma użyteczne komendy
- Magic-link auth (`https://zapiszprzepis.pl/login`) nadal działa — F-01 refactor nic nie zepsuł

---

## Strategia testowania

### Testy jednostkowe

- `src/lib/env.test.ts`: walidacja behavior (missing, empty, valid). Pure logic, no I/O.

### Testy integracyjne

Brak dedykowanych — manual smoke (lokalny + production) pokrywa integracje SDK + dashboard + Workers.

### Kroki testowania ręcznego

1. **Po Fazie 1**: `pnpm dev` → `/login` → wpisać email → submit → `/login?sent=1` (potwierdza że refactor env nic nie zepsuł)
2. **Po Fazie 2**: `pnpm dev` + `npx trigger.dev dev` w drugim oknie → `/test-trigger` → klik "Triggeruj" → klik "Sprawdź status" po 6 s → `completed`
3. **Po Fazie 3**: ten sam flow na `https://zapiszprzepis.pl/test-trigger` z production dashboard

## Uwagi dotyczące wydajności

- Server Action `triggerExample` — Workers CPU <10 ms (jedno HTTP call do Trigger.dev API). Per `infrastructure.md` analysis ✓
- Przykładowy task sam: 5 s sleep + 1 outbound HTTP — całość mieści się w `maxDuration: 300` z dużym marginesem
- Trigger.dev SDK dla Server Action: brak persistent connection, każde wywołanie to nowa POST do `api.trigger.dev` — kompatybilne z workerd model

## Uwagi dotyczące migracji

- Faza 1 jest behavior-preserving refaktorem; po commicie istniejący kod auth musi działać identycznie.
- F-01 nie ma migracji DB.
- W S-01 dodajemy `recipes.trigger_run_id` jako migrację Supabase — F-01 nie blokuje.

## Otwarte ryzyka i założenia

- **Workerd compat `@trigger.dev/sdk` v3**: SDK używa ESM + Web `fetch`; jeśli importuje Node-only modules przy `pnpm build`, fallback to REST API call zamiast SDK (`POST https://api.trigger.dev/api/v1/...`). Decyzja wpadnie podczas fazy 2 — lokalny `pnpm build` pokaże szybko.
- **`/test-trigger` jako publiczna ścieżka w MVP**: strona dev-only; po wdrożeniu S-01 (real share target flow) ZNIKA z repo. Notować jako TODO w S-01 plan.
- **Trigger.dev free tier limit**: 5 000 runs/mc; przy 1 użytkowniku z PRD (~50 przepisów/mc) mamy 100× margines. Gdy mama zacznie deletować + retriować w trakcie testów S-01, można podbić licznik — monitorować.
- **`TRIGGER_PROJECT_ID` w `trigger.config.ts` jako literal vs env**: Trigger.dev rekomenduje literal w config (deterministyczny build). Akceptujemy — `TRIGGER_SECRET_KEY` zostaje w env (jako sekret), `TRIGGER_PROJECT_ID` w configu.
- **Test page raw JSON UI**: `/test-trigger` renderuje `<pre>{JSON.stringify(state)}</pre>` — żadnych stanów loading/error wizualizacji. Świadoma decyzja dev-only; jeśli "Sprawdź status" klikniesz przed zakończeniem taska, zobaczysz `status: queued` lub `executing`. Wzorzec stanów loading wymyślimy w S-01 (real share-target flow z proper UX placeholdera per FR-010 nice-to-have).
- **Dual deploy ritual** (Trigger.dev `deploy` osobno od Workers `deploy`): łatwo zapomnieć o jednym z dwóch. README troubleshooting section adresuje, ale to ciągłe ryzyko regresji. Mitigation: pre-deploy checklist w README "Czy zmieniłeś plik w `src/trigger/`? → najpierw `npx trigger.dev deploy --env prod`, potem `pnpm deploy`".

## Referencje

- F-01 w roadmap: `context/foundation/roadmap.md:67-82`
- PRD FR-003 (async): `context/foundation/prd.md` (FR-003 + NFR p95 ≤ 3 min)
- Infrastructure decision: `context/foundation/infrastructure.md` (Workers limits, env var dual scope)
- Tech stack background-jobs decision: `context/foundation/tech-stack.md:29` ("Trigger.dev rather than Workers cron")
- Lessons #5 (AbortSignal.timeout for outbound fetch): `context/foundation/lessons.md:50-62`
- Lessons #6 (lib/env.ts centralization): `context/foundation/lessons.md:64-72`
- Existing extracted lib pattern: `src/lib/auth-errors.ts`, `src/lib/auth-validation.ts` (Fazy plan test-coverage-auth-scaffold)
- Trigger.dev docs: https://trigger.dev/docs
- Cloudflare Workers env vars dual scope: https://developers.cloudflare.com/workers/configuration/environment-variables/

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany. Nie zmieniaj nazw tytułów kroków. Patrz `references/progress-format.md`.

### Faza 1: `src/lib/env.ts` — centralizacja walidacji env vars

#### Automatyczne

- [x] 1.1 `src/lib/env.ts` istnieje, eksportuje `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- [x] 1.2 `src/lib/supabase/server.ts` importuje z `@/lib/env`, brak `process.env.NEXT_PUBLIC_SUPABASE_*!`
- [x] 1.3 `src/middleware.ts` (lub `src/lib/supabase/proxy.ts`) importuje z `@/lib/env`, brak `process.env.NEXT_PUBLIC_SUPABASE_*!`
- [x] 1.4 `scripts/check-auth.ts` zachowuje własną explicit walidację (świadomie nie migrowany — Node script niekompatybilny z `import 'server-only'`); brak `process.env.X!` w skrypcie
- [x] 1.5 `pnpm exec tsc --noEmit` exit 0
- [x] 1.6 `pnpm lint` exit 0
- [x] 1.7 `pnpm build` exit 0
- [x] 1.8 `pnpm check:auth` exit 0
- [x] 1.9 Grep weryfikacja: brak `process.env.NEXT_PUBLIC_SUPABASE_URL!` w `src/**/*` (poza `src/lib/supabase/client.ts` — świadomie pozostawione literale, patrz Faza 1 / #5)

#### Ręczne

- [x] 1.10 `pnpm dev` magic-link smoke: login formularz → `/login?sent=1`, link wskazuje na localhost

### Faza 2: Trigger.dev install + przykładowy task + lokalny smoke

#### Automatyczne

- [ ] 2.1 `package.json` zawiera `@trigger.dev/sdk`
- [ ] 2.2 `trigger.config.ts` istnieje i przechodzi `pnpm exec tsc --noEmit`
- [ ] 2.3 `src/trigger/example.ts` istnieje, eksportuje `exampleTask`
- [ ] 2.4 `src/app/(actions)/trigger-example.ts` i `src/app/(actions)/get-example-status.ts` istnieją
- [ ] 2.5 `src/app/test-trigger/page.tsx` istnieje
- [ ] 2.6 `src/lib/env.ts` eksportuje `TRIGGER_SECRET_KEY`
- [ ] 2.7 `.env.local.example` zawiera `TRIGGER_SECRET_KEY` i `TRIGGER_PROJECT_ID` komentarze
- [ ] 2.8 `pnpm exec tsc --noEmit` exit 0
- [ ] 2.9 `pnpm lint` exit 0
- [ ] 2.10 `pnpm build` exit 0
- [ ] 2.11 Grep: `src/trigger/example.ts` zawiera `AbortSignal.timeout`
- [ ] 2.12 Middleware matcher pomija `/test-trigger`

#### Ręczne

- [ ] 2.13 `pnpm dev` + `npx trigger.dev dev` — oba startują bez błędów
- [ ] 2.14 `http://localhost:3000/test-trigger` ładuje się bez 302 do `/login`
- [ ] 2.15 Klik "Triggeruj task" → `runId` widoczny w UI w <1 s
- [ ] 2.16 Klik "Sprawdź status" po ~6 s → `status: completed`, `output.status: 200`
- [ ] 2.17 `runId` koreluje w 3 logach (Server Action, task, dashboard)

### Faza 3: Production deploy + Vitest + dokumentacja

#### Automatyczne

- [ ] 3.1 `src/lib/env.test.ts` istnieje z 4+ test cases
- [ ] 3.2 `pnpm test:run` exit 0
- [ ] 3.3 `pnpm exec tsc --noEmit` exit 0
- [ ] 3.4 `pnpm lint` exit 0
- [ ] 3.5 `pnpm build` exit 0
- [ ] 3.6 `README.md` zawiera sekcję `## Background jobs (Trigger.dev)`
- [ ] 3.7 `context/foundation/roadmap.md` F-01 status to `done`

#### Ręczne

- [ ] 3.8 Production smoke: `https://zapiszprzepis.pl/test-trigger` flow działa end-to-end
- [ ] 3.9 Trigger.dev dashboard environment "Production" pokazuje task `example` + completed run
- [ ] 3.10 `wrangler tail` koreluje `runId` z dashboard
- [ ] 3.11 Magic-link auth na production nadal działa (regresja check)
