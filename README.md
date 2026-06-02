# ZapiszPrzepis

PWA *archive-first* do zapisywania przepisów udostępnianych z mediów społecznościowych. Każdy URL trafia przez systemowy gest „Udostępnij" i jest przekształcany w trwałą, polskojęzyczną kopię przepisu, niezależną od oryginału.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase (auth + Postgres + storage) + Vercel.

## Setup

Wymagania: Node ≥ 20.6, pnpm (Corepack-managed — projekt pinuje wersję w `package.json#packageManager`), konto Supabase, konto Vercel.

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

3. **Skonfiguruj redirect URLs** w Supabase Authentication → URL Configuration:
   - Site URL: `https://zapiszprzepis.vercel.app` (lub Twój)
   - Redirect URLs (allowlist):
     - `http://localhost:3000/auth/callback`
     - `https://*-zapiszprzepis.vercel.app/auth/callback`
     - `https://zapiszprzepis.vercel.app/auth/callback`

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

6. **Vercel** (po pierwszym deploy):
   - Project Settings → Environment Variables:
     - `NEXT_PUBLIC_SUPABASE_URL` — Production + Preview + Development (te same wartości)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Production + Preview + Development (te same wartości)
     - `NEXT_PUBLIC_SITE_URL` — **tylko Production** (`https://zapiszprzepis.vercel.app`) i Development (`http://localhost:3000`). **Zostaw NIEUSTAWIONE dla Preview**, żeby `getSiteUrl()` mógł użyć runtime fallback do `request.host` — magic-link z preview deploy powróci na ten sam preview URL, nie na Production.

## Development

```bash
pnpm dev              # http://localhost:3000
pnpm build            # production build
pnpm lint             # ESLint
pnpm check:auth       # smoke test: ping Supabase auth/v1/health
```

## Verification

Po setupie sprawdź że auth flow działa:

```bash
pnpm check:auth
# → ✓ Supabase auth healthy: https://<ref>.supabase.co
```

Następnie ręcznie:

1. `pnpm dev` → wejdź na http://localhost:3000 → przekierowanie na `/login`
2. Wpisz swój email → klik **Wyślij link** → komunikat „Wysłaliśmy link na …"
3. Kliknij link z poczty → `/auth/callback` → redirect na `/` → widzisz „Zalogowano jako <email>"
4. Klik **Wyloguj się** → wracasz na `/login`; próba wejścia na `/` znów przekierowuje na `/login`

## Architektura auth

- **`src/proxy.ts`** — Next.js 16 proxy (był `middleware.ts` w v15); odświeża sesję przez `supabase.auth.getUser()` na każdym żądaniu; przekierowuje niezalogowanych na `/login`.
- **`src/lib/supabase/{server,client,proxy}.ts`** — trzy helpery klientów Supabase z adapterem cookies `getAll`/`setAll`.
- **`src/app/login/`** — Server Component + Server Action (`signInWithOtp`).
- **`src/app/auth/callback/`** — Route Handler (`exchangeCodeForSession` z mapowaniem błędów).
- **`src/app/(actions)/sign-out.ts`** — Server Action `signOut` w route group (bez segmentu URL).
- **`supabase/migrations/`** — baseline: `pg_trgm` + `public.current_user_id()`.

## Project context

Pełny PRD, roadmap i plan implementacji żyją w `context/`:

- `context/foundation/prd.md` — Product Requirements Document
- `context/foundation/roadmap.md` — wycinki F-01 ... S-07
- `context/foundation/tech-stack.md` — uzasadnienie wyboru stacka
- `context/changes/<change-id>/` — folder per change z planem i progress
