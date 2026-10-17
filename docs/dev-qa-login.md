# Konto QA do weryfikacji ekranów zalogowanego (dev-only)

Agenci (i ludzie) sprawdzają ekrany zalogowanego użytkownika na **lokalnym dev serwerze** bez wpisywania i udostępniania haseł. Wprowadzone w PR #264.

## Szybki start

1. `.env.local` musi zawierać (oprócz `SUPABASE_SERVICE_ROLE_KEY`):
   ```
   DEV_LOGIN_ENABLED=1
   DEV_LOGIN_EMAIL_FULL=qa-full@zapiszprzepis.pl
   DEV_LOGIN_EMAIL_FREE=qa-free@zapiszprzepis.pl
   ```
   W głównym checkoucie (`C:\Users\spoko\www\zapiszprzepis\.env.local`) już są. W worktree agenta `.env.local` nie istnieje — skopiuj go z głównego checkoutu (plik jest w `.gitignore`, nie commituj go).
2. Uruchom dev (`pnpm dev`, albo `pnpm exec next dev -p <port>`, gdy 3000 jest zajęty przez inną sesję).
3. Otwórz w przeglądarce:

| URL | Konto | Stan |
|---|---|---|
| `/api/dev/login?as=full&next=/ścieżka` | `qa-full@zapiszprzepis.pl` | pełny dostęp (kod dostępu zrealizowany 2026-10-17) — „Moje przepisy”, „Dodaj przepis” |
| `/api/dev/login?as=free&next=/ścieżka` | `qa-free@zapiszprzepis.pl` | bez pełnego dostępu — ulubione, galeria, zablokowany kafel „Dodaj przepis” (bramka 3c) |

`as` domyślnie `full`. `next` przechodzi przez `safeNext` (tylko ścieżki w obrębie aplikacji). Drugi URL nadpisuje sesję, więc przełączanie kont to po prostu otwarcie innego linku.

Obu kontom nie ustawiono nazwy ani płci — powitanie to „Dzień dobry!” bez imienia.

## Jak to działa

1. `devLoginEmail()` (`src/lib/dev-login.ts`) zwraca mail konta albo `null` → **404**. Warunki: `NODE_ENV === 'development'` **i** `DEV_LOGIN_ENABLED=1` **i** ustawiony `DEV_LOGIN_EMAIL_*` dla danej roli. `next build` zawsze ustawia `NODE_ENV=production`, więc na produkcji route nie istnieje.
2. Klient service role woła `auth.admin.generateLink({ type: 'magiclink', email })` — Supabase zwraca jednorazowy token (ten sam, co w mailu z linkiem logującym). **Mail nie jest wysyłany.**
3. Bezpiecznik: `generateLink` po cichu zakłada konto dla nieznanego maila. Niepotwierdzone konto → **409**, bez logowania (literówka w `.env.local` nie zaloguje na świeże, przypadkowe konto — usuń je wtedy w Dashboardzie).
4. Klient SSR weryfikuje token (`verifyOtp`) i zapisuje ciasteczka sesji — to prawdziwa sesja, więc middleware, RLS i `has_full_access()` działają normalnie.
5. Przekierowanie na `next`. `middleware.ts` przepuszcza gościa na `/api/dev/login`.

## Kody odpowiedzi

| Kod | Znaczenie | Co zrobić |
|---|---|---|
| 307 | zalogowano, przekierowanie na `next` | — |
| 404 | route wyłączony (nie dev / brak flagi / brak maila) | sprawdź `.env.local` i restart dev; jeśli nie da się — zgłoś ekran jako niezweryfikowany |
| 409 | mail nie jest potwierdzonym kontem | sprawdź `DEV_LOGIN_EMAIL_*`; powiedz właścicielowi |
| 500 | błąd Supabase (generateLink / verifyOtp) | treść błędu w JSON odpowiedzi |

## Zasady (ważne)

- **Lokalny dev działa na produkcyjnej bazie Supabase.** Ulubione, galeria i inne zapisy kont QA to prawdziwe wiersze — trzymaj je minimalne i cofaj po teście (np. odznacz serce).
- **Nigdy nie dodawaj przepisów jako konto QA** — trafiłyby do publicznego katalogu.
- Agent nie zakłada, nie usuwa ani nie zmienia kont QA — robi to właściciel w Supabase Dashboard.
- Nie dodawaj tych zmiennych do Cloudflare ani do żadnego środowiska poza lokalnym `.env.local`.

## Odtworzenie kont (gdyby trzeba było)

1. Supabase Dashboard → **Authentication → Users → Add user → Create new user**, mail jak wyżej, dowolne hasło (nikt go nie używa), **zaznacz „Auto Confirm User”**.
2. Pełny dostęp dla `qa-full`: wygeneruj jednorazowy kod, np. przez Management API / SQL Editor:
   ```sql
   select public.create_access_code('<12 losowych znaków>', 1, now() + interval '1 day', 'QA account qa-full');
   ```
   potem zaloguj się przez `/api/dev/login?as=full` i wpisz kod w polu „Kod dostępu” na stronie głównej.
3. Sprawdzenie stanu:
   ```sql
   select u.email, u.email_confirmed_at is not null as confirmed, f.source
   from auth.users u left join public.user_full_access f on f.user_id = u.id
   where u.email like 'qa-%@zapiszprzepis.pl';
   ```
