# ZapiszPrzepis

PWA *archive-first* do zapisywania przepisów udostępnianych z mediów społecznościowych. Każdy URL trafia przez systemowy gest „Udostępnij" i jest przekształcany w trwałą, polskojęzyczną kopię przepisu, niezależną od oryginału.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase (auth + Postgres + storage) + Cloudflare Workers (via `@opennextjs/cloudflare` adapter).

Produkcja: **https://zapiszprzepis.pl** (Cloudflare Workers + Static Assets).

## Setup

Wymagania: Node 22 LTS (pinowany w `.nvmrc`), pnpm (Corepack-managed — projekt pinuje wersję w `package.json#packageManager`), konto Supabase, konto Cloudflare (free tier).

1. **Sklonuj repo i zainstaluj zależności**:
   ```bash
   git clone https://github.com/spokospace/zapiszprzepis.git
   cd zapiszprzepis
   corepack enable    # jednorazowo — aktywuje pnpm pinned w package.json
   pnpm install
   ```

2. **Utwórz projekt Supabase** w https://supabase.com/dashboard:
   - Name: `zapiszprzepis`, Region: `Central EU (Frankfurt)`, Plan: Free
   - Project Settings → API Keys → skopiuj:
     - **Project URL** (`https://<ref>.supabase.co`)
     - **Publishable key** (lub legacy `anon` `public` JWT)

3. **Skonfiguruj URL Configuration** w Supabase Authentication → URL Configuration:
   - **Site URL**: `https://zapiszprzepis.pl`
   - **Redirect URLs** (allowlist):
     - `http://localhost:3000/auth/callback` (local dev)
     - `https://zapiszprzepis.pl/auth/callback` (production)
     - `https://zapiszprzepis.<account>.workers.dev/auth/callback` (Cloudflare Workers preview / direct)

   > **Recurring rule** (`context/foundation/lessons.md` #7): każdy nowy deployment URL wymaga dodania `<new-url>/auth/callback` do Redirect URLs allowlist. Inaczej magic-link silent-fallbackuje na Site URL — efekt: martwy link w mailu.

4. **Lokalny `.env.local`**:
   ```bash
   cp .env.local.example .env.local
   # uzupełnij NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

5. **Zaloguj się w Supabase CLI i połącz z projektem**:
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push --linked
   ```

6. **Cloudflare Workers env vars** (po pierwszym deploy via Workers Builds):
   - Worker `zapiszprzepis` → Settings → **Build variables and secrets** (build-time, dla NEXT_PUBLIC_* inline w client bundle):
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NEXT_PUBLIC_SITE_URL = https://zapiszprzepis.pl`
   - Worker `zapiszprzepis` → Settings → **Variables and Secrets** (runtime, dla `process.env` w Server Components / middleware):
     - Te same 3 zmienne — **musisz je zduplikować**. Cloudflare docs: "Build variables will not be accessible at runtime."
     - `TRIGGER_SECRET_KEY` (jako **Secret**) — production key z dashboardu Trigger.dev (różny od dev key). Czytany lazily przez `@trigger.dev/sdk` przy `tasks.trigger()` — **NIE** wpisuj w Build vars (nie jest potrzebny przy build).

## Development

```bash
pnpm dev              # http://localhost:3000 (Node runtime, hot reload)
pnpm build            # Next.js production build (standard)
pnpm lint             # ESLint
pnpm check:auth       # smoke test: ping Supabase auth/v1/health
```

## Testing

### Unit tests (Vitest)

```bash
pnpm test           # watch mode (re-runs on file change)
pnpm test:run       # single run with exit code (for manual gates)
```

Pokrywa pure logic: `mapAuthError` (callback error code mapping), email regex + SAFE_NEXT regex (input validation), `getSiteUrl()` (env/host/protocol decision), `lib/env.ts` (env var validation at module load — server-only). Test files są co-located z source jako `src/lib/<name>.test.ts`.

### End-to-end tests (Playwright)

```bash
pnpm test:e2e       # headless run against https://zapiszprzepis.pl
pnpm test:e2e:ui    # interactive UI mode (debugging, watch test runs)
```

Pojedynczy happy-path test (`tests/e2e/auth-magic-link.spec.ts`) hits production URL. Asserts że Worker deploy + middleware + form + Server Action + Supabase wiring działają end-to-end.

### Konwencje

- **Unit tests**: co-located z source (`src/lib/X.ts` → `src/lib/X.test.ts`)
- **E2E tests**: separate `tests/e2e/` directory (różny runtime + config)
- **Test runtime**: Vitest używa Node (pure logic, no workerd fidelity needed); Playwright launches Chromium against live prod URL
- **CI**: brak. Tests biegają lokalnie / manualnie

### Pre-deploy ritual

Po każdym deploy do production uruchom `pnpm test:e2e` jako smoke check. Catches: Worker deploy regressions, middleware drift, Server Action crash, Supabase reachability issues. Per `context/foundation/lessons.md` rule #7 (Supabase allowlist drift) — manual verification of magic-link **email link target** nadal recommended dla pełnej allowlist drift detection (e2e test cannot distinguish `?sent=1` od `?error=*` bez real test inbox).

## Background jobs (Trigger.dev)

Długo działające taski (1–3 min — scraping, transkrypcja audio, ekstrakcja LLM) odbywają się poza request-path Cloudflare Workers przez **Trigger.dev Cloud** (free tier). Workers triggerują task (lekki HTTP call < 10 ms CPU), Trigger.dev wykonuje, aplikacja pyta o status przez SDK polling.

### Setup

1. **Konto Trigger.dev**: utwórz na https://cloud.trigger.dev, projekt `zapiszprzepis`.
2. **Project ref + dev key**: dashboard → Project → API Keys. Wpisz do `.env.local`:
   ```
   TRIGGER_SECRET_KEY=tr_dev_xxxxxxxxxxxx
   ```
   `TRIGGER_PROJECT_ID` jest literalem w `trigger.config.ts` (Trigger.dev recommendation).
3. **CLI login**:
   ```bash
   pnpm dlx trigger.dev@latest login
   ```

### Local development

```bash
pnpm dev                              # Terminal A — Next.js dev server (3000)
pnpm dlx trigger.dev@latest dev       # Terminal B — Trigger.dev dev (łączy z dashboard, odbiera triggery)
```

Następnie `http://localhost:3000/test-trigger` → klik **Triggeruj task** → po ~6 s klik **Sprawdź status**. Korelacja `runId` w 3 miejscach: terminal A console, terminal B console, dashboard Trigger.dev.

> **Uwaga:** `/test-trigger` to dev-only page (F-01 smoke). Znika gdy real share-target flow wjedzie w S-01.

### Production deployment

Trigger.dev i Workers deployują się **osobno** — pamiętaj o obu:

```bash
pnpm dlx trigger.dev@latest deploy    # Trigger.dev production env (taski)
pnpm deploy                            # Cloudflare Workers (aplikacja)
```

Production smoke: `https://zapiszprzepis.pl/test-trigger` flow tak samo jak local.

### Troubleshooting

- **`TRIGGER_SECRET_KEY is required`** przy Server Action call → brakuje secret w `.env.local` (dev) lub w Cloudflare Workers Variables and Secrets (production).
- **Task triggers ale status zawsze `QUEUED`** → Trigger.dev dev mode nie chodzi (Terminal B). Restart `pnpm dlx trigger.dev@latest dev`.
- **`runId` różni się w 3 miejscach** → nie ten sam project ref. Sprawdź `trigger.config.ts` i Workers env. Możesz mieć dwa różne projekty.
- **Retroaktywne logi z taska** → Trigger.dev dashboard → Project → Runs → kliknij run dla 1-day log retention (free tier).

Plan F-01 i decyzje architektoniczne (polling vs webhook, observability, retry policy): `context/changes/async-job-runner/`.

## Deployment

Produkcja na Cloudflare Workers przez **Workers Builds** (Git CI/CD). Każdy push do `master` auto-buduje + deployuje.

```bash
pnpm preview          # opennextjs-cloudflare build + preview (workerd runtime lokalnie)
pnpm deploy           # opennextjs-cloudflare build + deploy (manual deploy via wrangler)
pnpm cf-typegen       # regeneruj cloudflare-env.d.ts z wrangler.jsonc bindings
```

> **Windows uwaga**: lokalny `pnpm exec opennextjs-cloudflare build` fails z `EPERM symlink` (known OpenNext limitation). `pnpm dev` działa normalnie. Workers Builds w cloudzie (Linux) buduje bezbłędnie. Alternatywa: WSL lub Windows Developer Mode.

Workers Builds config (Cloudflare Worker → Settings → Builds):
- **Build command**: `pnpm exec opennextjs-cloudflare build`
- **Deploy command**: `pnpm exec opennextjs-cloudflare deploy`
- **Production branch**: `master`
- pnpm + Node detect: automatycznie z `packageManager` field w `package.json` + `.nvmrc`

## Verification

Po setupie sprawdź że auth flow działa:

```bash
pnpm check:auth
# → ✓ Supabase auth healthy: https://<ref>.supabase.co
```

Następnie ręcznie (lokalnie lub na produkcji):

1. Wejdź na `http://localhost:3000` (lokalnie) lub `https://zapiszprzepis.pl` (produkcja) → przekierowanie na `/login`
2. Wpisz swój email → klik **Wyślij link** → komunikat „Wysłaliśmy link na …"
3. Sprawdź link w mailu — powinien wskazywać na odpowiednią domenę (NIE `localhost` z produkcji, NIE stara platforma)
4. Kliknij link → `/auth/callback` → redirect na `/` → widzisz „Zalogowano jako <email>"
5. Klik **Wyloguj się** → wracasz na `/login`; próba wejścia na `/` znów przekierowuje na `/login`

## Architektura auth

- **`src/middleware.ts`** — Next.js middleware (był `proxy.ts` w v16 default, rename back jako workaround dla [opennextjs/opennextjs-cloudflare#962](https://github.com/opennextjs/opennextjs-cloudflare/issues/962)); odświeża sesję przez `supabase.auth.getUser()` na każdym żądaniu; przekierowuje niezalogowanych na `/login`.
- **`src/lib/supabase/{server,client,proxy}.ts`** — trzy helpery klientów Supabase z adapterem cookies `getAll`/`setAll` (proxy.ts helper aplikuje `headers` argument dla cache-poisoning mitigation per `@supabase/ssr` v0.10+).
- **`src/app/login/`** — Server Component + Server Action (`signInWithOtp`).
- **`src/app/auth/callback/`** — Route Handler (`exchangeCodeForSession` z mapowaniem błędów).
- **`src/app/(actions)/sign-out.ts`** — Server Action `signOut` w route group (bez segmentu URL).
- **`supabase/migrations/`** — baseline: `pg_trgm` + `public.current_user_id()`.

## Project context

Pełny PRD, roadmap i plan implementacji żyją w `context/`:

- `context/foundation/prd.md` — Product Requirements Document
- `context/foundation/roadmap.md` — wycinki F-01 ... S-07
- `context/foundation/tech-stack.md` — uzasadnienie wyboru stacka
- `context/foundation/infrastructure.md` — decyzja platformy (Cloudflare Workers) + risk register
- `context/foundation/lessons.md` — append-only register recurring rules
- `context/changes/<change-id>/` — folder per change z planem i progress
- `context/archive/<change-id>/` — zarchiwizowane change'e (immutable)
