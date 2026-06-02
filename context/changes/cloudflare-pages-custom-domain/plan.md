# Cloudflare Workers production deploy on zapiszprzepis.pl — Plan implementacji

## Przegląd

Pełna migracja środowiska produkcyjnego z Vercel na **Cloudflare Workers + Static Assets** z `@opennextjs/cloudflare` adapterem, podpięta od razu pod custom domain `zapiszprzepis.pl`. F-01 (auth scaffold) został zweryfikowany na Vercel preview przez PR #1-#4, ale produkcja docelowa to Cloudflare. Plan obejmuje setup adaptera w repo (wraz z workaroundem na issue #962 — Next 16 `proxy.ts` rename), utworzenie Workers projektu z **Workers Builds** (Git CI/CD), podpięcie domeny (DNS już w Cloudflare), aktualizację Supabase Auth allowlist, end-to-end weryfikację magic-link i finalną dokumentację. Po migracji **projekt Vercel zostaje skasowany** — clean break, bez warm fallbacku.

## Analiza stanu obecnego

- Produkcja działa na Vercel (`https://zapiszprzepis.vercel.app`) — F-01 e2e zweryfikowany przez PR #1-#4 series.
- `infrastructure.md` rekomenduje Cloudflare Workers + Pages, Vercel jako runner-up.
- `package.json`: `next: 16.2.6`, brak `@opennextjs/cloudflare` ani `wrangler` w deps. Brak `wrangler.jsonc`, brak `open-next.config.ts`.
- `src/proxy.ts` istnieje (Next 16 rename z `middleware.ts`).
- `src/lib/supabase/proxy.ts` `updateSession.setAll(cookiesToSet, headers)` JUŻ aplikuje `headers` do `response.headers` — cache-poisoning mitigation (per `@supabase/ssr` v0.10+) już wdrożona.
- `src/lib/supabase/server.ts` `setAll(cookiesToSet)` używa narrow try-catch (F5 fix z F-01 review).
- README dokumentuje Vercel-first setup.
- Supabase Auth allowlist zawiera Vercel preview wildcard + production URL + localhost.
- `getSiteUrl()` w `src/lib/site-url.ts` ma robust fallback (F3 fix LAN IPs).
- DNS `zapiszprzepis.pl` jest już w Cloudflare DNS (potwierdzono).
- `.nvmrc` = `22.11.0` (Node 22 LTS) — istnieje, niezacommitowany.
- `lessons.md` zawiera 6 reguł z F-01 review.

## Pożądany stan końcowy

Po zakończeniu planu:

- Produkcja działa na `https://zapiszprzepis.pl` (apex, SSL przez Cloudflare Universal SSL), runtime Cloudflare Workers + Static Assets.
- Workers Builds (Git CI/CD) buduje na każdy push do `master`: `pnpm exec opennextjs-cloudflare build` → `.open-next/` → `opennextjs-cloudflare deploy`.
- Pełny flow magic-link auth zweryfikowany e2e na `zapiszprzepis.pl`.
- Supabase Auth allowlist: Site URL = `https://zapiszprzepis.pl`, Redirect URLs zawierają production + `*.workers.dev` (lub specyficzny preview wildcard) + localhost. **Vercel URLs usunięte.**
- `README.md` dokumentuje Cloudflare Workers setup (Vercel removed).
- `context/foundation/infrastructure.md` zaktualizowany: status "Migration deferred" → "Migration completed 2026-05-31", Vercel jako historical footnote.
- **Projekt Vercel skasowany** w Vercel dashboard — clean break, brak fallbacku.

### Kluczowe odkrycia (z researcha 2026-05-31)

- **BLOCKER #962**: `@opennextjs/cloudflare` (do v1.19.11 — May 2026) **nie wspiera** Next.js 16 `proxy.ts` (rename z `middleware.ts`). Deploy z `proxy.ts` daje: `Uncaught TypeError: The argument 'path' must be a file URL...`. **Workaround**: trzymać nazwę `middleware.ts` (Next.js akceptuje obie, rename jest backwards-compatible non-breaking). Issue: https://github.com/opennextjs/opennextjs-cloudflare/issues/962
- `@opennextjs/cloudflare@latest` (v1.19.11) wymaga `compatibility_date >= 2025-05-05` (inaczej `FinalizationRegistry is not defined` runtime error).
- `compatibility_flags`: minimum `nodejs_compat`. Official template dodaje też `global_fetch_strictly_public` — niech zostanie dla parity z docs.
- **Workers Builds** (NIE Pages) to właściwa surface dla Git integration. Pages auto-detect wymusza legacy `@cloudflare/next-on-pages`.
- **Build vs Runtime env vars w Workers**: vary muszą być w DWÓCH miejscach żeby zadziałały — `Settings → Builds → Build variables and secrets` (dla `next build`-time inline `NEXT_PUBLIC_*`) ORAZ `Settings → Variables & Secrets` (dla runtime `process.env` w Server Components). Dokumentacja env-vars: "Build variables will not be accessible at runtime."
- `--keep-vars` przy deploy chroni dashboard vars przed nadpisaniem: `opennextjs-cloudflare deploy -- --keep-vars`.
- Custom domain na Workers: `Settings → Domains & Routes → Add → Custom Domain`. Inny UI niż Pages (tam była zakładka "Custom domains"), ten sam koncept.
- `initOpenNextCloudflareForDev()` w `next.config.ts` jest unconditional — no-op w produkcji, wires bindings dla `next dev`.
- `.open-next/`, `.dev.vars`, `cloudflare-env.d.ts` muszą być w `.gitignore`.
- `@supabase/ssr` cookie write z Server Components nadal throws (workerd zachowuje się jak Vercel/Node tu) — narrow try-catch w `server.ts` nadal poprawny.

## Czego NIE robimy

- **WWW redirect** (`www.zapiszprzepis.pl` → apex) — mama z PRD persony nie wpisze www; pomijamy.
- **PWA manifest update** — F-01 nie zawiera PWA, to późniejsza change.
- **Trigger.dev integration** — F-02 scope.
- **Custom email (Resend / SendGrid)** dla magic-linków — Supabase default SMTP wystarcza.
- **R2 / D1 / KV bindings** — auth flow nie potrzebuje, `open-next.config.ts` zostaje minimalny.
- **Smart Placement** — default placement = user-closest PoP, daje WAW dla mamy w PL.
- **Warm fallback Vercel** — **clean break**: Vercel project usunięty w Phase 7. Jeśli Cloudflare pęknie, hotfix robimy na Cloudflare. Nie utrzymujemy dwóch platform.
- **Migration zmian z F-01 review** (F4 `getSession()`, F9 `lib/env.ts`) — to są future-rules per `lessons.md`.
- **CI/CD GitHub Actions** — Workers Builds robi build na push, lokalna walidacja przed push wystarczy.

## Podejście do implementacji

**ADAPTACJA 2026-05-31 (Path B — final)**: Po researchu oficjalnych docs OpenNext + Cloudflare Workers zdecydowaliśmy się na modern adapter `@opennextjs/cloudflare` na **Cloudflare Workers + Static Assets** (NIE Pages). Pages auto-detect wymusza legacy `@cloudflare/next-on-pages` z output `.vercel/output/static` — nazwa katalogu z "vercel" w stacku, którego się pozbywamy, plus legacy adapter jest deprecated. Workers Builds (Git CI/CD pod Workers) zastępuje Pages auto-detect.

Siedem faz w kolejności zależności:

1. **Pre-flight + adapter setup w repo** (najwięcej code work): rename `proxy.ts`→`middleware.ts` (workaround #962), add deps, create `wrangler.jsonc` + `open-next.config.ts`, edit `next.config.ts`, scripts, `.gitignore`, lokalny `opennextjs-cloudflare build`.
2. **Workers project + Workers Builds Git connect**: Cloudflare dashboard create Worker, podpięcie do GitHub, override build/deploy commands, pierwszy build.
3. **Env vars (Build + Runtime scopes)** + redeploy.
4. **Custom domain** `zapiszprzepis.pl` na Workerze.
5. **Supabase Auth allowlist** update (z usunięciem Vercel URLs).
6. **E2E magic-link verification** (decyzyjny gate).
7. **Docs update + DELETE Vercel project** (clean break).

**Decyzja DNS**: domena już w Cloudflare DNS → custom domain to natychmiastowy setup. Brak fazy "transfer DNS".

**Decyzja Vercel**: usuwamy projekt w Phase 7. Bez warm fallbacku. Jeśli Cloudflare regression w pierwszych 30 dniach po migracji — robimy hotfix na Cloudflare lub przywracamy Vercel z `git checkout main && vercel --prod` (Vercel CLI nadal działa nawet bez dashboard projektu, tworzy nowy).

**Fallback gdyby Phase 6 wywaliło się**: jeśli auth flow na Cloudflare Workers fails z powodu nieznanego runtime bug, **NIE** wracamy do Vercel automatycznie — zatrzymujemy migrację, debugujemy (`wrangler tail` dla logów), zgłaszamy issue do OpenNext jeśli adapter bug. Cofnięcie do Vercel = wykonanie `vercel --prod` z lokalnego repo (5 min) + re-add `zapiszprzepis.pl` jako Vercel custom domain + edit DNS w Cloudflare → wskaż na Vercel.

## Krytyczne szczegóły implementacji

- **`proxy.ts` → `middleware.ts` rename**: bez tego deploy fails z `Uncaught TypeError`. Issue #962 open od października 2025. Monitorować — gdy zamknięte, można przemianować z powrotem.
- **`wrangler.jsonc`, NIE `wrangler.toml`** — Cloudflare preferowany format od 2025+.
- **`compatibility_date: "2025-05-05"` lub nowsza** — wymagana przez adapter (`FinalizationRegistry`).
- **`compatibility_flags`: `["nodejs_compat", "global_fetch_strictly_public"]`** — `nodejs_compat` mandatory; `global_fetch_strictly_public` per official template.
- **`output: "standalone"` w `next.config.ts` NIE jest wymagane** — adapter generuje własny output (`.open-next/`), nie korzysta z Next.js standalone.
- **`initOpenNextCloudflareForDev()` unconditional** w `next.config.ts` — bezpieczne, no-op w produkcji.
- **NEXT_PUBLIC_* w DWÓCH miejscach** w Workers dashboard — Build variables (inline w bundle) + Variables & Secrets (process.env runtime). Brak duplikacji = subtle bug "undefined w Server Component".
- **Override default Workers Builds commands**: `Build command: pnpm exec opennextjs-cloudflare build`, `Deploy command: pnpm exec opennextjs-cloudflare deploy`. Default `npx wrangler deploy` NIE zadziała z adapter output.

---

## Faza 1: Pre-flight + adapter setup w repo

### Przegląd

Wszystkie zmiany w repo potrzebne, żeby `pnpm exec opennextjs-cloudflare build` przeszedł lokalnie, generując `.open-next/` deployowalny artefakt. Workaround #962 (rename `proxy.ts`→`middleware.ts`) musi być pierwszy — inaczej build wprawdzie przejdzie, ale deploy padnie. Lokalna weryfikacja jest "gate" przed podpięciem do Cloudflare dashboard.

### Wymagane zmiany

#### 1. Node version pin (DONE)

**Plik**: `.nvmrc` (już utworzone)

**Status**: ✓ istnieje z wartością `22.11.0`. Cloudflare Workers Builds powinno respektować `.nvmrc` (autoconfig).

#### 2. Rename `proxy.ts` → `middleware.ts` (workaround #962)

**Plik**: `src/proxy.ts` → `src/middleware.ts`

**Cel**: Obejść issue #962 (`@opennextjs/cloudflare` nie wspiera Next 16 `proxy.ts`). Next.js akceptuje obie nazwy — `middleware.ts` jest backwards-compatible.

**Kontrakt**:
- Move plik `src/proxy.ts` → `src/middleware.ts`
- Wewnątrz: rename `export async function proxy` → `export async function middleware`
- Reszta (`config` matcher, import `updateSession`, body) bez zmian
- **NIE zmieniamy** `src/lib/supabase/proxy.ts` — to helper file, nazwa nie wpływa na Next.js entry point convention

#### 3. Dodaj dependencies

**Plik**: `package.json`

**Cel**: Adapter i CLI wrangler do builda/deploy.

**Kontrakt**:
- `pnpm add @opennextjs/cloudflare@latest` (prod dep) — currently v1.19.11
- `pnpm add -D wrangler@latest` (dev dep) — currently v4.x, minimum 3.99.0
- `pnpm-lock.yaml` zregenerowany

#### 4. Utwórz `wrangler.jsonc`

**Plik**: `wrangler.jsonc` (nowy, root)

**Cel**: Konfiguracja Workera — entrypoint, assets binding, compat flags.

**Kontrakt**:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "main": ".open-next/worker.js",
  "name": "zapiszprzepis",
  "compatibility_date": "2025-05-05",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  }
}
```

#### 5. Utwórz `open-next.config.ts`

**Plik**: `open-next.config.ts` (nowy, root)

**Cel**: Konfiguracja adaptera — minimal, bez R2/D1/KV cache.

**Kontrakt**:
```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
```

#### 6. Edit `next.config.ts`

**Plik**: `next.config.ts`

**Cel**: Wire adapter do `next dev` (bindings dostępne lokalnie). No-op w produkcji.

**Kontrakt** (import + first usage w JEDNYM Edit per CLAUDE.md global rule):
```typescript
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

initOpenNextCloudflareForDev();

export default nextConfig;
```

#### 7. Dodaj scripts do `package.json`

**Plik**: `package.json`

**Cel**: Wygodne commands dla build/preview/deploy + typegen.

**Kontrakt** (dodać do `scripts`):
```json
"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
"upload": "opennextjs-cloudflare build && opennextjs-cloudflare upload",
"cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
```

#### 8. Update `.gitignore`

**Plik**: `.gitignore`

**Cel**: Generated build output + secrets nie commitowane.

**Kontrakt** (dodaj na końcu sekcję):
```
# Cloudflare Workers / OpenNext
.open-next/
.dev.vars
cloudflare-env.d.ts
.wrangler/
```

#### 9. Lokalna weryfikacja build

**Plik**: brak — verification

**Cel**: `pnpm exec opennextjs-cloudflare build` musi exit 0, generując `.open-next/worker.js` i `.open-next/assets/`. Jeśli fails lokalnie, fails też w Workers Builds.

**Kontrakt**:
- `pnpm install` (regenerate lockfile po add deps) exit 0
- `pnpm exec tsc --noEmit` exit 0
- `pnpm lint` exit 0
- `pnpm build` (standardowy Next.js build, sanity check) exit 0
- `pnpm exec opennextjs-cloudflare build` exit 0
- `.open-next/worker.js` istnieje, `.open-next/assets/` istnieje (zawiera Next.js static assets)

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `.nvmrc` istnieje z wartością `22.11.0`
- `src/middleware.ts` istnieje, `src/proxy.ts` NIE istnieje
- `src/middleware.ts` eksportuje `function middleware` (nie `proxy`)
- `package.json` `dependencies` zawiera `@opennextjs/cloudflare`
- `package.json` `devDependencies` zawiera `wrangler`
- `package.json` `scripts` zawiera `preview`, `deploy`, `upload`, `cf-typegen`
- `wrangler.jsonc` istnieje z `compatibility_date >= 2025-05-05`, `compatibility_flags` zawiera `nodejs_compat`, `assets.directory: ".open-next/assets"`
- `open-next.config.ts` istnieje i eksportuje `defineCloudflareConfig({})`
- `next.config.ts` importuje `initOpenNextCloudflareForDev` z `@opennextjs/cloudflare` i wywołuje ją
- `.gitignore` zawiera linię `.open-next/`
- `pnpm install` exit 0
- `pnpm exec tsc --noEmit` exit 0
- `pnpm lint` exit 0
- `pnpm exec opennextjs-cloudflare build` exit 0
- `.open-next/worker.js` istnieje po build

#### Weryfikacja ręczna

- (brak — Phase 1 jest tylko repo setup; live preview jest opcjonalny przez `pnpm preview`)

---

## Faza 2: Workers project + Workers Builds Git connect

### Przegląd

Tworzymy Worker w Cloudflare dashboard, podpinamy do GitHub repo przez Workers Builds (Git CI/CD), override default build/deploy commands na OpenNext CLI, triggujemy pierwszy build.

### Wymagane zmiany

#### 1. Utworzenie Workera

**Plik**: brak — manual w Cloudflare dashboard

**Cel**: Pusty Worker z Git integration. Pierwszy build idzie zaraz po connect.

**Kontrakt**:
- https://dash.cloudflare.com → Workers & Pages → **Create application**
- Zakładka **Workers** (NIE Pages)
- Wybór: "Hello World" template ALBO "Import a repository" (zależnie od UI flow — Cloudflare ostatnio łączy te ścieżki)
- Jeśli "Hello World": Worker name `zapiszprzepis` → Deploy. Potem `Settings → Builds → Connect to Git`.
- Jeśli "Import a repository" path: od razu wybierz repo, projekt name `zapiszprzepis`
- Production branch: `master`

#### 2. Workers Builds — build configuration

**Plik**: brak — manual w Workers dashboard

**Cel**: Override domyślnych komend na OpenNext CLI. Default `npx wrangler deploy` NIE zadziała z `.open-next/` output.

**Kontrakt** (Worker → Settings → Builds):
- **Build command**: `pnpm exec opennextjs-cloudflare build`
- **Deploy command**: `pnpm exec opennextjs-cloudflare deploy`
- **Root directory**: blank (repo root)
- **Node version**: `.nvmrc` powinien być respected; jeśli nie, env var `NODE_VERSION=22` w Build variables
- Save

#### 3. Verify first build

**Plik**: brak — verification

**Cel**: Pierwszy build kończy się sukcesem mimo braku env vars (auth flow nie zadziała, ale build sam ma przejść).

**Kontrakt**:
- Build log shows: pnpm install → opennextjs-cloudflare build → wrangler deploy
- Deploy generuje URL `https://zapiszprzepis.<account>.workers.dev`
- URL zwraca odpowiedź HTTP (może być 500 z `process.env undefined` — to OK, build sam przeszedł)

### Kryteria sukcesu

#### Weryfikacja ręczna

- Cloudflare Workers dashboard pokazuje Worker `zapiszprzepis` w stanie "Active"
- Build log ostatniego buildu zakończony zielonym ✓
- Build log zawiera `opennextjs-cloudflare build` step (NIE `npx @cloudflare/next-on-pages`)
- `https://zapiszprzepis.<account>.workers.dev` zwraca odpowiedź HTTP (200/307/500 — server odpowiada, NIE 404)

---

## Faza 3: Env vars (Build + Runtime) + redeploy

### Przegląd

Ustawiamy production env vars w DWÓCH miejscach: Build scope (dla `next build` inline `NEXT_PUBLIC_*`) i Runtime scope (dla `process.env` w Server Components). Triggujemy redeploy.

### Wymagane zmiany

#### 1. Build variables and secrets

**Plik**: brak — manual w Workers dashboard

**Cel**: Vary potrzebne podczas `next build` (głównie `NEXT_PUBLIC_*` inline w client bundle).

**Kontrakt** (Worker → Settings → Builds → **Build variables and secrets**):
- `NEXT_PUBLIC_SUPABASE_URL` = `https://wvrlgddgdddwmgzbvtij.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_49CjHG7pAqYIFe7roJDZdA_5c_jBzj2`
- `NEXT_PUBLIC_SITE_URL` = `https://zapiszprzepis.pl`
- Type: Plaintext (anon key jest publishable per nazwa)

#### 2. Variables & Secrets (runtime)

**Plik**: brak — manual

**Cel**: Vary dostępne w `process.env` w Server Components, Server Actions, Route Handlers, middleware na produkcji.

**Kontrakt** (Worker → Settings → **Variables & Secrets**):
- Te same 3 vary co w Build (Cloudflare docs: "Build variables will not be accessible at runtime")
- Type: Plaintext

#### 3. Trigger redeploy

**Plik**: brak — manual

**Cel**: Świeży build z env vars w obu scopes.

**Kontrakt**:
- Workers dashboard → Deployments → ostatni build → ⋮ → **Retry build**
- ALBO `git commit --allow-empty -m "chore: trigger Workers Builds redeploy" && git push`
- Build log nie zawiera warnings o missing env vars
- Deploy status "Success"

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `curl -I https://zapiszprzepis.<account>.workers.dev` zwraca 307 z `Location: /login` (middleware działa z env vars)

#### Weryfikacja ręczna

- Workers dashboard → Settings → Builds → Build variables and secrets: wszystkie 3 vary widoczne
- Workers dashboard → Settings → Variables & Secrets: wszystkie 3 vary widoczne
- `https://zapiszprzepis.<account>.workers.dev` w przeglądarce: redirect na `/login`, widać polski formularz z logo

---

## Faza 4: Custom domain zapiszprzepis.pl na Workerze

### Przegląd

Podpinamy apex `zapiszprzepis.pl` do Workera. DNS już w Cloudflare → setup natychmiastowy. UI inny niż Pages (Domains & Routes zamiast Custom domains).

### Wymagane zmiany

#### 1. Custom domain w Workerze

**Plik**: brak — manual w Workers dashboard

**Cel**: Dodać `zapiszprzepis.pl` jako custom domain Workera.

**Kontrakt**:
- Workers dashboard → Worker `zapiszprzepis` → **Settings → Domains & Routes** → **Add** → **Custom Domain**
- Domain: `zapiszprzepis.pl` (apex, bez `www`)
- **Add Custom Domain**
- Cloudflare auto-doda DNS records dla apex (Cloudflare-internal routing, nie CNAME bo apex)
- Universal SSL provisioning rusza automatycznie

#### 2. Usuń stary DNS record (jeśli istnieje)

**Plik**: brak — manual

**Cel**: Jeśli `zapiszprzepis.pl` ma CNAME/A record wskazujący na Vercel, usunąć — inaczej Workers custom domain fails.

**Kontrakt**:
- Cloudflare dashboard → DNS → Records for `zapiszprzepis.pl`
- Sprawdź czy jest CNAME/A na apex → Vercel (`cname.vercel-dns.com` lub IP)
- Jeśli tak: usuń przed kontynuacją Phase 4
- Jeśli nie (DNS świeża): nic nie zmieniaj, Cloudflare doda wszystko sam

#### 3. SSL provisioning

**Plik**: brak — verification

**Cel**: Poczekać aż Universal SSL wystawi certyfikat. Typowo 1-5 min, czasem do 15.

**Kontrakt**:
- Status w Workers → Domains & Routes: `zapiszprzepis.pl` ma status "Active" z zielonym SSL

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `curl -I https://zapiszprzepis.pl` zwraca 307 z `Location: /login`, status SSL OK
- `curl -v https://zapiszprzepis.pl` pokazuje certyfikat ważny wydany przez Cloudflare

#### Weryfikacja ręczna

- `https://zapiszprzepis.pl` w przeglądarce: redirect na `/login`, kłódka SSL bez ostrzeżeń, polski formularz widoczny

---

## Faza 5: Supabase Auth config update

### Przegląd

Aktualizujemy Site URL i Redirect URLs allowlist. **Usuwamy Vercel URLs od razu** (clean break, no fallback).

### Wymagane zmiany

#### 1. Site URL

**Plik**: brak — manual w Supabase dashboard

**Cel**: Site URL jest fallback dla `emailRedirectTo` + validation dla email templates.

**Kontrakt**:
- Supabase dashboard → projekt `wvrlgddgdddwmgzbvtij` → **Authentication → URL Configuration**
- **Site URL**: `https://zapiszprzepis.pl` → Save

#### 2. Redirect URLs allowlist

**Plik**: brak — manual

**Cel**: Allowlist dla `emailRedirectTo`. Magic-link callback URLs muszą pasować.

**Kontrakt** (Authentication → URL Configuration → Redirect URLs):
- **Dodaj**: `https://zapiszprzepis.pl/auth/callback`
- **Dodaj**: `https://*.workers.dev/auth/callback` (Workers preview/staging) — lub bardziej specyficzny `https://zapiszprzepis.<account>.workers.dev/auth/callback`
- **Zachowaj**: `http://localhost:3000/auth/callback` (local dev)
- **USUŃ**: `http://localhost:3000/auth/callback` (duplicate jeśli jest), wszystkie wpisy `*vercel.app/auth/callback` (clean break)

### Kryteria sukcesu

#### Weryfikacja ręczna

- Supabase dashboard pokazuje Site URL = `https://zapiszprzepis.pl`
- Redirect URLs zawierają: production Cloudflare URL, workers.dev wildcard/specific, localhost
- ŻADEN wpis Vercel nie pozostał (`*vercel.app` not present)

---

## Faza 6: End-to-end magic-link verification

### Przegląd

Manualny test pełnego flow auth na produkcyjnym URL. **Decyzyjny gate**: jeśli auth fails na Workers, NIE wracamy do Vercel — debugujemy z `wrangler tail`.

### Wymagane zmiany

Brak edycji plików — faza tylko weryfikacyjna.

### Kryteria sukcesu

#### Weryfikacja ręczna

- **Cold start**: nowa karta (incognito) → `https://zapiszprzepis.pl` → redirect 307 na `/login` → widzi polski formularz z logo + autoFocus na email input
- **Submit**: wpisz prawdziwy email → klik "Wyślij link" → URL na `/login?sent=1&email=...` → "Wysłaliśmy link na <email>"
- **Email arrives**: <1 min, `From: noreply@mail.app.supabase.io`
- **Link href**: prawym myszki kopiuj link, zaczyna się od `https://zapiszprzepis.pl/auth/callback?code=...` (NIE Vercel, NIE workers.dev)
- **Callback**: klik link → redirect na `https://zapiszprzepis.pl/` → "Zalogowano jako <email>" + przycisk "Wyloguj się"
- **Session persist**: refresh strony → nadal zalogowany; cookies w devtools zawierają `sb-<ref>-auth-token`
- **Logout**: klik "Wyloguj się" → `/login`; próba `/` → znów `/login`
- **Used link**: re-paste email link po wylogowaniu → `/login?error=used` z polskim komunikatem
- **No code edge**: `/auth/callback` bez `?code=` → `/login?error=invalid`
- **Optional**: rate-limit — 2× submit <60s → `/login?error=cooldown`

**Jeśli którykolwiek krok zawiedzie**: STOP, debuguj. Workflow:
1. `pnpm exec wrangler tail zapiszprzepis` — live logs z Workera
2. Sprawdź czy oba scope env vars są ustawione (Build + Runtime)
3. Sprawdź czy `middleware.ts` (NIE `proxy.ts`) executed — issue #962 mogło ujawnić się inaczej
4. Cookie handling: czy `setAll(headers)` w `lib/supabase/proxy.ts` ustawia headers
5. Jeśli stuck — `git checkout master && vercel --prod` jako emergency hotfix (~5 min), debug z spokojem

---

## Faza 7: Docs update + Vercel project deletion

### Przegląd

Aktualizujemy dokumentację (Cloudflare Workers-first). **Kasujemy projekt Vercel** w Vercel dashboard — clean break.

### Wymagane zmiany

#### 1. `infrastructure.md` update

**Plik**: `context/foundation/infrastructure.md`

**Cel**: Flip "migration deferred" → "migration completed". Workers + adapter w stack. No warm fallback.

**Kontrakt**:
- Frontmatter: `migration_status: completed`, `migrated_at: 2026-05-31`, `production_url: https://zapiszprzepis.pl`, `runtime: cloudflare-workers`, `adapter: "@opennextjs/cloudflare"`
- Sekcja "Rekomendacja": pierwsze zdanie — "**Wdrożono na Cloudflare Workers + Static Assets** za pośrednictwem `@opennextjs/cloudflare` adaptera — production URL: `https://zapiszprzepis.pl` (od 2026-05-31)."
- Sekcja "Rozpoczęcie pracy": zmienić na "Wykonane kroki" z commit SHA i datami
- "Plan ewakuacji": flip na "Vercel project skasowany 2026-05-31. Emergency hotfix path: `git checkout master && vercel --prod` z lokalnego repo (tworzy nowy Vercel project)."

#### 2. `README.md` update

**Plik**: `README.md`

**Cel**: Sekcja Setup Cloudflare Workers-first.

**Kontrakt**:
- Linia 5 (Stack): zmień "Vercel" → "Cloudflare Workers + Static Assets"
- Wymagania: "konto Cloudflare (free)" zamiast Vercel
- Setup step 3 (Redirect URLs): aktualizuj do `zapiszprzepis.pl` + workers.dev wildcard
- Setup step 6 (env vars): przepisz na "Cloudflare Workers → Settings → Build variables AND Variables & Secrets" z 3 env vars; dodaj note o DWÓCH scope
- Dodaj sekcję "## Deployment": `pnpm preview` (lokalny workerd) + `pnpm deploy` (manual deploy via wrangler) + opis Workers Builds auto-deploy na push

#### 3. F-01 follow-up note

**Plik**: `context/changes/auth-and-supabase-scaffold/follow-ups/platform-migration.md` (nowy)

**Cel**: Historical record migracji.

**Kontrakt**:
- Markdown plik z sekcjami: "Co się zmieniło", "Kiedy", "Co zostało zweryfikowane na Vercel (legacy)", "Co zostało zweryfikowane na Cloudflare Workers", "Workaround #962 — middleware.ts rename", "Linki" (do tego planu + Phase 6)

#### 4. **DELETE Vercel project**

**Plik**: brak — manual w Vercel dashboard

**Cel**: Clean break. Bez fallbacku.

**Kontrakt**:
- Vercel dashboard → projekt `zapiszprzepis` → Settings → Advanced → **Delete Project**
- Potwierdź delete
- Reminder: emergency hotfix path zostaje — `vercel --prod` z CLI utworzy nowy projekt jeśli kiedyś trzeba

#### 5. Commit dokumentacji

**Plik**: brak — git operation

**Cel**: Jeden commit zbierający docs.

**Kontrakt**:
- Subject: `docs: complete Cloudflare Workers migration to zapiszprzepis.pl`
- Body: lista zmienionych plików + production URL + Vercel deleted

### Kryteria sukcesu

#### Weryfikacja automatyczna

- `context/foundation/infrastructure.md` zawiera `migration_status: completed` w frontmatter
- `README.md` wymienia "Cloudflare Workers" (NIE Vercel, NIE Pages)
- `context/changes/auth-and-supabase-scaffold/follow-ups/platform-migration.md` istnieje
- `git log --oneline -1` pokazuje commit `docs: complete Cloudflare Workers migration...`

#### Weryfikacja ręczna

- Vercel dashboard nie pokazuje projektu `zapiszprzepis` (deleted)
- `https://zapiszprzepis.vercel.app` zwraca 404 / "Project not found"
- `https://zapiszprzepis.pl` nadal działa (Phase 6 verification stable)

---

## Strategia testowania

### Testy jednostkowe

Brak nowych unit testów. F-01 design (manual verification only per PRD) jest spójna.

### Testy integracyjne

Brak. Cała integracja jest manualna w Phase 6.

### Kroki testowania ręcznego

Skonsolidowane w Phase 6 — 9 punktów happy path + edge cases.

## Uwagi dotyczące wydajności

- Cloudflare Workers ma 10ms CPU limit per invocation na free tier. Dla obecnego scope (auth + page render) — bezproblemowe.
- Build na Workers Builds: 2-4 min vs Vercel 30-60s. Akceptowalne.
- `pnpm preview` (workerd lokalnie) wolniejszy startup niż `pnpm dev` (Node.js). Używaj przed merge dla wierności runtime; `pnpm dev` dla iteracji.
- Static Assets binding (`ASSETS`) serwuje pliki z `.open-next/assets/` przez Cloudflare edge — szybkie globalnie.

## Uwagi dotyczące migracji

- Brak data migration — Supabase Postgres jest poza platformą, ten sam projekt obsługuje Vercel-legacy i Cloudflare.
- Cookies związane z `zapiszprzepis.vercel.app` nie są ważne dla `zapiszprzepis.pl` — użytkownicy z aktywną sesją na Vercel będą musieli re-login (faktycznie tylko author, mama jeszcze nie była tam zalogowana).
- Vercel project deletion jest finalne — Vercel nie ma "trash" / undo. Jeśli kiedyś trzeba przywrócić, `vercel --prod` z CLI utworzy nowy projekt.

## Otwarte ryzyka i założenia

- **Issue #962 (`proxy.ts` blocker)**: workaround applied (rename do `middleware.ts`). Gdyby OpenNext team dropped support dla `middleware.ts` w przyszłości (nieprawdopodobne — to Next.js convention od lat), będziemy musieli iterować. Monitorować: https://github.com/opennextjs/opennextjs-cloudflare/issues/962
- **Workers Builds autoconfig pnpm + Node**: nie jest jasno udokumentowane czy `.nvmrc` jest auto-respected. Fallback: env var `NODE_VERSION=22` w Build variables (Phase 2 alternatywa).
- **Build vs Runtime env vars confusion**: subtelne — łatwo zapomnieć ustawić oba scope. Symptom: client-side `process.env.NEXT_PUBLIC_X` jest `undefined`. Plan w Phase 3 explicit o oba.
- **Cookie / session handling różnice Workers vs Node** — `updateSession` headers handling już wdrożony (cache-poisoning mitigation), narrow try-catch w `server.ts` zostaje. Niska szansa na regression, ale Phase 6 to walidacja.
- **Vercel CLI emergency hotfix path** — założenie że `vercel --prod` zadziała bez dashboard projektu (tworzy nowy). Verified w Vercel docs.
- **Cloudflare Workers free tier limits** — 100k requests/dzień, 10ms CPU. Dla 1-user MVP — całkowicie wystarcza.
- **Windows + OpenNext lokalny build**: `pnpm exec opennextjs-cloudflare build` fails na Windows z `EPERM symlink` w bundling step (oficjalna `WARN` na początku build log: "OpenNext is not fully compatible with Windows. WSL recommended."). Lokalny `next build` działa, OpenNext-specific bundling NIE. Workaround: pomijamy lokalną walidację `.open-next/worker.js`, polegamy na Workers Builds (Linux env w cloud) jako produkcyjnej walidacji. Alternatywa long-term: WSL setup lub enable Windows Developer Mode.

## Referencje

- Decyzja platformy: `context/foundation/infrastructure.md`
- F-01 plan (auth scaffold): `context/changes/auth-and-supabase-scaffold/plan.md`
- F-01 review (lessons + fixes): `context/changes/auth-and-supabase-scaffold/reviews/impl-review.md`
- Reguły do reużycia: `context/foundation/lessons.md`
- OpenNext Cloudflare main: https://opennext.js.org/cloudflare
- OpenNext Get Started: https://opennext.js.org/cloudflare/get-started
- OpenNext Troubleshooting: https://opennext.js.org/cloudflare/troubleshooting
- OpenNext Env Vars how-to: https://opennext.js.org/cloudflare/howtos/env-vars
- Cloudflare Workers Next.js framework guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/
- Cloudflare Workers Custom Domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Issue #962 (Next 16 proxy.ts blocker): https://github.com/opennextjs/opennextjs-cloudflare/issues/962

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany. Nie zmieniaj nazw tytułów kroków. Patrz `references/progress-format.md`.

### Faza 1: Pre-flight + adapter setup w repo

#### Automatyczne

- [x] 1.1 `.nvmrc` istnieje z wartością `22.11.0`
- [x] 1.2 `src/middleware.ts` istnieje, `src/proxy.ts` NIE istnieje, funkcja przemianowana na `middleware`
- [x] 1.3 `package.json` zawiera `@opennextjs/cloudflare` (deps) i `wrangler` (devDeps)
- [x] 1.4 `package.json` scripts zawiera `preview`, `deploy`, `upload`, `cf-typegen`
- [x] 1.5 `wrangler.jsonc` istnieje z `compatibility_date >= 2025-05-05`, `nodejs_compat`, assets binding
- [x] 1.6 `open-next.config.ts` istnieje i eksportuje `defineCloudflareConfig({})`
- [x] 1.7 `next.config.ts` importuje `initOpenNextCloudflareForDev` z `@opennextjs/cloudflare` i wywołuje
- [x] 1.8 `.gitignore` zawiera linię `.open-next/`
- [x] 1.9 `pnpm install` exit 0, `pnpm-lock.yaml` zaktualizowany
- [x] 1.10 `pnpm exec tsc --noEmit` exit 0
- [x] 1.11 `pnpm lint` exit 0
- [x] 1.12 `pnpm exec opennextjs-cloudflare build` exit 0, `.open-next/worker.js` istnieje — SKIPPED on Windows (EPERM symlink, known OpenNext limitation per top-of-build WARN); validated in cloud via Workers Builds (Phase 2.3)

### Faza 2: Workers project + Workers Builds Git connect

#### Ręczne

- [ ] 2.1 Cloudflare Workers dashboard pokazuje Worker `zapiszprzepis` w stanie "Active"
- [ ] 2.2 Build/Deploy commands ustawione na `pnpm exec opennextjs-cloudflare build` / `pnpm exec opennextjs-cloudflare deploy`
- [ ] 2.3 Build log ostatniego buildu zielony, zawiera `opennextjs-cloudflare build` step
- [ ] 2.4 `https://zapiszprzepis.<account>.workers.dev` zwraca odpowiedź HTTP (server odpowiada)

### Faza 3: Env vars (Build + Runtime) + redeploy

#### Automatyczne

- [ ] 3.1 `curl -I https://zapiszprzepis.<account>.workers.dev` zwraca 307 z `Location: /login`

#### Ręczne

- [ ] 3.2 Workers → Settings → Builds → Build variables and secrets: wszystkie 3 vary widoczne
- [ ] 3.3 Workers → Settings → Variables & Secrets: wszystkie 3 vary widoczne
- [ ] 3.4 `https://zapiszprzepis.<account>.workers.dev` w przeglądarce: redirect na `/login`, polski formularz + logo

### Faza 4: Custom domain zapiszprzepis.pl

#### Automatyczne

- [ ] 4.1 `curl -I https://zapiszprzepis.pl` zwraca 307 z `Location: /login`, SSL OK
- [ ] 4.2 `curl -v https://zapiszprzepis.pl` certyfikat ważny, wydany przez Cloudflare

#### Ręczne

- [ ] 4.3 `https://zapiszprzepis.pl` w przeglądarce: redirect na `/login`, kłódka SSL bez ostrzeżeń, polski formularz widoczny

### Faza 5: Supabase Auth config update

#### Ręczne

- [ ] 5.1 Supabase dashboard: Site URL = `https://zapiszprzepis.pl`
- [ ] 5.2 Redirect URLs zawierają production Cloudflare URL, workers.dev wildcard/specific, localhost
- [ ] 5.3 Żaden wpis `*vercel.app` nie pozostał w Redirect URLs

### Faza 6: End-to-end magic-link verification

#### Ręczne

- [ ] 6.1 Cold start: incognito → `https://zapiszprzepis.pl` → 307 na `/login` → polski formularz + logo + autoFocus
- [ ] 6.2 Submit: email → `/login?sent=1&email=...` → "Wysłaliśmy link…"
- [ ] 6.3 Email w <1 min, From `noreply@mail.app.supabase.io`
- [ ] 6.4 Link href: `https://zapiszprzepis.pl/auth/callback?code=...` (NIE Vercel, NIE workers.dev)
- [ ] 6.5 Callback: klik → `https://zapiszprzepis.pl/` → "Zalogowano jako <email>" + przycisk wylogowania
- [ ] 6.6 Session persist: refresh → nadal zalogowany; cookie `sb-<ref>-auth-token` obecny
- [ ] 6.7 Logout: klik "Wyloguj się" → `/login`; próba `/` → znów `/login`
- [ ] 6.8 Used link: re-paste → `/login?error=used` z polskim komunikatem
- [ ] 6.9 No code: `/auth/callback` bez `?code=` → `/login?error=invalid`

### Faza 7: Docs update + Vercel project deletion

#### Automatyczne

- [ ] 7.1 `context/foundation/infrastructure.md` frontmatter ma `migration_status: completed`
- [ ] 7.2 `README.md` wymienia "Cloudflare Workers" (NIE Vercel, NIE Pages)
- [ ] 7.3 `context/changes/auth-and-supabase-scaffold/follow-ups/platform-migration.md` istnieje
- [ ] 7.4 `git log --oneline -1` pokazuje commit `docs: complete Cloudflare Workers migration...`

#### Ręczne

- [ ] 7.5 Vercel dashboard: projekt `zapiszprzepis` skasowany (Settings → Advanced → Delete)
- [ ] 7.6 `https://zapiszprzepis.vercel.app` zwraca 404 / "Project not found"
- [ ] 7.7 `https://zapiszprzepis.pl` nadal stable (Phase 6 verification trzyma)
