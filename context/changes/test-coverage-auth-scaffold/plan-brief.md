# Test coverage F-01 auth scaffold — Krótki plan

> Pełny plan: `context/changes/test-coverage-auth-scaffold/plan.md`
> F-01 archive: `context/archive/2026-05-28-auth-and-supabase-scaffold/` (po PR #7 merge)

## Co i dlaczego

Greenfield setup test infrastructure dla F-01 auth scaffold. Vitest (unit) + Playwright (1 e2e) z extraction private functions do lib/. Cel: cheap regression safety net dla pure logic (mapAuthError, regex, helpers) + deployment health smoke (jeden e2e przeciwko zapiszprzepis.pl). Motywacja: lesson #7 z `lessons.md` — Supabase allowlist drift hit 2× w F-01 deploy + Cloudflare migration; e2e test catches tę klasę bugów automatycznie.

## Punkt wyjścia

Greenfield test infrastructure: zero test runner, zero test files, zero CI, zero test deps. Tylko `scripts/check-auth.ts` smoke. F-01 auth scaffold deployed na production zapiszprzepis.pl (Cloudflare Workers, verified 2026-06-02). Pure logic obecnie inline lub private w `route.ts` / `actions.ts` — nie testable bez refactor.

## Pożądany stan końcowy

`pnpm test:run` zwraca exit 0 z 20+ unit test cases passing dla pure auth logic. `pnpm test:e2e` zwraca exit 0 z 1 happy path test przeciwko zapiszprzepis.pl. `src/lib/auth-errors.ts` i `src/lib/auth-validation.ts` zawierają extracted pure functions z named exports. README.md dokumentuje workflows + conventions.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego | Źródło |
|---|---|---|---|
| Test framework | Vitest (unit) + Playwright (1 e2e) | Cheap unit + jeden e2e wyłapuje deployment regressions (lesson #7) | Plan |
| Scope | Pure logic + 1 happy path e2e | Highest ROI; edges manualne per F-01 Phase 6 ritual | Plan |
| E2E target | Production zapiszprzepis.pl | Wyłapuje real deployment drift (allowlist, env vars, workerd) | Plan |
| Verification depth | Stop przy /login?sent=1 (no email click) | Pokrywa 80% deployment bugs bez email infrastructure complexity | Plan |
| CI integration | Local-only manual | MVP scale, lean; e2e prowadzony świadomie po deploy | Plan |
| File organization | Mixed: unit co-located, e2e w tests/e2e/ | Standard Next.js convention; separate Playwright config | Plan |
| Pure logic strategy | Extract to lib (refactor before testing) | Clean architecture; Next.js 16 ostrzega o non-route exports z route.ts | Plan |
| Future-proofing | Just F-01 (scope grows naturally) | YAGNI per MVP scale; configs reusable kiedy S-01 doda swoje testy | Plan |
| F2 lesson refactor | Out-of-scope (osobna zmiana) | Test lock current `.includes()` behavior; refactor jako future change | Plan |

## Zakres

**W zakresie:**
- Refactor: extract `mapAuthError`, email regex, SAFE_NEXT regex do `src/lib/auth-errors.ts` + `src/lib/auth-validation.ts`
- Vitest install + config + 3 unit test files (auth-errors, auth-validation, site-url) z 20+ test cases
- Playwright install + config + 1 e2e test (happy path stopping at /login?sent=1)
- `.gitignore` updates dla Playwright artifacts
- README.md `## Testing` section z workflows + conventions

**Poza zakresem:**
- F2 lesson refactor (`mapAuthError` na Set exact-equality)
- Integration tests (middleware, supabase clients)
- Edge case e2e (used link, no code, expired, cooldown)
- Email click + callback verification w e2e
- CI/CD (GitHub Actions, Workers Builds test hook)
- Test setup dla S-01..S-07 (organic growth)
- ERROR_MESSAGES map test (const, no logic)

## Architektura / Podejście

```
Phase 1 (refactor) → Phase 2 (Vitest) → Phase 3 (Playwright) → Phase 4 (docs)
       ↓                  ↓                    ↓                    ↓
  extract pure logic   unit tests          e2e happy path      README ## Testing
  do src/lib/          ~20 cases           prod URL target     conventions
  (no behavior change) (mock next/headers) (timestamp emails)  pre-deploy ritual
```

Test runtime stack:
- **Unit (Vitest)**: Node runtime, jsdom NOT needed (server-side pure functions), `@/` alias from src/
- **E2E (Playwright)**: Chromium headless, baseURL=zapiszprzepis.pl, no auto-serve (production target)
- Both: local execution only, exit codes dla manual verification

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Refactor extraction | `src/lib/auth-errors.ts` + `src/lib/auth-validation.ts` z imports wired w route.ts i actions.ts | Build/lint break od import order — verify via `pnpm build` przed Phase 2 |
| 2. Vitest setup + unit tests | vitest.config.ts + 3 test files (~20 cases) all pass | Test for current `.includes()` behavior, NOT idealized — F2 refactor wartowy ale out-of-scope |
| 3. Playwright + 1 e2e | playwright.config.ts + tests/e2e/auth-magic-link.spec.ts pass | Production URL fragility (Supabase rate limit, prod outage); unique timestamp emails per run |
| 4. Docs update | README.md `## Testing` section + opcjonalnie lessons.md rule #7 cross-ref | Brak — pure docs |

**Wymagania wstępne:**
- F-01 production deploy stable (✓ zweryfikowane 2026-06-02)
- Lokalny dev environment z Node 22 LTS, pnpm 10
- Internet connectivity dla Playwright browser download + e2e runs

**Szacowany nakład pracy:** ~3-4h total (~1h per phase × 3 + 30min docs).

## Otwarte ryzyka i założenia

- **Production URL test fragility** — `pnpm test:e2e` zależy od zapiszprzepis.pl health + internet. Failures mogą być spowodowane prod outage lub Supabase rate limit. Akceptowalne dla 1-user MVP.
- **Supabase rate limit przy częstym e2e** — unique timestamp emails mitygują, ale OTP send rate limit per IP (~60s cooldown) możliwy. Discipline: nie biegaj e2e w pętli.
- **F2 lesson out-of-scope** — `mapAuthError` zostaje z `.includes()`. Tests lock current behavior; future refactor jako osobna zmiana.
- **m3l2-ad-hoc-testing.md uszkodzony** — lesson prompt nie usable jako research input (subagent confirmed YAML-only, no body). Plan polega na m3l4 + ad-hoc decisions zamiast tej lekcji.
- **No CI** — broken tests mogą land na master bez catch. Akceptowalne dla solo dev; future S-01+ może chcieć GitHub Actions.

## Kryteria sukcesu (podsumowanie)

- `pnpm test:run` przechodzi czysto z 20+ unit test cases (pure logic regression coverage)
- `pnpm test:e2e` przechodzi czysto z 1 happy path test (deployment health smoke against zapiszprzepis.pl)
- Refactor (Phase 1) nie zepsuł nic — `pnpm build` zielony, magic-link auth flow nadal działa
- README dokumentuje workflows tak, że future contributor (lub agent) wie jak uruchomić testy bez pytania
