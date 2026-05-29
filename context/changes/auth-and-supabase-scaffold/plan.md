# Supabase scaffold + magic-link auth (F-01) — Plan implementacji

## Przegląd

Wprowadzamy fundament uwierzytelniania dla ZapiszPrzepis: jeden cloud projekt Supabase, passwordless magic-link, sesja długo-żyjąca odświeżana w `proxy.ts` (Next.js 16 zmienił `middleware.ts` → `proxy.ts`), polskojęzyczny UI logowania jako Server Component + Server Action, pierwsza migracja zakładająca `pg_trgm` i helper RLS `public.current_user_id()` bez własnych tabel. Po tej zmianie każdy kolejny wycinek (S-01 i dalej) ma gotową sesję, chronione trasy oraz konwencję RLS per `auth.uid()`.

## Analiza stanu obecnego

- Świeży scaffold Next.js 16.2.6 (App Router) + TypeScript + Tailwind v4 + ESLint w `src/app/{layout.tsx,page.tsx,globals.css}`.
- Brak `src/app/api/`, brak `proxy.ts`, brak `supabase/`, brak SDK Supabase w `package.json` (`next`, `react`, `react-dom` only).
- `AGENTS.md` ostrzega: *"This is NOT the Next.js you know"* — wymaga sprawdzenia `node_modules/next/dist/docs/` przed pisaniem kodu. Sprawdzono w trakcie planowania.
- **Kluczowe ustalenia Next.js 16** (z `node_modules/next/dist/docs/`):
  - `middleware.ts` jest deprecated → **`proxy.ts`** na root (`src/proxy.ts` jeśli `src-dir`, lub root); funkcja `proxy` zamiast `middleware`.
  - `cookies()` z `next/headers` jest **asynchroniczny**: `const cookieStore = await cookies()`.
  - `.set`/`.delete` na cookies wolno tylko w Server Function / Route Handler / Proxy — nie w Server Component przy renderze.
  - Server Actions: `<form action={action}>` + `'use server'`; opcjonalny `useActionState` dla błędów inline.
  - `proxy.ts` ma defaultowo Edge Runtime; matcher konfigurowany przez `export const config`.
- Bootstrap audit zostawił 2 MODERATE w postcss via next (chain do `next@9.3.3` downgrade — niewykonalne). Nie blokuje; monitorujemy upstream.
- PRD lockuje: passwordless magic-link, jeden e-mail → jedno konto → prywatna skrzynka, `target_scale.users: small`, sesja długo-żyjąca, brak ekranu rejestracji.
- Sokrates z FR-001 dodaje guardrail: gdy sesja padnie po update PWA / wyczyszczeniu cache → fallback to ten sam magic-link (mama wysyła sobie nowy link, autor pomaga jednorazowo). Brak osobnego mechanizmu "backup".

## Pożądany stan końcowy

Po zakończeniu planu:

- Jeden cloud projekt Supabase (`zapiszprzepis`) jest powiązany z repo przez CLI; `supabase/migrations/<ts>_init_auth_helpers.sql` została zaaplikowana w cloud.
- Tabela `auth.users` istnieje (Supabase Auth schema); helper `public.current_user_id()` zwraca `auth.uid()`; extension `pg_trgm` aktywne.
- `npm run dev` na localhost: użytkownik wpisuje swój email na `/login` → otrzymuje magic-link na email → klika link → `/auth/callback` wymienia `code` na sesję → redirect na `/` → widzi "Zalogowano jako <email>" + przycisk "Wyloguj się"; po wylogowaniu redirect na `/login`.
- Próba wejścia na `/` bez sesji → redirect na `/login`.
- Magic-link wygasły / zużyty → `/login?error=expired` z czytelnym polskim komunikatem i przyciskiem "Wyślij nowy link" z pre-fill emaila (jeśli jest w query).
- Vercel preview deploy z tym samym Supabase projektem działa identycznie jak localhost (redirect URLs whitelist obejmuje `localhost:3000`, `*-zapiszprzepis.vercel.app`, `zapiszprzepis.vercel.app`).
- `npm run check:auth` (smoke script) potwierdza, że `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` są podpięte i Supabase REST odpowiada `200`.

### Kluczowe odkrycia

- Next.js 16 zmienił `middleware.ts` → `proxy.ts` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:11`). Funkcja `middleware` → `proxy`. Codemod `npx @next/codemod@canary middleware-to-proxy .` istnieje, ale tu piszemy od zera.
- `cookies()` z `next/headers` zwraca `Promise<ReadonlyRequestCookies>` (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md:5`); musimy `await` przed `.get`/`.set`.
- W Supabase SSR pattern Next.js: trzy klienty (server, browser, proxy) używają `@supabase/ssr` z `getAll()`/`setAll(cookies)` adapterami — proxy variant pisze cookies do `NextResponse` które trafia do przeglądarki.
- Roadmap F-01 §Ryzyko explicit wskazuje konfigurację redirect URL w Supabase dla Vercel preview vs prod jako pułapkę — rozwiązujemy przez allowlist z wildcardem dla `*-zapiszprzepis.vercel.app`.
- PRD `target_scale.users: small` + brak płatności + brak realtime + `after_hours_only: true` uzasadnia jeden projekt Supabase zamiast dev+prod split (decyzja użytkownika z rundy planowania).

## Czego NIE robimy

- **Brak własnych tabel aplikacyjnych** (`recipes`, `categories`, etc.) — rodzą się w S-01 zgodnie z roadmapą. Tu tylko `auth.users` (Supabase) + helper SQL.
- **Brak Profili (`public.profiles`)** — PRD nie wymaga; e-mail żyje w `auth.users.email`.
- **Brak ekranu rejestracji** — passwordless magic-link nie rozróżnia sign-up vs sign-in; pierwszy klik na link automatycznie tworzy `auth.users` row.
- **Brak Playwright e2e** ani Vitest unit (decyzja: ręczna weryfikacja + smoke). Testy formalne wprowadza Moduł 3.
- **Brak push notifications, OTP via SMS, social login, MFA** — passwordless email-only.
- **Brak osobnego "setup mode" dla autora** — autor po prostu wpisuje email mamy na jej telefonie i klika link z jej skrzynki; flow jest taki sam dla autora i dla mamy.
- **Brak custom JWT TTL** ani innych zmian w Supabase Auth Settings poza redirect URLs — defaultowy 1h JWT + 30d refresh + silent refresh w proxy wystarcza dla mamy (PRD: sesja długo-żyjąca, nie "wieczna").
- **Brak rate limitingu** na `/login` poza tym, co daje Supabase Auth out-of-box (`signInWithOtp` ma wbudowane throttling).
- **Brak `dev` vs `prod` env** — jeden projekt Supabase dla MVP (decyzja użytkownika).
- **Lokalny Supabase via Docker** — pominięty (decyzja użytkownika, Windows bez Docker Desktop). CLI używamy tylko do migracji w cloud.

## Podejście do implementacji

Pięć faz w kolejności zależności: (1) Bootstrap środowiska — projekt cloud, env vars, deps, CLI. (2) Klienty SSR — trzy moduły helper + `proxy.ts`. (3) Schema baseline — `supabase init` + pierwsza migracja w cloud. (4) Auth UI — `/login`, `/auth/callback`, zaktualizowany `/`, sign-out, polskie błędy. (5) Weryfikacja — smoke script + ręczna checklist na localhost + Vercel preview.

Decyzja architektoniczna: Server Actions z formularzy zamiast route handlerów + client fetch. Server Component renderuje `<form action={signInWithEmail}>`; akcja jest `'use server'` i wywołuje `supabase.auth.signInWithOtp` po stronie serwera. Powód: idiomatyczny Next.js 16 App Router, progressive enhancement (form działa nawet bez JS, co dla PWA na Androidzie to plus), mniej kodu, brak client state. Errors są raportowane przez `redirect('/login?error=<code>')` z mapowaniem polskim po stronie Server Component renderującego `/login`.

Decyzja `proxy.ts`: pojedynczy `proxy.ts` na root projektu (nie `src/proxy.ts`, bo Next.js przyjmuje obie lokalizacje gdy `src-dir`, ale roadmap nie wymaga `src/` dla tego pliku — preferujemy root żeby było obok `next.config.ts`). Matcher wyklucza `_next/static`, `_next/image`, `favicon.ico`, `public/*`, `auth/callback` (callback potrzebuje przetworzyć cookies sam) i bezwarunkowo dopuszcza `/login`. Wszystkie inne ścieżki: jeśli brak sesji → redirect na `/login`; jeśli jest sesja → odśwież token i kontynuuj.

Decyzja schemy: minimum funkcjonalne (extension `pg_trgm` używana przez FR-013 search w S-06; helper `public.current_user_id()` opakowujący `auth.uid()` z `SECURITY DEFINER STABLE` — wzorzec rekomendowany do RLS żeby uniknąć multiple `auth.uid()` evaluations). Brak tabel — żeby nie wyprzedzić S-01.

## Krytyczne szczegóły implementacji

- **Next.js 16 → `proxy.ts`, nie `middleware.ts`**: Większość przykładów Supabase + Next.js w sieci nadal pokazuje `middleware.ts`. Jeśli implementator skopiuje taki snippet 1:1, deployment będzie sukces, ale plik nie zostanie wywołany (Next.js v16 nie traktuje `middleware.ts` jako konwencji). Sygnał, że to działa: plik nazywa się `proxy.ts`, eksportuje funkcję `proxy` (lub default), i widać w devtools że nagłówki request są modyfikowane. Sygnał, że NIE działa: brak Set-Cookie po klikaniu magic-link, sesja "ginie" przy nawigacji.
- **`cookies()` jest async w Next.js 16**: `await cookies()` zawsze — nawet w Server Action. Synchronous użycie produkuje deprecation warning i przestanie działać.
- **Adapter cookies dla `@supabase/ssr`**: pattern jest `getAll()` (zwraca tablicę `{ name, value }`) + `setAll(cookies)` (otrzymuje tablicę do ustawienia). NIE używaj starego patternu `get/set/remove` z `@supabase/auth-helpers-nextjs` — to deprecated, zastąpione przez `@supabase/ssr`.
- **Proxy zwraca `NextResponse`**: Server Action ustawia cookies w cookie store przez `(await cookies()).set(...)`, ale `proxy.ts` musi własnoręcznie skopiować cookies z requestu na `NextResponse.next({ request })` i potem na response. Jeśli tego nie zrobisz, nowe `Set-Cookie` z odświeżenia sesji nie trafią do przeglądarki i sesja zwiśnie.
- **Redirect URLs whitelist w Supabase**: musi obejmować dokładne URL-e (nie tylko Site URL). Dodajemy: `http://localhost:3000/auth/callback`, `https://*-zapiszprzepis.vercel.app/auth/callback` (wildcard preview), `https://zapiszprzepis.vercel.app/auth/callback`. Bez wildcard preview deploy zwróci `redirect_to is not allowed`.
- **`signInWithOtp` rate limit**: Supabase Auth ma builtin 60s cooldown na ten sam email. Jeśli mama kliknie "Wyślij ponownie" przed upływem cooldown, Supabase zwraca error — mapujemy na polski komunikat "Poczekaj chwilę zanim wyślesz kolejny link".
- **Magic-link TTL**: domyślnie 1h. Klikany ponownie po użyciu zwraca "code already used" — mapujemy na polski.

---

## Faza 1: Bootstrap środowiska Supabase

### Przegląd

Tworzymy jeden cloud projekt Supabase, instalujemy SDK + CLI jako devDep, konfigurujemy zmienne środowiskowe i allowlist redirect URLs.

### Wymagane zmiany

#### 1. Cloud projekt Supabase

**Plik**: brak (manual steps documented in README, see Phase 5)

**Cel**: Utworzyć jeden projekt Supabase pod nazwą `zapiszprzepis` w regionie `eu-central-1` (Frankfurt — najbliżej Polski). Pobrać `Project URL` i `anon public key`.

**Kontrakt**:
- Project URL ma format `https://<ref>.supabase.co`
- anon public key to JWT zaczynający się od `eyJ...`
- Region: `eu-central-1`
- Auth Settings → **Site URL**: `https://zapiszprzepis.vercel.app` (do uzupełnienia po pierwszym deploy)
- Auth Settings → **Redirect URLs** (allowlist):
  - `http://localhost:3000/auth/callback`
  - `https://*-zapiszprzepis.vercel.app/auth/callback`
  - `https://zapiszprzepis.vercel.app/auth/callback`
- Auth Settings → **Email Auth**: enabled, **Confirm email**: enabled (default), **Secure email change**: enabled (default)
- Auth Settings → Email provider: domyślny Supabase SMTP wystarcza dla MVP (target_scale: 1 user)

#### 2. Dodanie zależności

**Plik**: `package.json`

**Cel**: Dodać runtime SDK Supabase do dependencies i CLI do devDependencies. Dzięki temu CLI działa przez `npx supabase` bez globalnej instalacji (więc bez Dockera).

**Kontrakt**:
- `dependencies`: `@supabase/ssr` (najnowsza), `@supabase/supabase-js` (najnowsza peer dla `@supabase/ssr`)
- `devDependencies`: `supabase` (CLI, najnowsza)
- Nowy script: `"check:auth": "tsx scripts/check-auth.ts"` — wymaga `tsx` w devDeps żeby uruchamiać `.ts` skrypty bez build kroku

Komenda: `npm install @supabase/ssr @supabase/supabase-js && npm install -D supabase tsx`

#### 3. Zmienne środowiskowe

**Plik**: `.env.local.example` (nowy plik)

**Cel**: Szablon zmiennych do skopiowania jako `.env.local` (już zignorowane przez `.gitignore`).

**Kontrakt**:
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Plik**: `.env.local` (nowy, lokalny, w `.gitignore`)

**Cel**: Lokalna kopia z prawdziwymi wartościami z dashboardu Supabase. Użytkownik tworzy ręcznie.

#### 4. Zmienne środowiskowe na Vercel

**Plik**: brak (manual steps in README)

**Cel**: Te same 3 zmienne ustawione w Vercel Project Settings → Environment Variables dla `Production`, `Preview` i `Development`. `NEXT_PUBLIC_SITE_URL` dla `Preview` może być pusty — wtedy fallback na `request.url` (patrz Faza 4).

**Kontrakt**: trzy zmienne w trzech środowiskach Vercel; widoczne na Build & Runtime.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `package.json` zawiera `@supabase/ssr`, `@supabase/supabase-js`, `supabase`, `tsx` (sprawdzenie: `npm ls @supabase/ssr @supabase/supabase-js supabase tsx`)
- `.env.local.example` istnieje i ma 3 wymagane klucze
- `.env.local` jest ignorowane przez git (`git check-ignore .env.local` zwraca 0)
- `npm run dev` startuje bez błędów importu (na razie żaden kod nie używa env)

#### Weryfikacja ręczna

- Projekt Supabase widoczny w dashboardzie pod nazwą `zapiszprzepis`, region `eu-central-1`
- Redirect URLs allowlist zawiera 3 wpisy (localhost + 2× Vercel)
- `.env.local` lokalnie zawiera prawdziwe wartości (autorka skopiowała z dashboardu)
- Vercel ma 3 zmienne ustawione dla Production + Preview

**Uwaga implementacyjna**: Po zakończeniu tej fazy zatrzymaj się na ręczne potwierdzenie, że Supabase project istnieje i `.env.local` ma wartości, zanim przejdziesz do Fazy 2.

---

## Faza 2: Klienty SSR + `proxy.ts`

### Przegląd

Trzy helpery klientów Supabase dla server / browser / proxy + `proxy.ts` na root projektu, który odświeża sesję na każdym żądaniu i chroni trasy wymagające auth.

### Wymagane zmiany

#### 1. Server client

**Plik**: `src/lib/supabase/server.ts` (nowy)

**Cel**: Helper tworzący klient Supabase do użytku w Server Components, Server Actions i Route Handlers. Czyta cookies request z `next/headers` (async).

**Kontrakt**:
- Eksportuje `async function createSupabaseServerClient(): Promise<SupabaseClient>`
- Używa `createServerClient` z `@supabase/ssr` z adapterem cookies opartym o `getAll()` / `setAll()`
- `setAll` w Server Component otacza `try/catch` (set/delete w Server Component renderze rzuca — to akceptowalne; Supabase wywołuje `setAll` profilaktycznie z `getUser`)
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### 2. Browser client

**Plik**: `src/lib/supabase/client.ts` (nowy)

**Cel**: Helper tworzący klient Supabase do użytku w Client Components (jeśli pojawi się potrzeba w przyszłości — w F-01 nie używamy, ale eksport jest gotowy żeby S-01+ nie musiał tworzyć).

**Kontrakt**:
- Eksportuje `function createSupabaseBrowserClient(): SupabaseClient`
- Używa `createBrowserClient` z `@supabase/ssr`
- Te same env vars

#### 3. Proxy cookie helper

**Plik**: `src/lib/supabase/proxy.ts` (nowy)

**Cel**: Helper `updateSession(request: NextRequest)` używany przez `proxy.ts` na root. Tworzy Supabase server client podłączony do `NextResponse.next({ request })`, woła `supabase.auth.getUser()` (to odświeża token i ustawia nowe cookies w response), zwraca `{ response, user }`.

**Kontrakt**:
- Eksportuje `async function updateSession(request: NextRequest): Promise<{ response: NextResponse; user: User | null }>`
- Tworzy `NextResponse.next({ request })`, dostarcza adapter cookies który (a) czyta z `request.cookies.getAll()`, (b) `setAll` zapisuje JEDNOCZEŚNIE do `request.cookies` i do `response.cookies` (krytyczne — bez tego cookies nie propagują do downstream handlerów)
- Wywołuje `await supabase.auth.getUser()` — to wymusza weryfikację po stronie Supabase (nie ufamy lokalnemu JWT) i odświeża token jeśli wygasł
- Zwraca `user` z `data.user` lub `null` jeśli brak sesji

#### 4. Proxy na root

**Plik**: `proxy.ts` (nowy, na root projektu)

**Cel**: Wywołuje `updateSession` na każdym matchującym żądaniu. Jeśli `user` jest null i ścieżka NIE jest w whitelist (`/login`, `/auth/callback`) → redirect na `/login`. Jeśli `user` istnieje i ścieżka to `/login` → redirect na `/`. W przeciwnym razie zwróć `response` z `updateSession`.

**Kontrakt**:
- Eksportuje `export async function proxy(request: NextRequest): Promise<NextResponse>` (NIE `middleware`)
- Eksportuje `export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'] }` — wyklucza statyki, obejmuje wszystko inne (w tym `/login` i `/auth/callback`, bo `updateSession` musi też tam działać)
- Logika redirect:
  - `/auth/callback` — zawsze przepuść (route handler musi przetworzyć code)
  - `/login` z `user === null` — przepuść (pokaż formularz)
  - `/login` z `user !== null` — `NextResponse.redirect(new URL('/', request.url))`
  - dowolna inna ścieżka z `user === null` — `NextResponse.redirect(new URL('/login', request.url))`
  - dowolna inna ścieżka z `user !== null` — zwróć `response` z `updateSession` (cookies już odświeżone)

### Kryteria sukcesu

#### Weryfikacja automatyczna

- TypeScript się kompiluje: `npx tsc --noEmit`
- ESLint przechodzi: `npm run lint`
- `proxy.ts` istnieje na root projektu
- `src/lib/supabase/{server,client,proxy}.ts` istnieją
- `npm run build` przechodzi (Next.js wykrywa `proxy.ts` i raportuje go w output)

#### Weryfikacja ręczna

- `npm run dev` → wejście na `http://localhost:3000/` przekierowuje na `/login` (logi w terminalu pokazują request do `/` zakończony 307)
- Devtools → Network → `/` → status `307` z `Location: /login`
- Próba wejścia na `/login` bez sesji → 200 (formularz, gdy istnieje; w tej fazie placeholder)

**Uwaga implementacyjna**: Po Fazie 2 strona `/login` jeszcze nie istnieje (Faza 4); tymczasowo `/login` zwróci 404 z `notFound()`. To OK na ten moment; weryfikacja: `/` przekierowuje, a `/login` jest osiągalny (nawet jako 404 — kluczowe że proxy nie redirectuje go w pętlę).

---

## Faza 3: Schema baseline (`supabase init` + pierwsza migracja)

### Przegląd

Inicjalizujemy lokalną strukturę `supabase/` przez CLI, piszemy pierwszą migrację z extensions + RLS helper, pushujemy do cloud.

### Wymagane zmiany

#### 1. Inicjalizacja Supabase CLI

**Plik**: `supabase/config.toml` (generowany), `supabase/.gitignore` (generowany)

**Cel**: Standardowa struktura `supabase/` z konfiguracją projektu. Powiązanie CLI z cloud projektem.

**Kontrakt**:
- Komenda: `npx supabase init` — tworzy `supabase/config.toml`, `supabase/seed.sql` (pusty), `supabase/.gitignore`
- Komenda: `npx supabase link --project-ref <ref>` — wymaga `SUPABASE_ACCESS_TOKEN` z dashboardu (lub interaktywnego loginu); zapisuje powiązanie w `supabase/.temp/` (już w `.gitignore`)
- `supabase/config.toml` zostaje z domyślnymi ustawieniami; nie modyfikujemy `[db.major_version]` ani innych pól w F-01

#### 2. Pierwsza migracja: extensions + RLS helper

**Plik**: `supabase/migrations/<timestamp>_init_auth_helpers.sql` (nowy, wygenerowany przez `npx supabase migration new init_auth_helpers`)

**Cel**: Włączyć extension `pg_trgm` (potrzebne dla FR-013 search w S-06 — preemptive, bo `CREATE EXTENSION` musi być w jednej z pierwszych migracji żeby uniknąć rollback dependencies). Utworzyć helper SQL `public.current_user_id()` zwracający `auth.uid()` jako `uuid`, z `SECURITY DEFINER STABLE` (wzorzec rekomendowany Supabase żeby PostgreSQL cachował wynik per query — kluczowe gdy RLS policy odwołuje się do tego helpera wielokrotnie). Dodać comment z konwencją RLS dla przyszłych tabel.

**Kontrakt**:
```sql
-- Włącz pg_trgm dla FR-013 (search) używane w S-06
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Helper RLS: zawija auth.uid() jako STABLE, dla wydajności w policies
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid()
$$;

COMMENT ON FUNCTION public.current_user_id() IS
  'Returns the authenticated user id (auth.uid()) for RLS policies. '
  'Convention: every per-user table in this project has RLS enabled '
  'and policies that filter by user_id = public.current_user_id().';

-- Grant execute do roli authenticated (Supabase default)
GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated, anon;
```

#### 3. Push migracji do cloud

**Plik**: brak (komenda)

**Cel**: Zaaplikować migrację w cloud projekcie.

**Kontrakt**: `npx supabase db push --linked` — wyświetla planowane migracje, prosi o potwierdzenie, aplikuje. Po pomyślnym apply tabela `supabase_migrations.schema_migrations` ma nowy wiersz z timestamp tej migracji.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `supabase/config.toml` istnieje
- `supabase/migrations/` zawiera dokładnie 1 plik `*_init_auth_helpers.sql`
- `npx supabase migration list --linked` pokazuje migrację jako applied (status `Remote ✓`)

#### Weryfikacja ręczna

- W Supabase Dashboard → Database → Extensions: `pg_trgm` jest `Enabled`
- W Database → Functions: `public.current_user_id` istnieje z definicją `STABLE SECURITY DEFINER`
- W SQL Editor: `SELECT public.current_user_id()` zwraca `NULL` (bez sesji) lub UUID po zalogowaniu (uruchamiamy w Phase 5 weryfikacji)

**Uwaga implementacyjna**: Po Fazie 3 zatrzymaj się na ręczne potwierdzenie w dashboardzie Supabase, że migracja została zaaplikowana, zanim przejdziesz do Fazy 4.

---

## Faza 4: Auth UI (`/login` + `/auth/callback` + `/` + sign-out)

### Przegląd

Server Component dla `/login` z formularzem + Server Action wysyłająca magic-link, Route Handler `/auth/callback` wymieniający PKCE code na sesję, zaktualizowana strona `/` z informacją o zalogowanym użytkowniku + Server Action sign-out, polskie mapowanie błędów `?error=<code>`.

### Wymagane zmiany

#### 1. Strona logowania

**Plik**: `src/app/login/page.tsx` (nowy)

**Cel**: Server Component renderujący prosty formularz z polem email i przyciskiem "Wyślij link logowania". Czyta `searchParams.error` i jeśli istnieje, pokazuje polski komunikat błędu nad formularzem. Czyta `searchParams.email` żeby pre-fill input gdy użytkownik wraca po błędzie. Czyta `searchParams.sent === '1'` żeby pokazać komunikat sukcesu "Wysłaliśmy link na <email> — sprawdź pocztę".

**Kontrakt**:
- Default export: `async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; email?: string; sent?: string }> })` (Next.js 16: searchParams jest Promise)
- `<form action={signInWithEmail}>` z `<input name="email" type="email" required autoFocus>`
- Mapowanie błędów (po stronie page.tsx, plain function):
  - `expired` → "Link wygasł. Wyślij sobie nowy."
  - `used` → "Ten link został już użyty. Wyślij sobie nowy."
  - `invalid` → "Link jest nieprawidłowy. Wyślij sobie nowy."
  - `cooldown` → "Poczekaj chwilę, zanim wyślesz kolejny link (limit Supabase)."
  - `unknown` lub inne → "Coś poszło nie tak. Spróbuj ponownie."
- Tailwind v4 — proste klasy mobile-first (mama używa telefon)
- Tekst po polsku

#### 2. Server Action sign-in

**Plik**: `src/app/login/actions.ts` (nowy)

**Cel**: `'use server'` action wywoływana z formularza. Czyta email z `FormData`, woła `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`, redirect na `/login?sent=1&email=<email>` po sukcesie lub `/login?error=cooldown&email=<email>` na rate-limit lub `/login?error=unknown&email=<email>` na inne błędy.

**Kontrakt**:
- Eksportuje `export async function signInWithEmail(formData: FormData): Promise<void>`
- Zaczyna od `'use server'`
- `emailRedirectTo` budowany jako `${getSiteUrl()}/auth/callback` gdzie `getSiteUrl()` to helper czytający `process.env.NEXT_PUBLIC_SITE_URL` z fallbackiem na `headers().get('origin')` (Vercel preview nie zna swojego URL przy buildzie — runtime detection)
- Walidacja email: prosta przez `z.email()` lub regex; pusty/zły email → `redirect('/login?error=invalid_email')` (dodaj ten klucz do mapowania w page.tsx: "Wpisz prawidłowy adres email.")
- Na sukces: `redirect(\`/login?sent=1&email=\${encodeURIComponent(email)}\`)`
- Na rate-limit (Supabase error z `status === 429` lub `code === 'over_email_send_rate_limit'`): `redirect(\`/login?error=cooldown&email=\${encodeURIComponent(email)}\`)`
- Na inne błędy: log do console.error + `redirect(\`/login?error=unknown&email=\${encodeURIComponent(email)}\`)`

**Helper**: `src/lib/site-url.ts` (nowy) z `export async function getSiteUrl(): Promise<string>` — runtime: env > headers.

#### 3. Route Handler callback

**Plik**: `src/app/auth/callback/route.ts` (nowy)

**Cel**: Odbiera GET request z `?code=<pkce>&next=/` (Supabase Auth podpisuje magic-link z PKCE code). Tworzy server client, woła `supabase.auth.exchangeCodeForSession(code)`, na sukces redirect na `next` lub `/`. Na błąd redirect na `/login?error=<mapped>`.

**Kontrakt**:
- Eksportuje `export async function GET(request: NextRequest): Promise<Response>`
- Czyta `code` i opcjonalny `next` z `request.nextUrl.searchParams`
- Brak `code` → redirect na `/login?error=invalid`
- `exchangeCodeForSession(code)` zwraca `data.session` i `error`
- Mapowanie błędów Supabase:
  - error code `otp_expired` → redirect `/login?error=expired`
  - error code `flow_state_expired` / `flow_state_not_found` → redirect `/login?error=expired`
  - error code zawierający `used` → redirect `/login?error=used`
  - inne → redirect `/login?error=unknown`
- Sukces → `redirect(next ?? '/')` — uwaga: `next` musi być relative URL (zaczynający się od `/` i nie zawierający `//`) żeby uniknąć open redirect. Walidacja: jeśli `next` nie matchuje `/^\/(?!\/)/` → użyj `/`.

#### 4. Strona główna z informacją o sesji + sign-out

**Plik**: `src/app/page.tsx` (nadpisz scaffold)

**Cel**: Server Component czytający `auth.users` z server clienta. Pokazuje "Zalogowano jako <email>" + przycisk "Wyloguj się" (`<form action={signOut}>` z Server Action). Tekst placeholder informujący że to fundament i prawdziwa strona główna przyjdzie w S-01.

**Kontrakt**:
- Default export: `async function HomePage()` (Server Component)
- `const supabase = await createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser();`
- Jeśli `user === null` — to nie powinno się zdarzyć (proxy by zredirectował), ale defensywnie `redirect('/login')`
- Render: prosty layout Tailwind, mobile-first, info `<p>Zalogowano jako {user.email}</p>`, formularz sign-out + komentarz `// TODO(S-01): lista przepisów zastąpi ten placeholder`

#### 5. Server Action sign-out

**Plik**: `src/app/(actions)/sign-out.ts` (nowy; grupa route `(actions)` żeby zgromadzić shared actions bez tworzenia segmentu URL)

**Cel**: `'use server'` action czyszcząca sesję Supabase i redirect na `/login`.

**Kontrakt**:
- Eksportuje `export async function signOut(): Promise<void>`
- Zaczyna od `'use server'`
- `await supabase.auth.signOut()` (revokuje token w Supabase, usuwa cookies poprzez adapter)
- `redirect('/login')`

#### 6. Metadata i językowy atrybut

**Plik**: `src/app/layout.tsx` (edycja)

**Cel**: Zmienić `<html lang="en">` na `<html lang="pl">` i zaktualizować `<title>`/`<description>` na "ZapiszPrzepis" — drobny, ale UX-relevant detal dla mamy (Android voice readers, browser search).

**Kontrakt**:
- `metadata.title`: `"ZapiszPrzepis"`
- `metadata.description`: `"Archiwum przepisów udostępnianych z mediów społecznościowych."`
- `<html lang="pl">`

### Kryteria sukcesu

#### Weryfikacja automatyczna

- TypeScript: `npx tsc --noEmit`
- ESLint: `npm run lint`
- `npm run build` przechodzi bez błędów (Server Actions, Route Handler, proxy wszystkie współgrają)
- Istnieją: `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/auth/callback/route.ts`, `src/app/(actions)/sign-out.ts`, `src/lib/site-url.ts`, zaktualizowane `src/app/page.tsx` i `src/app/layout.tsx`

#### Weryfikacja ręczna

- `npm run dev` → `http://localhost:3000` → proxy redirectuje na `/login` → widać formularz po polsku
- Wpisanie własnego emaila + submit → redirect na `/login?sent=1&email=...` → widać komunikat "Wysłaliśmy link na <email>"
- Email z magic-link przychodzi do skrzynki w < 1 min
- Klik linku → `/auth/callback?code=...` → redirect na `/` → widać "Zalogowano jako <email>" + "Wyloguj się"
- Próba ponownego wejścia na `/login` ze ważną sesją → proxy redirectuje na `/`
- Klik "Wyloguj się" → redirect na `/login` → ponowna próba wejścia na `/` redirectuje na `/login`
- Ręcznie wkleić zużyty magic-link → `/login?error=used` → widać polski komunikat
- Próba bez `code` w callbacku (`/auth/callback`) → `/login?error=invalid`
- Wyłączenie internetu i klik submit → `/login?error=unknown` (nie crash)

**Uwaga implementacyjna**: Po Fazie 4 zatrzymaj się na ręczne potwierdzenie pełnego flow end-to-end na localhost, zanim przejdziesz do Fazy 5 (deploy + smoke).

---

## Faza 5: Weryfikacja (smoke script + Vercel preview + dokumentacja)

### Przegląd

Skrypt smoke sprawdzający że env jest podpięty i Supabase REST odpowiada, pierwszy deploy na Vercel preview, ręczna weryfikacja flow na preview + aktualizacja README z manual steps.

### Wymagane zmiany

#### 1. Smoke script

**Plik**: `scripts/check-auth.ts` (nowy)

**Cel**: Skrypt Node uruchamiany przez `tsx scripts/check-auth.ts` (lub `npm run check:auth`). Czyta `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` z `.env.local`, woła `GET ${url}/auth/v1/health` z nagłówkiem `apikey: <anon>`, exit code 0 jeśli `200 { "name": "GoTrue", ... }`, exit code 1 z czytelnym błędem inaczej.

**Kontrakt**:
- Eksportuje (lub default-runs) main async function
- Używa Node `fetch` (Node ≥ 18, w `tsconfig` `"module": "esnext"`)
- Ładuje `.env.local` przez `node --env-file=.env.local` lub minimalny ręczny parser (preferowane: dotenv jest dodatkową zależnością; `--env-file` jest builtin od Node 20.6 — sprawdź `node -v` w README)
- Jeśli env brakuje → exit 1 z `console.error("Brak NEXT_PUBLIC_SUPABASE_URL w .env.local")`
- Jeśli fetch fail / non-200 → exit 1 z opisem
- Sukces → `console.log("✓ Supabase auth healthy: ${url}")` exit 0

**Plik**: `package.json` (edycja)

**Cel**: Dodać script `check:auth`.

**Kontrakt**: `"scripts": { ..., "check:auth": "node --env-file=.env.local --import tsx scripts/check-auth.ts" }`

#### 2. Vercel deploy + preview test

**Plik**: brak (manual steps)

**Cel**: Pierwszy deploy projektu na Vercel, weryfikacja że proxy + auth działają tam samo jak na localhost.

**Kontrakt**:
- Push branch → Vercel auto-deploy buduje preview na `https://<branch>-zapiszprzepis.vercel.app`
- `NEXT_PUBLIC_SITE_URL` na preview ustawiony tak żeby fallback działał (lub explicit dla `Preview` env w Vercel — patrz Faza 1)
- Po deploy: wejście na preview URL → redirect na `/login` → flow przechodzi end-to-end (przy założeniu że redirect URL wildcard jest w Supabase allowlist)

#### 3. README z manual steps

**Plik**: `README.md` (edycja — scaffold zostaje, dodajemy sekcję)

**Cel**: Dokumentacja kroków, których agent nie może zrobić sam: utworzenie Supabase project, skopiowanie URL/keys do `.env.local`, ustawienie env na Vercel, dodanie redirect URLs allowlist. Plus krótki "smoke" akapit jak sprawdzić że działa.

**Kontrakt**: nowa sekcja `## Setup` z numerowaną listą kroków manualnych. Sekcja `## Verification` z `npm run check:auth` i checklistą flow.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `npm run check:auth` exit 0 po wypełnieniu `.env.local`
- `npm run build` przechodzi
- `git status` pokazuje czystą sytuację (oprócz zaplanowanych nowych plików)

#### Weryfikacja ręczna

- Vercel preview deploy zielony
- Wejście na preview URL → redirect na `/login` → magic-link → klik → preview URL pokazuje "Zalogowano jako <email>"
- Wylogowanie na preview → redirect na `/login` (cookies wyczyszczone)
- README opisuje wszystkie manual steps wystarczająco że nowy programista (lub przyszły agent) odtworzy setup
- W Supabase Dashboard → Authentication → Users widać user (Twojego maila) — to potwierdzenie że `auth.users` ma row

**Uwaga implementacyjna**: Po Fazie 5 zatrzymaj się na potwierdzenie że WSZYSTKIE ręczne checki przeszły (localhost + preview); to znaczy że F-01 jest gotowy do mergowania i odblokowuje S-01.

---

## Strategia testowania

### Testy jednostkowe

Brak w F-01. Helpery (`getSiteUrl`, mapowanie błędów) są na tyle proste i wprost zależne od env/headers że jednostki nie dają wartości. Wprowadzimy Vitest formalnie w Module 3 zgodnie z roadmapą.

### Testy integracyjne

Brak w F-01. End-to-end manual ma więcej wartości na fundamencie (sprawdzamy realny flow magic-link przez prawdziwy SMTP).

### Kroki testowania ręcznego (skonsolidowana checklist)

1. **Localhost happy path**: `npm run dev` → `/` → redirect na `/login` → wpisz email → "Wysłaliśmy link" → klik link w skrzynce → "/" pokazuje "Zalogowano jako <email>"
2. **Localhost sign-out**: na `/` klik "Wyloguj się" → redirect na `/login` → próba wejścia na `/` redirectuje znów na `/login`
3. **Localhost zużyty link**: wklej już użyty link → `/login?error=used` → polski komunikat
4. **Localhost wygasły link**: poczekaj > 1h od wysłania → klik → `/login?error=expired`
5. **Localhost rate-limit**: kliknij submit 2× pod rząd na ten sam email w < 60s → drugi → `/login?error=cooldown`
6. **Localhost bez internetu**: wyłącz Wi-Fi → submit → `/login?error=unknown` (nie crash)
7. **Vercel preview** (po pierwszym deploy): powtórz kroki 1-2 na preview URL
8. **`npm run check:auth`** zwraca `✓ Supabase auth healthy: <url>` exit 0

## Uwagi dotyczące wydajności

- Proxy odpala się na każdym matchującym żądaniu. `supabase.auth.getUser()` w proxy robi 1 request do `${SUPABASE_URL}/auth/v1/user` z Bearer JWT. Latencja w EU: ~50-100ms. Dla mamy (1 user, jeden region, niskie qps) to niezauważalne. Optymalizacja (np. weryfikacja JWT lokalnie zamiast wywołania user endpoint) jest możliwa w przyszłości jeśli pojawi się problem; nie ma sensu w F-01.
- `pg_trgm` ma trywialny koszt instalacji extension (~ms). Helper `current_user_id()` jest `STABLE` więc PostgreSQL ewaluuje raz per query — koszt 0 w policies.

## Uwagi dotyczące migracji

Greenfield — brak danych do migracji. Pierwsza migracja jest baseline; przyszłe migracje (S-01: `recipes` table itd.) doklejają się jako nowe pliki w `supabase/migrations/`.

## Otwarte ryzyka i założenia

- **Pojedyncze środowisko Supabase oznacza brak izolacji dev/prod**: eksperymenty z testami auth zostawiają wpisy w `auth.users` które są również prod-row. Akceptowalne dla MVP (1 user docelowy, autor jest też dev). Refactor do split środowisk można zrobić w przyszłości bez zmiany kodu (tylko nowy projekt + nowe env vars).
- **Supabase domyślny SMTP ma limit ~3 emaili/godz dla nowych projektów**: dla testowania F-01 to wystarczy (4 testy magic-link na godzinę), ale jeśli intensywne debugowanie wymaga więcej, włącz custom SMTP (Resend / SendGrid free tier) w Supabase Settings → Auth → Email. Wraca jako opcja eskalacji, nie zmiana w planie.
- **`*-zapiszprzepis.vercel.app` wildcard wymaga że projekt jest spersonalizowany w Vercel jako `zapiszprzepis`**: jeśli pierwszy deploy nada inną nazwę (np. `zapiszprzepis-2`), trzeba zaktualizować Supabase allowlist. Niskie ryzyko — nazwa projektu Vercel jest predictable z `package.json#name` lub override w `vercel.json`.
- **`auth.users.email` jest jedynym źródłem prawdy o tożsamości użytkownika** — żadnej tabeli `profiles`. Jeśli S-01+ kiedyś potrzebuje display name / avatar / preferences, dodamy `public.profiles` wtedy. Decyzja w F-01: nie wyprzedzaj.

## Referencje

- PRD: `context/foundation/prd.md` (FR-001, Access Control)
- Roadmap: `context/foundation/roadmap.md` (F-01, §Ryzyko o redirect URLs)
- Tech-stack: `context/foundation/tech-stack.md`
- Next.js 16 proxy: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
- Next.js 16 cookies (async): `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`
- Next.js 16 forms / Server Actions: `node_modules/next/dist/docs/01-app/02-guides/forms.md`
- Supabase SSR for Next.js: https://supabase.com/docs/guides/auth/server-side/nextjs (wersja online — pamiętać o adaptacji `middleware.ts` → `proxy.ts`)
- Supabase signInWithOtp: https://supabase.com/docs/reference/javascript/auth-signinwithotp

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany. Nie zmieniaj nazw tytułów kroków.

### Faza 1: Bootstrap środowiska Supabase

#### Automatyczne

- [x] 1.1 `package.json` zawiera `@supabase/ssr`, `@supabase/supabase-js`, `supabase`, `tsx` — d0645b1
- [x] 1.2 `.env.local.example` istnieje i ma 3 wymagane klucze — d0645b1
- [x] 1.3 `.env.local` jest ignorowane przez git — d0645b1
- [x] 1.4 `npm run dev` startuje bez błędów importu — d0645b1

#### Ręczne

- [x] 1.5 Projekt Supabase widoczny w dashboardzie pod nazwą `zapiszprzepis`, region `eu-central-1` — d0645b1
- [x] 1.6 Redirect URLs allowlist zawiera 3 wpisy (localhost + 2× Vercel) — d0645b1
- [x] 1.7 `.env.local` lokalnie zawiera prawdziwe wartości — d0645b1
- [x] 1.8 Vercel ma 3 zmienne ustawione dla Production + Preview — d0645b1

### Faza 2: Klienty SSR + proxy

#### Automatyczne

- [x] 2.1 TypeScript się kompiluje: `npx tsc --noEmit` — 7a6fca3
- [x] 2.2 ESLint przechodzi: `npm run lint` — 7a6fca3
- [x] 2.3 `proxy.ts` istnieje na root projektu — 7a6fca3
- [x] 2.4 `src/lib/supabase/{server,client,proxy}.ts` istnieją — 7a6fca3
- [x] 2.5 `npm run build` przechodzi — 7a6fca3

#### Ręczne

- [x] 2.6 `npm run dev` → wejście na `/` przekierowuje na `/login` (307) — 7a6fca3
- [x] 2.7 Devtools Network potwierdza redirect 307 z `Location: /login` — 7a6fca3
- [x] 2.8 Próba wejścia na `/login` bez sesji nie powoduje pętli redirect — 7a6fca3

### Faza 3: Schema baseline

#### Automatyczne

- [x] 3.1 `supabase/config.toml` istnieje — ad898d6
- [x] 3.2 `supabase/migrations/` zawiera dokładnie 1 plik `*_init_auth_helpers.sql` — ad898d6
- [x] 3.3 `npx supabase migration list --linked` pokazuje migrację jako applied (Remote ✓) — ad898d6

#### Ręczne

- [x] 3.4 Supabase Dashboard → Database → Extensions: `pg_trgm` jest `Enabled` — ad898d6
- [x] 3.5 Database → Functions: `public.current_user_id` istnieje (`STABLE SECURITY DEFINER`) — ad898d6
- [x] 3.6 SQL Editor: `SELECT public.current_user_id()` zwraca NULL bez sesji — ad898d6

### Faza 4: Auth UI

#### Automatyczne

- [x] 4.1 TypeScript: `npx tsc --noEmit`
- [x] 4.2 ESLint: `npm run lint`
- [x] 4.3 `npm run build` przechodzi
- [x] 4.4 Istnieją wymagane pliki UI (`login/page.tsx`, `login/actions.ts`, `auth/callback/route.ts`, `(actions)/sign-out.ts`, `lib/site-url.ts`)

#### Ręczne

- [x] 4.5 `npm run dev` → `/` → redirect na `/login` → widać polski formularz
- [x] 4.6 Submit emaila → `/login?sent=1&email=...` → polski komunikat sukcesu
- [x] 4.7 Magic-link przychodzi do skrzynki w < 1 min
- [x] 4.8 Klik linku → `/auth/callback?code=...` → redirect na `/` → "Zalogowano jako <email>"
- [x] 4.9 Próba wejścia na `/login` ze ważną sesją → redirect na `/`
- [x] 4.10 "Wyloguj się" → `/login`; ponowna próba wejścia na `/` redirectuje na `/login`
- [x] 4.11 Zużyty link → `/login?error=used` → polski komunikat
- [x] 4.12 Brak `code` w callbacku → `/login?error=invalid`
- [x] 4.13 Bez internetu submit → `/login?error=unknown` (nie crash)

### Faza 5: Weryfikacja

#### Automatyczne

- [ ] 5.1 `npm run check:auth` exit 0 po wypełnieniu `.env.local`
- [ ] 5.2 `npm run build` przechodzi
- [ ] 5.3 `git status` pokazuje tylko zaplanowane nowe pliki

#### Ręczne

- [ ] 5.4 Vercel preview deploy zielony
- [ ] 5.5 Preview URL: pełny flow magic-link → `/` z "Zalogowano jako <email>"
- [ ] 5.6 Preview URL: wylogowanie czyści cookies (ponowna próba `/` → `/login`)
- [ ] 5.7 README opisuje wszystkie manual steps
- [ ] 5.8 Supabase Dashboard → Authentication → Users widać autora jako wpis w `auth.users`
