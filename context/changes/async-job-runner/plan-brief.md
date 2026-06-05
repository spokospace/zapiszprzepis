# F-01 Trigger.dev async job runner — Krótki plan

> Pełny plan: `context/changes/async-job-runner/plan.md`
> F-01 w roadmapie: `context/foundation/roadmap.md` (sekcja Fundamenty)

## Co i dlaczego

Wprowadzić Trigger.dev jako runtime dla zadań asynchronicznych (1–3 min p95 per FR-003) — Workers ma 10 ms CPU + ~30 s wall time, co nie pasuje do scrapingu/LLM ekstrakcji w S-01..S-04. F-01 udowadnia minimalny end-to-end (jeden task triggerowany z Workersa, polling statusu z SDK) ZANIM wjedzie prawdziwa logika przepisów. Przy okazji centralizujemy walidację env vars w `src/lib/env.ts` (lessons.md #6) jako wzorzec dla każdej kolejnej integracji.

## Punkt wyjścia

`@trigger.dev/*` nie zainstalowany, brak `trigger.config.ts`, brak katalogu `src/trigger/`, brak `src/app/api/` ani Server Actions dla jobów. `src/lib/env.ts` nie istnieje — `SUPABASE_URL/_ANON_KEY` są dziś czytane przez `process.env.X!` w 3 miejscach (`server.ts`, `middleware.ts`/`proxy.ts`, `check-auth.ts`). Workers production live na `https://zapiszprzepis.pl`, magic-link auth + test coverage (Vitest + Playwright) działają.

## Pożądany stan końcowy

Mama (i autor) odwiedza `https://zapiszprzepis.pl/test-trigger`, klika "Triggeruj task", w <1 s widzi `runId`; po ~6 s klika "Sprawdź status" i widzi `completed` z outputem z httpbin. Dashboard Trigger.dev pokazuje run, `wrangler tail` koreluje `runId` z logami Workers. `src/lib/env.ts` istnieje i jest jedynym źródłem prawdy dla 4 env vars (`SUPABASE_*` + `TRIGGER_SECRET_KEY`). README ma sekcję "Background jobs". F-01 status w roadmap.md: `done`.

## Kluczowe podjęte decyzje

| Decyzja                          | Wybór                                                                            | Dlaczego                                                                                                                | Źródło |
| --------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| Backend dla async jobs            | Trigger.dev Cloud (free tier)                                                     | PRD wskazuje Trigger.dev w tech-stack.md; free tier 5000 runs/mc = 100× margines dla 1-user MVP                          | Plan   |
| Komunikacja Trigger.dev → Workers | Polling przez SDK `runs.retrieve`                                                 | Zero publicznej powierzchni ataku, brak webhook secret rotation; pasuje do FR-003 "mama wraca do aplikacji"             | Plan   |
| Persistence dla runId             | Client state (brak DB w F-01)                                                     | F-01 to fundament; DB persistence wejdzie w S-01 jako `recipes.trigger_run_id`                                          | Plan   |
| Przykładowy task                  | Outbound fetch (httpbin) + sleep 5s + structured logs + `AbortSignal.timeout` | Dowodzi i async wykracza poza request-path, i outbound fetch działa (lessons.md #5 compliance)                          | Plan   |
| Retry policy                      | Explicit `maxAttempts: 3` w task definition                                       | Pattern widoczny w kodzie do skopiowania w S-01..S-04; nie polegamy na ukrytych default'ach platformy                   | Plan   |
| Observability                     | Dashboard Trigger.dev + structured `console.log` z `runId` (bez OTel backend)     | Per infrastructure.md "świadomie akceptuj brak retro logów dla MVP"; korelacja `runId` między dashboard a `wrangler tail` | Plan   |
| Definition of done                | Tylko production smoke (nie chaos test)                                           | Lokalny `pnpm dev` używa Node, nie workerd — production to jedyny prawdziwy test compat                                  | Plan   |
| `lib/env.ts` refactor             | TAK — w fazie 1, z migracją istniejących `SUPABASE_*`                             | Lessons.md #6 explicit "any new third-party integration"; natural moment, jeden refactor zamiast dwóch                   | Plan   |
| Test coverage                     | Manual smoke + Vitest dla `lib/env.ts` (pure logic)                              | Lean approach per CLAUDE.md test-coverage-auth-scaffold precedens                                                       | Plan   |

## Zakres

**W zakresie:**
- `src/lib/env.ts` + migracja `SUPABASE_*` w 3 plikach (server.ts, middleware.ts/proxy.ts, check-auth.ts)
- Install `@trigger.dev/sdk` v3 + `trigger.config.ts`
- `src/trigger/example.ts` — task z fetch + sleep + retry + structured logs
- 2 Server Actions: `triggerExample()` + `getExampleStatus(runId)`
- Test page `src/app/test-trigger/page.tsx` (dev-only, znika w S-01)
- Production deploy (Trigger.dev + Workers) + smoke
- Vitest dla `lib/env.ts`
- README sekcja "Background jobs (Trigger.dev)"

**Poza zakresem:**
- Webhook callback endpoint (`/api/jobs/callback`) — polling zamiast push
- Tabela `jobs` w Supabase — wejdzie w S-01 jako `recipes.trigger_run_id`
- Dead-letter / error UX — S-07 (error-ux-and-author-alerts)
- CI/CD integration deploy Trigger.dev tasks — lokalnie z mojej maszyny na razie
- OpenTelemetry / paid observability backend
- Real-time UI updates (Supabase Realtime) — polling button wystarcza
- Production logic taska (scraping, LLM) — to S-01

## Architektura / Podejście

```
[mama klik "Triggeruj"]
    ↓
[Client Component /test-trigger]
    ↓ (Server Action)
[triggerExample() w Workersie]
    ↓ HTTP POST do api.trigger.dev
[Trigger.dev Cloud uruchamia task]
    ↓ (5s sleep + fetch httpbin)
[Task completed, output zapisany w Trigger.dev]

[mama klik "Sprawdź status" po 6s]
    ↓
[getExampleStatus(runId) Server Action]
    ↓ HTTP GET runs.retrieve
[Trigger.dev zwraca { status, output }]
    ↓
[UI renderuje { status: completed, output: ... }]
```

Workers triggeruje (lekki HTTP call, <10 ms CPU) i polling'uje status — nigdy nie wykonuje logiki taska samodzielnie. Środowisko `dev` Trigger.dev używane lokalnie z `pnpm dev`; `prod` środowisko dla `https://zapiszprzepis.pl`.

## Fazy w skrócie

| Faza                                                            | Co dostarcza                                                                                       | Kluczowe ryzyko                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1. `lib/env.ts` refactor (zerowy behavior change)               | `src/lib/env.ts` + migracja 3 plików `SUPABASE_*`; magic-link nadal działa                         | Regresja auth (mitigowana manual smoke `/login` przed Fazą 2)                                  |
| 2. Trigger.dev install + przykładowy task + lokalny smoke       | Task + 2 Server Actions + test page; lokalnie `runId` koreluje z dashboard                          | Workerd compat SDK (jeśli się wyłoży, fallback to REST API call — patrz Krytyczne szczegóły) |
| 3. Production deploy + Vitest + dokumentacja                    | Task na production env, smoke na `zapiszprzepis.pl/test-trigger`, env.test.ts, README              | Dual deploy ritual (Trigger.dev deploy + Workers deploy) — mitygowane sekcją troubleshooting    |

**Wymagania wstępne:**
- F-01 auth scaffold + Cloudflare Workers migration zarchiwizowane (✓ zweryfikowane 2026-06-02)
- Konto na https://cloud.trigger.dev (free tier)
- Lokalna sesja `npx trigger.dev login`

**Szacowany nakład pracy:** ~3-5h total (~1h faza 1, ~2-3h faza 2 ze smoke, ~1h faza 3 z deploy + dokumentacją).

## Otwarte ryzyka i założenia

- **Workerd compat `@trigger.dev/sdk` v3** — jeśli SDK importuje Node-only modules przy bundle, fallback to REST API call (`POST https://api.trigger.dev/api/v1/...`). Decyzja wpadnie podczas fazy 2 lokalnego `pnpm build`.
- **`/test-trigger` jako publiczna ścieżka w MVP** — dev-only page; po S-01 (real share target flow) ZNIKA. Notować jako TODO w plan S-01.
- **Trigger.dev free tier limit 5000 runs/mc** — przy 1 użytkowniku z PRD margines 100×; monitorować podczas iteracji testów S-01.
- **`TRIGGER_PROJECT_ID` w `trigger.config.ts` jako literal** — Trigger.dev rekomenduje; nie żyje w env.ts. Tylko `TRIGGER_SECRET_KEY` (sekret) zostaje w env vars.
- **Dual deploy ritual** — łatwo zapomnieć o `npx trigger.dev deploy --env prod` osobno od `pnpm deploy`. README troubleshooting section adresuje, ale to ciągłe ryzyko regresji.

## Kryteria sukcesu (podsumowanie)

- `https://zapiszprzepis.pl/test-trigger` przechodzi end-to-end manual smoke (trigger → 6s → status completed)
- Magic-link auth nie ma regresji (Faza 1 refactor jest behavior-preserving)
- `src/lib/env.ts` jest jedynym miejscem czytającym `process.env.NEXT_PUBLIC_SUPABASE_*` i `TRIGGER_SECRET_KEY`; grep nie znajduje `process.env.NEXT_PUBLIC_SUPABASE_URL!` w `src/`
- README dokumentuje workflow tak, że ja (lub agent) za 2 tygodnie wie, jak triggerować task lokalnie + deployować zmiany Trigger.dev na produkcję
