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

## Development

```bash
pnpm dev              # http://localhost:3000 (Node runtime, hot reload)
pnpm build            # Next.js production build (standard)
pnpm lint             # ESLint
pnpm check:auth       # smoke test: ping Supabase auth/v1/health
```

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
