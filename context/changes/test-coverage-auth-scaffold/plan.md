# Test coverage F-01 auth scaffold — Plan implementacji

## Przegląd

Greenfield setup test infrastructure dla F-01 auth scaffold: Vitest dla pure logic unit tests + Playwright dla jednego happy-path e2e przeciwko deployed production URL (zapiszprzepis.pl). Wszystkie testy wykonywane lokalnie (zero CI). Przed testowaniem wyodrębniamy private functions/regex z `route.ts` i `actions.ts` do `src/lib/` żeby były unit-testable.

## Analiza stanu obecnego

- **Greenfield test infrastructure**: zero test runner, zero test files, zero CI configs, zero test deps. Tylko `scripts/check-auth.ts` smoke (ping Supabase auth/v1/health).
- **F-01 auth surface** (zweryfikowany przez subagent inventory):
  - `src/middleware.ts` — request gate; redirect rules per pathname
  - `src/lib/supabase/{server,client,proxy}.ts` — 3 client factories (server, browser, middleware helper)
  - `src/app/login/page.tsx` — UI form + ERROR_MESSAGES map (const, no logic)
  - `src/app/login/actions.ts` — `signInWithEmail` Server Action; **inline email regex** `^[^\s@]+@[^\s@]+\.[^\s@]+$`
  - `src/app/auth/callback/route.ts` — Route Handler; **private functions**: `mapAuthError` (uses `.includes()`), `SAFE_NEXT` regex `^/(?!/)`
  - `src/app/(actions)/sign-out.ts` — Server Action
  - `src/lib/site-url.ts` — **already extracted** pure helper; `getSiteUrl()` logic with LAN IP detection
  - `src/app/page.tsx` — protected dashboard stub
- **Pure logic obecnie inline lub private** — nie eksportowane, nie testowalne bezpośrednio bez refactor.
- **Lessons.md** ma 7 reguł, kilka z F-01 review surface (F2 redirect validation, F3 LAN IPs, F4 mapAuthError exact-equality recommendation, F5 narrow catch, F7 Supabase allowlist drift).
- **Cloudflare Workers runtime** — production live on `zapiszprzepis.pl` (verified end-to-end 2026-06-02).
- **Project scale**: 1-user MVP (mama, Pixel 9, after-hours dev). Per CLAUDE.md, lean approach over comprehensive coverage.

## Pożądany stan końcowy

Po zakończeniu planu:

- `pnpm test` (watch) i `pnpm test:run` uruchamiają Vitest unit tests dla pure auth logic — wszystkie pass czysto, ~10-15 test cases pokrywających: mapAuthError mapping, email regex (valid/invalid), SAFE_NEXT regex (path-only blocking), getSiteUrl protocol/host logic.
- `pnpm test:e2e` uruchamia Playwright happy-path test przeciwko `https://zapiszprzepis.pl` — test passes when prod is healthy (lub jasno fails gdy regression: middleware broken, Supabase URL config drift, allowlist drift, Workers env vars drift).
- `src/lib/auth-errors.ts` i `src/lib/auth-validation.ts` istnieją z extracted pure functions (`mapAuthError`, email regex, SAFE_NEXT regex). `route.ts` i `actions.ts` importują z lib zamiast inline.
- `README.md` zawiera `## Testing` section z workflows + conventions.
- Konwencja test files: unit co-located (`src/lib/X.test.ts` obok `X.ts`), e2e w `tests/e2e/`.

### Kluczowe odkrycia

- **`src/lib/site-url.ts:1-12`** już jest extracted helper — nasz wzorzec dla Phase 1 extraction (auth-errors.ts i auth-validation.ts będą looked-like-this).
- **`src/app/auth/callback/route.ts:6-12`** zawiera `mapAuthError` używające `code.includes(...)` — F2 lesson w `lessons.md` zaleca `Set` exact-equality refactor, ale to **out-of-scope** tego planu (unit tests lock current behavior; refactor w przyszłej zmianie).
- **`src/app/login/actions.ts`** ma inline email regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` — extraction do `auth-validation.ts` umożliwi testing 8+ cases (valid `a@b.co`, invalid empty, missing @, missing TLD, whitespace, etc.).
- **`src/app/auth/callback/route.ts:4`** ma `SAFE_NEXT = /^\/(?!\/)/` — F2 lesson rule (`lessons.md`) flaguje znane bypassy (`/\evil.com` backslash, `/%2fevil.com` URL decode). Testy zlokują current behavior + obejmą znane edge cases.
- **F-01 PR #1-#4 + Phase 6 verification** — manual happy path był już zweryfikowany 2026-06-02. Playwright test ground-truths automatyczne tego flow + protects against future deployment drift.
- **Production URL** — `https://zapiszprzepis.pl` deployed via Workers Builds; subdomena `zapiszprzepis.szymon-spoko-space.workers.dev` jako fallback.

## Czego NIE robimy

- **F2 lesson refactor** — `mapAuthError` zostaje z `.includes()`; tests document current behavior. Refactor na `Set` exact-equality to osobna zmiana per `lessons.md` rule #2 jeśli kiedyś warta.
- **Integration tests** — brak unit + integration combo; tylko pure logic + 1 e2e. Middleware routing, cookie refresh, Supabase OTP rate limit pokryte manualną weryfikacją lub czysto e2e signal.
- **Edge case e2e** (used link, no code, expired, cooldown, invalid email) — manual verification zostaje per F-01 Phase 6. Tylko happy path zautomatyzowane.
- **Email click w e2e** — test kończy się przy `/login?sent=1` (po POST email). Magic link click nie weryfikowany (wymaga email service / Supabase admin / test users — heavy infrastructure, niski ROI dla 1-user MVP).
- **CI/CD integration** — local-only execution. Brak GitHub Actions, brak Workers Builds test hook.
- **Comprehensive coverage** — middleware.ts logic, supabase clients, Server Components — testowane indirectly przez 1 e2e + manual verification.
- **ERROR_MESSAGES map test** — to const z key→text, nie ma logiki; test by replikował dane.
- **Future-proofing dla S-01..S-07** — konfiguracje (vitest.config.ts, playwright.config.ts) są reusable, ale plan dedicated do F-01.

## Podejście do implementacji

Cztery fazy w kolejności zależności:

1. **Refactor extraction (Phase 1)**: wyciągnij pure logic z `route.ts` i `actions.ts` do `src/lib/auth-errors.ts` i `src/lib/auth-validation.ts`. Bez behavior change, tylko move + named exports + import updates. Verify `pnpm build` + `pnpm exec tsc --noEmit` pass.
2. **Vitest setup + unit tests (Phase 2)**: install deps + config + 3 test files (mapAuthError, email/SAFE_NEXT regex, getSiteUrl). Wszystkie test cases pass.
3. **Playwright setup + 1 e2e (Phase 3)**: install deps + config + happy path test stopping at `/login?sent=1`. Production URL target.
4. **Docs update (Phase 4)**: README.md `## Testing` section + brief plan-brief.md update reference.

**Decyzja: extraction PRZED test setup** — alternatywa to setup Vitest pierwszy + extraction inline; ale separation jako odrębne fazy = czyste commity (refactor commit + test setup commit) + Phase 1 verify (build pass) potwierdza no behavior regression przed dodaniem test layer.

**Decyzja: production URL dla e2e** — workers.dev byłby bezpieczniejszy testowo (no impact na prod users — jest 1 użytkownik, mama, która nie testuje równolegle), ale prod URL wyłapuje lesson #7 (Supabase Site URL drift) — dokładnie ta klasa bugów którą chcemy złapać. Trade-off accepted.

**Decyzja: stop przy `/login?sent=1`** — pełny happy path (include email click) wymaga real email + IMAP polling, Supabase admin API, lub test users feature — wszystkie heavy. Stopping at sent=1 pokrywa: Worker deploy, middleware, Supabase URL config, allowlist (Supabase rejects emailRedirectTo wcześniej, więc form fails redirect to sent=1).

---

## Faza 1: Refactor — extract pure logic to lib

### Przegląd

Wyciągnij private functions/regex z `src/app/auth/callback/route.ts` i `src/app/login/actions.ts` do dedicated lib files. Behavior bez zmian — tylko relocation + named exports + import wiring.

### Wymagane zmiany

#### 1. Utwórz `src/lib/auth-errors.ts`

**Plik**: `src/lib/auth-errors.ts` (nowy)

**Cel**: Eksportuj `mapAuthError` jako pure function, zachowując current `.includes()` behavior. Future F2 refactor jako osobna zmiana.

**Kontrakt**:
- Named export: `export function mapAuthError(code: string | undefined | null): string`
- Logic identical to current `src/app/auth/callback/route.ts:6-12` implementation
- Returns one of: `'expired'`, `'used'`, `'invalid'`, `'unknown'` (lub zgodnie z obecną implementacją)

#### 2. Utwórz `src/lib/auth-validation.ts`

**Plik**: `src/lib/auth-validation.ts` (nowy)

**Cel**: Eksportuj `EMAIL_REGEX` i `SAFE_NEXT_REGEX` jako named const exports + helper `isValidEmail(s)` i `isSafeNext(s)` predicates.

**Kontrakt**:
- `export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- `export const SAFE_NEXT_REGEX = /^\/(?!\/)/`
- `export function isValidEmail(email: string): boolean`
- `export function isSafeNext(next: string): boolean`

#### 3. Update `src/app/auth/callback/route.ts`

**Plik**: `src/app/auth/callback/route.ts`

**Cel**: Replace inline `mapAuthError` function i `SAFE_NEXT` regex z imports z `src/lib/auth-errors.ts` i `src/lib/auth-validation.ts`.

**Kontrakt**:
- Add import: `import { mapAuthError } from '@/lib/auth-errors'`
- Add import: `import { isSafeNext } from '@/lib/auth-validation'` (lub `SAFE_NEXT_REGEX`)
- Remove inline `mapAuthError` function definition + `SAFE_NEXT` regex const
- Update call site: `SAFE_NEXT.test(rawNext)` → `isSafeNext(rawNext)` (lub keep regex usage if cleaner)
- Per CLAUDE.md global rule: import + first usage w jednym Edit

#### 4. Update `src/app/login/actions.ts`

**Plik**: `src/app/login/actions.ts`

**Cel**: Replace inline email regex z import z `src/lib/auth-validation.ts`.

**Kontrakt**:
- Add import: `import { isValidEmail } from '@/lib/auth-validation'`
- Remove inline regex literal in validation check
- Replace `regex.test(email)` z `isValidEmail(email)`
- Per CLAUDE.md global rule: import + first usage w jednym Edit

#### 5. Verify no breakage

**Plik**: brak — verification

**Cel**: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` wszystkie zielone. Production behavior unchanged.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `src/lib/auth-errors.ts` istnieje, eksportuje `mapAuthError`
- `src/lib/auth-validation.ts` istnieje, eksportuje `EMAIL_REGEX`, `SAFE_NEXT_REGEX`, `isValidEmail`, `isSafeNext`
- `src/app/auth/callback/route.ts` importuje z `@/lib/auth-errors` i `@/lib/auth-validation`, NIE definiuje inline `mapAuthError` / `SAFE_NEXT`
- `src/app/login/actions.ts` importuje z `@/lib/auth-validation`, NIE ma inline email regex
- `pnpm exec tsc --noEmit` exit 0
- `pnpm lint` exit 0
- `pnpm build` exit 0
- Grep weryfikacja imports survived: `Grep "^import" w route.ts i actions.ts` zawiera nowe imports

#### Weryfikacja ręczna

- (brak — Phase 1 jest refactor; behavior unchanged, no manual flow needed)

---

## Faza 2: Vitest setup + unit tests

### Przegląd

Install Vitest + config + 3 test files dla extracted pure logic. Wszystkie testy pass.

### Wymagane zmiany

#### 1. Install Vitest

**Plik**: `package.json`

**Cel**: Add Vitest jako dev dep + scripts.

**Kontrakt**:
- `pnpm add -D vitest` (current latest)
- Add scripts:
  - `"test": "vitest"` (watch mode dla iteracji)
  - `"test:run": "vitest run"` (single run, exit code dla manualny CI)
- `pnpm-lock.yaml` zaktualizowany

#### 2. Utwórz `vitest.config.ts`

**Plik**: `vitest.config.ts` (nowy, root)

**Cel**: Vitest config — Node environment, exclude e2e + build dirs.

**Kontrakt**:
```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', '.next', '.open-next', 'tests/e2e/**'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
```

#### 3. Utwórz `src/lib/auth-errors.test.ts`

**Plik**: `src/lib/auth-errors.test.ts` (nowy, co-located)

**Cel**: Test `mapAuthError` dla każdej kategorii return value + default fallback.

**Kontrakt**:
- ~6-8 test cases: known codes (otp_expired, flow_state_expired, flow_state_not_found, used codes, invalid codes) + unknown fallback + null/undefined handling
- Document F2 lesson note w comment: tests lock current `.includes()` behavior; future refactor jako osobna zmiana

#### 4. Utwórz `src/lib/auth-validation.test.ts`

**Plik**: `src/lib/auth-validation.test.ts` (nowy, co-located)

**Cel**: Test email regex + SAFE_NEXT regex valid/invalid forms.

**Kontrakt**:
- Email regex: 4+ valid (`a@b.co`, `user+tag@domain.com.pl`, `foo.bar@baz.example`), 4+ invalid (empty, missing @, missing TLD, whitespace embedded)
- SAFE_NEXT regex: 4+ valid (`/`, `/home`, `/login/sub`, `/path?q=1`), 4+ invalid (`//evil.com`, `https://evil.com`)
- Document F2 lesson known bypass cases (backslash, %2f) jako WIP/comment — current regex nie blokuje, ale tests document expected behavior

#### 5. Utwórz `src/lib/site-url.test.ts`

**Plik**: `src/lib/site-url.test.ts` (nowy, co-located)

**Cel**: Test `getSiteUrl()` logic — env var override, host fallback, protocol decision, LAN IP detection (F3 lesson).

**Kontrakt**:
- ~6-8 test cases:
  - `NEXT_PUBLIC_SITE_URL` set → returns value (trailing / stripped)
  - localhost host → http
  - 127.0.0.1, 192.168.x.x, 10.x.x.x, ::1, *.local → http (F3 lesson coverage)
  - production host + x-forwarded-proto: https → https
  - production host bez forwarded proto → fallback per implementation
- Mock Next.js `headers()` API w setup (each test może override)

#### 6. Verify all tests pass

**Plik**: brak — verification

**Kontrakt**:
- `pnpm test:run` exit 0
- Stdout pokazuje 3 test files, 20+ tests pass

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `package.json` zawiera `vitest` w devDependencies
- `package.json` scripts zawiera `test` i `test:run`
- `vitest.config.ts` istnieje
- `src/lib/auth-errors.test.ts`, `auth-validation.test.ts`, `site-url.test.ts` istnieją
- `pnpm test:run` exit 0
- Coverage: 3 test files, 20+ test cases pass
- `pnpm exec tsc --noEmit` exit 0 (test files type-check)
- `pnpm lint` exit 0

#### Weryfikacja ręczna

- (brak — Vitest CLI output jest sufficient verification)

---

## Faza 3: Playwright setup + 1 e2e happy path

### Przegląd

Install Playwright + config + jeden e2e test przeciwko production URL (zapiszprzepis.pl). Test kończy się przy `/login?sent=1` (bez email click).

### Wymagane zmiany

#### 1. Install Playwright

**Plik**: `package.json`

**Cel**: Add Playwright + browser binary.

**Kontrakt**:
- `pnpm add -D @playwright/test` (current latest)
- `pnpm exec playwright install chromium` (download browser, ~80MB; cached w `~/.cache/ms-playwright/`)
- Add scripts:
  - `"test:e2e": "playwright test"` (headless CLI)
  - `"test:e2e:ui": "playwright test --ui"` (interactive UI mode dla debugowania)
- `pnpm-lock.yaml` zaktualizowany

#### 2. Utwórz `playwright.config.ts`

**Plik**: `playwright.config.ts` (nowy, root)

**Cel**: Playwright config — production URL baseURL, single Chromium project, no auto-serve (production target).

**Kontrakt**:
```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: 'https://zapiszprzepis.pl',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
```

#### 3. Utwórz `tests/e2e/auth-magic-link.spec.ts`

**Plik**: `tests/e2e/auth-magic-link.spec.ts` (nowy)

**Cel**: Happy path e2e — visit / → redirect /login → fill form → submit → assert /login?sent=1 + komunikat.

**Kontrakt**:
- Single `test()` block: `'happy path: magic-link form submit redirects to sent page'`
- Steps:
  1. `await page.goto('/')` → expect URL pattern `/login`
  2. Assert form elements visible (email input z autoFocus, submit button, logo)
  3. Fill email z unique timestamp: `test+${Date.now()}@example.com` (avoid Supabase rate limit)
  4. Click submit
  5. Wait for navigation, expect URL pattern `/login?sent=1`
  6. Assert content: text matching `/Wysłaliśmy link/i`
- Use Polish copy regex (project is PL-only per PRD)

#### 4. Update `.gitignore`

**Plik**: `.gitignore`

**Cel**: Exclude Playwright artifacts (test results, reports).

**Kontrakt**:
- Add section:
  ```
  # playwright
  /test-results/
  /playwright-report/
  /playwright/.cache/
  ```

#### 5. Run + verify

**Plik**: brak — verification

**Kontrakt**:
- `pnpm test:e2e` exit 0 (assuming production is healthy)
- Stdout: 1 test passed
- Test runtime: 5-15s (browser launch + 2 navigations + assertions)

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `package.json` zawiera `@playwright/test` w devDependencies
- `package.json` scripts zawiera `test:e2e` i `test:e2e:ui`
- `playwright.config.ts` istnieje z `baseURL: 'https://zapiszprzepis.pl'` i `testDir: 'tests/e2e'`
- `tests/e2e/auth-magic-link.spec.ts` istnieje
- `.gitignore` zawiera `/test-results/` i `/playwright-report/`
- `pnpm test:e2e` exit 0 (1 test passed)
- `pnpm exec tsc --noEmit` exit 0 (spec file type-checks)

#### Weryfikacja ręczna

- `pnpm test:e2e:ui` opens Playwright UI mode w przeglądarce, test runnable interaktywnie
- Po `pnpm test:e2e` failure (np. broken prod), `playwright-report/index.html` zawiera trace

---

## Faza 4: Docs update

### Przegląd

Update `README.md` z `## Testing` section. Update `plan-brief.md` reference.

### Wymagane zmiany

#### 1. README.md `## Testing` section

**Plik**: `README.md`

**Cel**: Document test workflows, conventions, pre-deploy ritual.

**Kontrakt**:
- Add `## Testing` section po `## Development` (lub przed `## Deployment`):
  - Subsection "Unit tests (Vitest)": `pnpm test` (watch), `pnpm test:run` (CI/manual)
  - Subsection "End-to-end tests (Playwright)": `pnpm test:e2e` (CLI), `pnpm test:e2e:ui` (interactive)
  - Subsection "Conventions": unit co-located (`src/**/*.test.ts`), e2e in `tests/e2e/`
  - Subsection "Pre-deploy ritual": link do `lessons.md` rule #7; reminder żeby uruchomić `pnpm test:e2e` po deploy (catches Supabase allowlist drift)

#### 2. (Optional) Update lessons.md rule #7 z reference do e2e test

**Plik**: `context/foundation/lessons.md`

**Cel**: Rule #7 (Supabase allowlist sync) może wzmiankować że e2e test catches this — closes the loop między learning i tooling.

**Kontrakt**:
- W "Mitigation pattern" sekcji rule #7, dodaj: "Plus automated mitigation: `pnpm test:e2e` z `tests/e2e/auth-magic-link.spec.ts` kończy się przy `/login?sent=1` — jeśli Supabase odrzuca emailRedirectTo (allowlist drift), Server Action redirectuje na `/login?error=...` zamiast `?sent=1`, e2e test fails głośno."

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `README.md` zawiera `## Testing` section
- `## Testing` section wymienia `pnpm test`, `pnpm test:e2e`
- `## Testing` section dokumentuje conventions (unit co-located, e2e w tests/e2e/)

#### Weryfikacja ręczna

- README renders czytelnie na GitHub (markdown formatting OK)
- Conventions opisane jasno dla future contributor

---

## Strategia testowania

### Testy jednostkowe

- 3 test files w `src/lib/`: auth-errors.test.ts, auth-validation.test.ts, site-url.test.ts
- Pure functions only (no I/O, no Supabase, no Next.js runtime)
- Mock Next.js `headers()` w site-url.test.ts (jedyny test wymagający mock)

### Testy integracyjne

Brak. Decyzja świadoma per `Czego NIE robimy` — middleware routing + Supabase calls pokryte przez 1 e2e + manual verification.

### Kroki testowania ręcznego

Po Phase 3 deploy weryfikacja:
1. `pnpm test:e2e` — happy path passes
2. Manual smoke after każdy deploy: visit zapiszprzepis.pl, redirect na /login, form display
3. Edge cases (used link, no code, expired) — pozostają manual per F-01 Phase 6 ritual

## Uwagi dotyczące wydajności

- Vitest watch mode (`pnpm test`) — sub-second response na file changes; ~20-100ms per test case dla pure functions
- Playwright single test — ~5-15s wall time (browser launch + network do prod)
- E2E test wykonywany ad-hoc, nie blokuje deploy

## Uwagi dotyczące migracji

Brak. Refactor w Phase 1 jest behavior-preserving (extract + import wire-up bez logic changes). Production code identyczny po Phase 1 commit.

## Otwarte ryzyka i założenia

- **F2 lesson refactor scoped out** — mapAuthError zostaje z `.includes()`; tests lock current behavior. Jeśli kiedyś zrobimy refactor na Set exact-equality, te testy zostaną updated (oczekiwane).
- **Production URL test fragility** — `pnpm test:e2e` zależy od zapiszprzepis.pl health + internet connectivity. Failures mogą być spowodowane: prod outage, Supabase rate limit przy częstych uruchomieniach, network. Akceptowalne dla 1-user MVP scale.
- **Supabase rate limit przy częstym e2e** — używamy unique timestamp emails, ale Supabase ma OTP send rate limit per IP (~60s cooldown). Test może rzadko hit cooldown error. Mitigation: nie biegaj e2e w pętli; ~minuta między runs OK.
- **Email regex znane edge cases** — current `^[^\s@]+@[^\s@]+\.[^\s@]+$` przyjmuje rzeczy typu `a@b.c` (TLD jednoznakowy). Decyzja per F-01 design — accept loose regex; nie problem dla naszego scope.
- **Playwright Windows compat** — Playwright działa na Windows out-of-box (no symlink issues jako OpenNext bundling). Czysty install.
- **Unit test runtime env** — Vitest używa Node, nie workerd. Pure functions są runtime-agnostic, ale jeśli kiedyś dodamy test integracyjny używający Cloudflare bindings, trzeba przejść na vitest-environment-miniflare. Out-of-scope teraz.

## Referencje

- F-01 (auth scaffold): `context/archive/2026-05-28-auth-and-supabase-scaffold/` (after PR #7 merge) lub `context/changes/auth-and-supabase-scaffold/`
- F-01 implementation review (lesson surface): `context/changes/auth-and-supabase-scaffold/reviews/impl-review.md`
- Recurring rules: `context/foundation/lessons.md` (F2 mapAuthError refactor, F3 LAN IPs, F7 Supabase allowlist)
- Vitest docs: https://vitest.dev/
- Playwright docs: https://playwright.dev/
- Next.js 16 testing guidance: https://nextjs.org/docs/app/building-your-application/testing
- M3L4 prompt template: `.claude/prompts/m3l4-e2e-prompt.md`
- M3L2 (corrupted, re-fetch needed): `.claude/prompts/m3l2-ad-hoc-testing.md`

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany. Nie zmieniaj nazw tytułów kroków. Patrz `references/progress-format.md`.

### Faza 1: Refactor — extract pure logic to lib

#### Automatyczne

- [x] 1.1 `src/lib/auth-errors.ts` istnieje, eksportuje `mapAuthError` — c9f3384
- [x] 1.2 `src/lib/auth-validation.ts` istnieje, eksportuje `EMAIL_REGEX`, `SAFE_NEXT_REGEX`, `isValidEmail`, `isSafeNext` — c9f3384
- [x] 1.3 `src/app/auth/callback/route.ts` importuje z `@/lib/auth-errors` i `@/lib/auth-validation`, brak inline `mapAuthError`/`SAFE_NEXT` — c9f3384
- [x] 1.4 `src/app/login/actions.ts` importuje z `@/lib/auth-validation`, brak inline email regex — c9f3384
- [x] 1.5 `pnpm exec tsc --noEmit` exit 0 — c9f3384
- [x] 1.6 `pnpm lint` exit 0 — c9f3384
- [x] 1.7 `pnpm build` exit 0 — c9f3384
- [x] 1.8 Grep weryfikacja imports survived w route.ts i actions.ts — c9f3384

### Faza 2: Vitest setup + unit tests

#### Automatyczne

- [x] 2.1 `package.json` devDependencies zawiera `vitest` — f3d1345
- [x] 2.2 `package.json` scripts zawiera `test` i `test:run` — f3d1345
- [x] 2.3 `vitest.config.ts` istnieje z proper exclude + alias config — f3d1345
- [x] 2.4 `src/lib/auth-errors.test.ts` istnieje z 6+ test cases — f3d1345
- [x] 2.5 `src/lib/auth-validation.test.ts` istnieje z 8+ test cases (email + SAFE_NEXT) — f3d1345
- [x] 2.6 `src/lib/site-url.test.ts` istnieje z 6+ test cases — f3d1345
- [x] 2.7 `pnpm test:run` exit 0, wszystkie tests pass — f3d1345
- [x] 2.8 `pnpm exec tsc --noEmit` exit 0 (test files type-check) — f3d1345
- [x] 2.9 `pnpm lint` exit 0 — f3d1345

### Faza 3: Playwright setup + 1 e2e happy path

#### Automatyczne

- [x] 3.1 `package.json` devDependencies zawiera `@playwright/test`
- [x] 3.2 `package.json` scripts zawiera `test:e2e` i `test:e2e:ui`
- [x] 3.3 `playwright.config.ts` istnieje z `baseURL: 'https://zapiszprzepis.pl'`
- [x] 3.4 `tests/e2e/auth-magic-link.spec.ts` istnieje
- [x] 3.5 `.gitignore` zawiera `/test-results/` i `/playwright-report/`
- [x] 3.6 `pnpm exec playwright install chromium` exit 0 (browser cached)
- [x] 3.7 `pnpm test:e2e` exit 0 (1 test passed)
- [x] 3.8 `pnpm exec tsc --noEmit` exit 0

#### Ręczne

- [x] 3.9 `pnpm test:e2e:ui` opens Playwright UI mode w przeglądarce, test runnable

### Faza 4: Docs update

#### Automatyczne

- [ ] 4.1 `README.md` zawiera `## Testing` section
- [ ] 4.2 `## Testing` wymienia `pnpm test`, `pnpm test:e2e`, `pnpm test:e2e:ui`
- [ ] 4.3 `## Testing` dokumentuje conventions (unit co-located, e2e w tests/e2e/)
- [ ] 4.4 (Optional) `lessons.md` rule #7 wzmiankuje e2e test jako automated mitigation

#### Ręczne

- [ ] 4.5 README renders czytelnie na GitHub
