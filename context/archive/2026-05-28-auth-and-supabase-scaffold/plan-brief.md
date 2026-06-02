# Supabase scaffold + magic-link auth (F-01) — Krótki plan

> Pełny plan: `context/changes/auth-and-supabase-scaffold/plan.md`
> Roadmap: `context/foundation/roadmap.md` (F-01)
> PRD: `context/foundation/prd.md` (FR-001, Access Control)

## Co i dlaczego

Bootstrap projektu Supabase z passwordless magic-link auth dla ZapiszPrzepis — fundament F-01 z roadmapy. Bez tego żaden wycinek per-użytkownik (S-01 i dalej) nie może zapisać przepisu w imieniu mamy. PRD lockuje passwordless magic-link, jeden e-mail → jedno konto → prywatna skrzynka, sesję długo-żyjącą; tu dostarczamy minimum funkcjonalne pod te wymagania.

## Punkt wyjścia

Świeży scaffold Next.js 16.2.6 (App Router) + TypeScript + Tailwind v4 + ESLint. W repo tylko `src/app/{layout.tsx,page.tsx,globals.css}` — brak `src/app/api/`, `proxy.ts`, `supabase/`, brak SDK Supabase w `package.json`. Tech-stack deklaruje magic-link Supabase + Vercel, ale niewpięte. AGENTS.md ostrzega: *"This is NOT the Next.js you know"* — i rzeczywiście, v16 zmieniła `middleware.ts` → `proxy.ts` i `cookies()` jest async.

## Pożądany stan końcowy

Po wejściu na `/` bez sesji proxy redirectuje na `/login`. Po wpisaniu emaila i kliku magic-linka z poczty użytkownik trafia na `/` z napisem "Zalogowano jako <email>" i przyciskiem "Wyloguj się". Sesja przeżywa nawigacje (proxy odświeża token); wylogowanie czyści cookies i wraca na `/login`. Pierwsza migracja Supabase ma extension `pg_trgm` + helper RLS `public.current_user_id()` — żadnych własnych tabel. Wszystko działa identycznie na localhost i na Vercel preview (jeden projekt Supabase z allowlist obejmującą oba środowiska).

## Kluczowe podjęte decyzje

| Decyzja                        | Wybór                                                | Dlaczego (1 zdanie)                                                                                                          | Źródło |
| ------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| Lokalne dev środowisko         | Cloud-only, jeden projekt Supabase                   | Windows bez Dockera; `target_scale.users: small` nie uzasadnia split dev/prod; CLI działa cloud-only bez Dockera.            | Plan   |
| Zakres schematu w F-01         | Tylko `pg_trgm` + helper RLS `current_user_id()`, zero tabel | Tabele aplikacyjne (`recipes` etc.) należą do S-01 wg roadmapy; helper i extension są preemptive bo migracje porządkowane chronologicznie. | Plan   |
| Wzorzec sign-in                | Server Action z formularza (`<form action={signInWithEmail}>`) | Idiomatyczny Next.js 16 App Router, progressive enhancement, mniej kodu, brak client state.                                  | Plan   |
| Zakres UI auth                 | `/login` + `/auth/callback` + placeholder `/` z sign-out | Minimum do weryfikacji pełnego cyklu; S-01 i tak przepisze `/` na listę przepisów.                                          | Plan   |
| Konfiguracja sesji             | Default Supabase (1h JWT + 30d refresh) + dynamic redirect z `request.url` lub `NEXT_PUBLIC_SITE_URL` | Standard wystarcza gdy proxy silent-refreshuje na każde żądanie; whitelist wildcard `*-zapiszprzepis.vercel.app` rozwiązuje preview deploys. | Plan   |
| Obsługa błędów magic-link      | Polski komunikat na `/login?error=expired\|used\|invalid\|cooldown\|unknown` + pre-fill emaila | PRD Guardrail "żadne żądanie nie ginie cicho" + UX dla niedoświadczonej technicznie mamy.                                    | Plan   |
| Testowanie                     | Ręczna e2e + smoke `npm run check:auth`              | Solo dev after-hours, 4 tygodnie MVP; Moduł 3 wprowadzi testy formalnie.                                                    | Plan   |
| `middleware.ts` vs `proxy.ts`  | `proxy.ts` (Next.js 16 rename)                       | v16 deprecated `middleware.ts`; AGENTS.md ostrzega o właśnie takich różnicach vs trening modelu.                            | Plan   |

## Zakres

**W zakresie:**
- Jeden cloud projekt Supabase + env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`)
- SDK: `@supabase/ssr`, `@supabase/supabase-js`, CLI `supabase` (devDep)
- Klienty SSR: `src/lib/supabase/{server,client,proxy}.ts`
- `proxy.ts` na root z silent-refresh i redirect logic
- Pierwsza migracja: `pg_trgm` + `public.current_user_id()`
- `/login` (Server Component + Server Action), `/auth/callback` (Route Handler PKCE), `/` (sesja + sign-out), polskie mapowanie błędów
- Smoke script `scripts/check-auth.ts` + `npm run check:auth`
- README z manual steps (Supabase project setup, env, allowlist, Vercel env)

**Poza zakresem:**
- Własne tabele aplikacyjne (`recipes`, kategorie, etc.) — to S-01
- Tabela `public.profiles` — niewymagana w PRD, e-mail żyje w `auth.users`
- Push notifications, OTP via SMS, social login, MFA, password auth
- Vitest unit testy + Playwright e2e — Moduł 3
- Osobny "setup mode" dla autora — flow jest identyczny dla autora i mamy
- Custom JWT TTL / custom SMTP — defaulty Supabase wystarczają dla MVP
- Lokalny Supabase via Docker — pominięty (Windows bez Dockera)
- Split dev/prod Supabase — jeden projekt dla MVP

## Architektura / Podejście

```
Browser (mama)
   │
   │ GET / (bez sesji)
   ▼
proxy.ts  ──► updateSession() ──► Supabase Auth (getUser)
   │             │
   │             └── user == null → redirect /login
   ▼
/login (Server Component)
   │
   │ <form action={signInWithEmail}>
   ▼
signInWithEmail (Server Action, 'use server')
   │
   │ supabase.auth.signInWithOtp({ email, emailRedirectTo })
   ▼
Supabase Auth ──► email z magic-link ──► mama klika
                                                │
                                                ▼
                                  /auth/callback?code=PKCE
                                                │
                                                │ exchangeCodeForSession(code)
                                                ▼
                                  Set-Cookie + redirect /
                                                │
                                                ▼
proxy.ts (z sesją) ──► silent refresh ──► / (Server Component)
                                                │
                                                ▼
                              "Zalogowano jako <email>" + <form action={signOut}>
```

Pięć faz: (1) Bootstrap środowiska — projekt cloud + env + deps + CLI + allowlist. (2) Klienty SSR + `proxy.ts`. (3) `supabase init` + pierwsza migracja `pg_trgm` + helper RLS, push do cloud. (4) Auth UI — login + callback + sign-out + placeholder `/` + polskie błędy. (5) Smoke script + Vercel preview test + README.

## Fazy w skrócie

| Faza                          | Co dostarcza                                                | Kluczowe ryzyko                                                          |
| ----------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1. Bootstrap środowiska       | Cloud projekt Supabase + env + SDK + CLI + allowlist        | Wymaga manual steps w dashboardzie Supabase i Vercel.                    |
| 2. Klienty SSR + `proxy.ts`   | Helpery klientów + `proxy.ts` z silent-refresh i redirect logic | Pułapka: `middleware.ts` → `proxy.ts` w v16; cookies async; setAll w proxy musi propagować na request i response. |
| 3. Schema baseline            | `supabase init` + migracja z `pg_trgm` + `current_user_id()` | Niskie ryzyko; ale `supabase link` wymaga `SUPABASE_ACCESS_TOKEN` lub interaktywnego loginu. |
| 4. Auth UI                    | `/login`, `/auth/callback`, `/` + sign-out, polskie błędy   | Mapowanie kodów błędów Supabase na polskie komunikaty wymaga przetestowania każdej ścieżki. |
| 5. Weryfikacja                | Smoke script + Vercel preview test + README                 | Vercel preview URL musi pasować do wildcard w Supabase allowlist (`*-zapiszprzepis.vercel.app`). |

**Wymagania wstępne:**
- Konto Supabase z dostępem do tworzenia nowych projektów (free tier wystarczy)
- Konto Vercel powiązane z repo GitHub
- Email do testów magic-link
- Node ≥ 20.6 lokalnie (potrzebne dla `--env-file` w smoke script)

**Szacowany nakład pracy:** ~1-2 sesje (after-hours), 5 faz; każda faza ma weryfikację przed kontynuowaniem.

## Otwarte ryzyka i założenia

- **Pojedyncze środowisko Supabase oznacza brak izolacji dev/prod** — eksperymenty zostawiają dane w prod. Akceptowalne dla MVP (1 user docelowy, autor jest też dev).
- **Supabase domyślny SMTP limituje ~3 emaile/godz** dla nowych projektów — wystarcza do testów, ale intensywne debugowanie może wymagać włączenia custom SMTP (Resend/SendGrid).
- **Wildcard `*-zapiszprzepis.vercel.app`** zakłada że Vercel nada projektowi nazwę `zapiszprzepis` (z `package.json#name`); jeśli będzie inna, trzeba zaktualizować allowlist.
- **Brak tabeli `public.profiles`** — jeśli S-01+ kiedyś potrzebuje display name/avatar, dodajemy wtedy.

## Kryteria sukcesu (podsumowanie)

- Mama (autor jako proxy) wchodzi na produkcyjny URL → redirect na `/login` → wpisuje email → dostaje link na email → klika → trafia na `/` z napisem "Zalogowano jako <email>". Pełny cykl działa na localhost i na Vercel preview.
- W Supabase Dashboard → Authentication → Users widać autora jako wpis w `auth.users` (potwierdzenie że tabela istnieje i że passwordless flow utworzył row).
- F-01 jest gotowy do mergowania i odblokowuje S-01 (gwiazda północna): kolejny wycinek doda tabelę `recipes` z RLS `user_id = public.current_user_id()` i już ma działającą sesję.
