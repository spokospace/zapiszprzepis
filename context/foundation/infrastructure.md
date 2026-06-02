---
project: zapiszprzepis
researched_at: 2026-05-31
recommended_platform: Cloudflare Workers + Static Assets
runner_up: Vercel
migration_status: completed
migrated_at: 2026-06-02
production_url: https://zapiszprzepis.pl
worker_url: https://zapiszprzepis.szymon-spoko-space.workers.dev
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Next.js 16 (App Router)
  runtime: Cloudflare Workers (via @opennextjs/cloudflare adapter)
---

## Rekomendacja

**Wdrożono na Cloudflare Workers + Static Assets** za pośrednictwem adaptera `@opennextjs/cloudflare` — production URL: `https://zapiszprzepis.pl` (od 2026-06-02).

Decyzja zapadła na podstawie pięciu kryteriów przyjaznych agentom (CF zalicza wszystkie 5 z GA), priorytetu minimalizacji kosztów (free tier realnie pokrywa 1 użytkownika z PRD), znajomości platformy zadeklarowanej w wywiadzie oraz świadomej wymiany na ryzyko związane z adapterem OpenNext (pre-2.0, wymaga pinningu Next.js >=16.2.3 + adapter >=1.19). Wdrożenie potwierdziło zarówno wykonalność (e2e magic-link działa na production URL), jak i jedno z prognozowanych ryzyk — issue #962 (`proxy.ts` nie wspierany przez adapter) wymusił rename `src/proxy.ts` → `src/middleware.ts` jako workaround per `context/changes/auth-and-supabase-scaffold/follow-ups/platform-migration.md`. Vercel został skasowany (clean break — patrz "Plan ewakuacji" niżej).

## Porównanie platform

Skala: ✅ Pass · ◐ Partial · ❌ Fail

| Platforma | CLI-first | Managed/Serverless | Docs (llms.txt) | Stable deploy API | MCP integration | Razem |
|---|---|---|---|---|---|---|
| **Cloudflare Workers + Pages** | ✅ `wrangler` | ✅ | ✅ `developers.cloudflare.com/llms.txt` + per-product | ✅ `wrangler deploy/rollback/versions list` | ✅ GA (Workers Observability MCP, docs MCP, bindings MCP) | **5/5** |
| **Vercel** | ✅ `vercel` | ✅ | ◐ Next.js ma `nextjs.org/docs/llms.txt`; Vercel platform docs brak | ✅ `vercel --prod / rollback / logs` | ◐ Vercel MCP w **Public Beta** (OAuth, read-only) | **4/5** |
| **Netlify** | ✅ `netlify` | ✅ | ✅ `docs.netlify.com/llms.txt` + `.md` suffix na każdej stronie | ✅ `netlify deploy / logs` (CLI logs nowe w maju 2026) | ✅ GA od czerwca 2025 (`npx @netlify/mcp`) | **5/5** |
| Fly.io | ✅ `flyctl` | ◐ Docker-first; brak dedykowanego `rollback`, ręczne `fly deploy --image <hash>` | ◐ markdown w `github.com/superfly/docs`, brak llms.txt | ◐ deploy stabilny, rollback przez image hash | ✅ GA `fly mcp server` | **3/5** |
| Railway | ✅ `railway` | ✅ (Railpack/Dockerfile; Railpack **beta**) | ◐ `.md` URL suffix, brak llms.txt | ✅ `railway up / redeploy / logs` | ✅ GA, bundled w CLI + remote OAuth `mcp.railway.com` | **4/5** |
| Render | ✅ `render` CLI GA | ✅ | ◐ brak public markdown repo (poza CLI + MCP) | ✅ deploy hooks + API | ✅ GA `render-oss/render-mcp-server` | **4/5** |

### Platformy na krótkiej liście

#### 1. Cloudflare Workers + Pages (Zalecana)

- **Koszt**: $0/mo realistycznie dla 1 użytkownika z PRD (free tier: 100k req/dzień per script, 10ms CPU/invocation z wykluczeniem network I/O); Workers Paid $5/mo dopiero gdy potrzebny Logpush lub większe CPU.
- **Agent-friendliness 5/5**: jedyna platforma w stawce z `llms.txt` w korzeniu domeny **plus** wieloma oficjalnymi serwerami MCP w GA (Workers Observability na `observability.mcp.cloudflare.com` z OAuth, docs MCP, bindings MCP, builds MCP). Agent może czytać logi i deploye bez parsowania output CLI.
- **Geografia**: Cloudflare WAW (Warszawa) PoP — ~5-22 ms RTT od polskich ISP, najbliższe spośród wszystkich kandydatów.
- **Świadome ryzyko**: `@opennextjs/cloudflare` jest pre-2.0 (~1.8k stars, 757 commits, ~100 open issues), wymaga pinningu Next.js >=16.2.3 + adapter >=1.19 dla wsparcia `proxy.ts`. Każdy upgrade Next.js musi czekać na zgodny adapter — bug #962 (proxy.ts) był otwarty od Oct 2025 do Mar 2026.

#### 2. Vercel

- **Koszt**: $0/mo Hobby dla tego workloadu (1M edge req, 100 GB transfer, 4h Active CPU — wszystko poniżej 1% wykorzystania); Pro $20/seat/mo gdy potrzebne dłuższe funkcje, dłuższa historia rollback lub Production protection.
- **Native fit**: zero-config dla Next.js 16, auto-detect `proxy.ts`, Vercel jest sponsorem Next.js — fixy idą tam najszybciej.
- **Status implementacji projektu**: F-01 już zdeployowane na Vercel (PR #1-#4 mergnięte przez Vercel preview); README dokumentuje Vercel-specific manual steps; `.env.local.example` zawiera `NEXT_PUBLIC_SITE_URL` z fallbackiem dla Vercel Preview env.
- **Różnica vs zalecana**: Vercel MCP w Public Beta (nie GA), brak `llms.txt` po stronie platformy (tylko Next.js docs), domyślny region funkcji `iad1` wymaga jawnego `vercel.json` z `fra1`/`arn1` dla polskich użytkowników (round-trip do Supabase Frankfurt). 10s function timeout na Hobby. Brak kontraktowej rezydencji danych EU poniżej Enterprise.

#### 3. Netlify

- **Koszt**: $0/mo (300 credits/mo = ~100 GB bandwidth, 125k function invocations; web requests = 2 credits/10k = pomijalne); Pro $20/mo gdy potrzebne więcej credits lub regiony EU dla funkcji.
- **Agent-friendliness 5/5**: oficjalny MCP server GA od czerwca 2025; `docs.netlify.com/llms.txt` plus każda strona docs dostępna jako markdown przez `.md` suffix.
- **Różnica vs zalecana**: bug otwarty na Server Actions w statycznie renderowanych stronach (workaround: `export const dynamic = 'force-dynamic'`) — realny footgun dla architektury PWA z F-02+ gdzie wiele stron może być statycznie pre-renderowanych. Regiony EU dla funkcji są feature paid plana. Adapter `@netlify/plugin-nextjs` v5 auto-upgraduje się jeśli nie zostanie spinnięty (analogiczne ryzyko jak Cloudflare, ale mniej krytyczne bo Netlify jest bliżej upstream Next.js niż OpenNext).

## Weryfikacja krzyżowa anty-uprzedzeniowa: Cloudflare Workers + Pages

### Adwokat diabła — Słabe strony

1. **`@opennextjs/cloudflare` jest pre-2.0** (~1.8k stars, 757 commits, ~100 open issues, aktywny rozwój ale niestabilny API). Każdy upgrade Next.js (16.3, 16.4, 17) wymaga równoczesnego upgrade'u adaptera — i jeśli adapter nie nadąży, blokuje wszystkie aplikacje. Dla solo dev po `after_hours_only: true` z PRD to faktyczne ryzyko utraty weekendu na investigation.
2. **`proxy.ts` wymaga Next.js >=16.2.3 + adapter >=1.19** (precyzyjny pin). Bug #962 w `opennextjs-cloudflare` był otwarty od Next.js 16 launch (Oct 2025) do 16.2 (Mar 2026) — 5 miesięcy. Jeśli analogiczny bug pojawi się w Next.js 16.3, projekt może być w stanie "działa, ale upgrade niemożliwy" przez miesiące.
3. **10ms CPU/invocation na free tier** (network I/O nie liczy się). Server Component renderujący 500+ przepisów z client-side filtering może przekroczyć limit. Migracja do Workers Paid ($5/mo) usuwa problem, ale zysk kosztowy vs Vercel Hobby topnieje.
4. **`node:child_process` to stub only** (nawet z compat date >= 2026-03-17). Jeśli kiedyś projekt zechce uruchomić lokalne `ffmpeg` lub `playwright` z Server Action zamiast Trigger.dev, droga zamknięta — wymusi pozostanie przy Trigger.dev (zgodne z PRD, ale eliminuje opcjonalny fallback path).
5. **Brak persistent disk** — wszystko musi iść do R2/Supabase Storage. Brak `/tmp` dla intermediate przetwarzania w Server Action (np. resize image przed wysłaniem do Supabase Storage). Dla projektu robiącego image processing przez Web Share Target to faktyczne ograniczenie architektoniczne.

### Pre-Mortem — Jak to mogło się nie udać

Sześć miesięcy później autor jest w S-05 (Trigger.dev jobs wracają callbackiem do Next.js endpointu). Pierwszy bug: `@opennextjs/cloudflare` v2.0 wyszedł 2 miesiące temu z nowym API; projekt pinnowany na 1.19, ale `pnpm audit` codziennie krzyczy o CVE w transitive deps. Autor próbuje upgrade do 2.x, build pęka na nowej konwencji konfiguracji `wrangler.toml` vs `wrangler.jsonc`. Drugi bug: Server Action konwertujący Web Share image (przez `sharp` package) działa na localhost przez `pnpm dev` (używa Node), ale na produkcji `sharp` nie ma binarki dla Workers runtime — autor odkrywa to dopiero gdy mama udostępnia pierwszy obrazek z Reels. Workaround: odpychać image processing do Trigger.dev (więcej kompleksji, dodatkowy hop). Trzeci bug: Wrangler `tail` nie pokazuje pełnych stack trace dla błędów Next.js (mapuje source maps tylko częściowo) — debugowanie produkcyjne wymaga dodawania `console.log` i kolejnego deployu. Po trzech miesiącach autor pisze post na r/nextjs zatytułowany "Cloudflare adapter is fighting Next.js, here's why I migrated to Vercel". Wniosek: Cloudflare zawodzi nie przez wadę platformy core, ale przez "two systems mediated by adapter" — każda zmiana w Next.js wymaga przekładu adaptera, a adapter jest pre-2.0 i niestabilny.

### Nieznane niewiadome

- **`wrangler dev` ≠ `next dev`** — dwa równolegle serwery deweloperskie, oba potrzebne (Next.js dev dla hot reload UI, Wrangler dev dla wierności runtime Workers). Onboarding nowego współpracownika (lub agenta) wymaga zrozumienia kiedy używać którego. Skill guardrail #8 dotyczy dokładnie tej kwestii — od marca 2026 `pnpm dev` w Next.js 16 + `@opennextjs/cloudflare` nadal używa Node runtime, nie Workers; wierność runtime daje dopiero `pnpm exec opennextjs-cloudflare preview`.
- **`compatibility_date` w `wrangler.jsonc` to ukryty wpływ** — zmiana tej daty na nowszą wartość włącza/wyłącza features Workers runtime (np. `node:child_process` stub auto-enable >= 2026-03-17). Łatwo pominąć w PR review, łatwo wprowadzić regression.
- **R2 i Workers KV mają osobne free tiers i bilingi** — projekt korzysta z Supabase Storage zamiast R2 (per tech-stack.md), więc to nie boli teraz, ale jeśli kiedyś będzie mowa o "konsolidacji do Cloudflare", każdy produkt ma osobny dashboard, osobne limity i osobne MCP serwery. Mental overhead "który produkt CF jest tu używany".
- **Logpush wymaga Workers Paid ($5/mo)** — na free `wrangler tail` jest jedynym źródłem logów, działa tylko gdy aktywnie wykonujesz tail. Brak retroaktywnego debugowania "co się wczoraj zepsuło o 3 nad ranem". Dla MVP z 1 użytkownikiem akceptowalne, ale gdy mama zgłosi nieodtwarzalny bug, dochodzenie będzie trudniejsze niż na Vercel.
- **Build cache w Cloudflare Pages jest mniej agresywny niż Vercel** — pełny `pnpm install` + Next.js build co każdy deploy może trwać 2-4 min vs Vercel-typical 30-60s. Nie krytyczne dla solo dev, ale frustruje gdy debugujesz konfigurację `wrangler.jsonc` przez 10 iteracji.

## Historia operacyjna

- **Wdrożenia podglądowe**: Cloudflare Pages preview deploys per branch / PR pod `<branch>.<project>.pages.dev` — dostępne publicznie. Dla ochrony preview deploys → Cloudflare Access (free dla małych zespołów, wymaga konfiguracji Zero Trust). PR-y z fork repo nie dostają preview deploy automatycznie (security limit).
- **Sekrety**: `wrangler secret put <NAME>` per environment (production / preview); sekrety nie są dostępne w `pnpm build` lokalnie, tylko w runtime Workers. `.dev.vars` (gitignore) dla local dev. Rotacja: `wrangler secret put <NAME>` nadpisuje istniejący. GitHub Secrets dla CI (jeśli przejdziesz z `wrangler deploy` lokalnego na GitHub Actions).
- **Wycofywanie**: `wrangler rollback [VERSION_ID]` (znajdziesz `VERSION_ID` przez `wrangler versions list`). Czas przywrócenia <30s. Uwaga dla bazy: rollback Workers NIE wycofuje migracji Supabase — `pnpm exec supabase migration repair` lub manualnie w SQL Editor.
- **Zatwierdzanie**: agent może bez nadzoru: `wrangler deploy` do preview, `wrangler rollback` z `VERSION_ID`, `wrangler tail` do logów, `wrangler secret put` do non-prod sekretów. Człowiek musi: utworzenie projektu Cloudflare Pages (one-time), powiązanie custom domain (DNS), rotacja `CLOUDFLARE_API_TOKEN` używanego przez CI, usunięcie projektu.
- **Logi**: `wrangler tail` (live, kończy się przy odłączeniu); `wrangler tail --status error --format json` dla agentowego parsowania. Retroaktywne logi tylko z Logpush (Workers Paid $5/mo) wysyłające do R2/zewnętrznego storage. MCP path: `observability.mcp.cloudflare.com` (OAuth) udostępnia typowany dostęp do logów i metrics przez tool-use.

## Rejestr ryzyka

| Ryzyko | Źródło | Prawdopodobieństwo | Wpływ | Łagodzenie |
|---|---|---|---|---|
| Adapter OpenNext nie nadąży za upgrade Next.js (zablokowany upgrade na tygodnie) | Adwokat diabła #1, Pre-mortem | Ś | W | Pin `next` i `@opennextjs/cloudflare` w `package.json`; przed upgrade Next.js sprawdź release notes adaptera; trzymaj `develop` branch z bieżącymi pinami |
| proxy.ts regression w Next.js 16.x line | Adwokat diabła #2 | N | W | Pin Next.js >=16.2.3 (aktualne 16.2.6 — OK); manual smoke test (`pnpm check:auth` + magic-link flow) po każdym upgrade adaptera |
| 10ms CPU limit przekroczony przy renderowaniu list 500+ przepisów | Adwokat diabła #3 | Ś | Ś | Push search/filtering do Supabase (`pg_trgm` ILIKE per FR-013); w razie potrzeby Workers Paid $5/mo (30M CPU-ms) |
| `sharp` lub inne native bindings nie działają na Workers runtime | Pre-mortem | W | Ś | Image processing tylko w Trigger.dev (zgodnie z PRD); `pnpm dev` z Node runtime maskuje ten problem — testuj przez `pnpm exec opennextjs-cloudflare preview` przed merge |
| Brak retroaktywnych logów na free tier (post-incident debugging) | Nieznane niewiadome #4 | W | Ś | Świadomie akceptuj dla MVP; Workers Paid $5/mo gdy mama zgłosi pierwszy nieodtwarzalny bug |
| Disorientacja `wrangler dev` vs `next dev` — local dev nie odzwierciedla runtime | Nieznane niewiadome #1 | Ś | N | Dokumentuj w README dwa polecenia: `pnpm dev` (hot reload, Node) i `pnpm preview` (`opennextjs-cloudflare build && opennextjs-cloudflare preview` — wierność runtime). Przed deploy zawsze `preview` |
| Cloudflare Pages build cache mniej skuteczny → wolniejsze deploye | Nieznane niewiadome #5 | W | N | Akceptuj; jeśli ból narośnie, użyj `cache@v4` w GitHub Actions zamiast Cloudflare Pages auto-build |
| Brak `node:child_process` zamyka path "odepchnij ffmpeg do Server Action" | Adwokat diabła #4 | N | N | PRD już wskazuje Trigger.dev jako runner dla long-running jobs; akceptuj jako wzmocnienie istniejącej decyzji |

## Wykonane kroki

Migracja zakończona 2026-06-02. Faktyczne kroki (z deltami względem planu pre-implementation):

1. **Zainstalowano adapter i wrangler** (commit `74001ff` w PR #5):
   ```powershell
   pnpm add @opennextjs/cloudflare    # 1.19.11 (prod)
   pnpm add -D wrangler                # 4.96.0 (dev)
   ```

2. **`open-next.config.ts`** — minimalna konfiguracja: `defineCloudflareConfig({})`. R2/D1/KV bindings poza zakresem F-01.

3. **`wrangler.jsonc`** (NIE `wrangler.toml`):
   - `compatibility_date: "2025-05-05"` (minimum dla `FinalizationRegistry` per adapter v1.19.11)
   - `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]`
   - `main: ".open-next/worker.js"`, `assets.directory: ".open-next/assets"`, `assets.binding: "ASSETS"`
   - `placement` zostawione default (PoP user-closest = WAW dla mamy w PL)

4. **Env vars w Cloudflare Workers dashboard** — DWA scope:
   - Build variables (Settings → Builds → Build variables and secrets): 3× `NEXT_PUBLIC_*` (inline w client bundle na `next build`)
   - Runtime variables (Settings → Variables and Secrets): te same 3× `NEXT_PUBLIC_*` (dla `process.env` w Server Components / middleware)
   - Cloudflare docs: "Build variables will not be accessible at runtime" — duplikacja obowiązkowa

5. **Workers Builds setup** (NIE Pages create flow):
   - Worker `zapiszprzepis` utworzony z "Hello World" template, potem Settings → Builds → Connect to Git → `spokospace/zapiszprzepis` na branch `master`
   - Build command: `pnpm exec opennextjs-cloudflare build`
   - Deploy command: `pnpm exec opennextjs-cloudflare deploy`
   - pnpm 10.23.0 auto-detected via `packageManager` field + corepack (PNPM_VERSION env var NIE był potrzebny)
   - Wynik: `https://zapiszprzepis.szymon-spoko-space.workers.dev`

6. **Custom domain `zapiszprzepis.pl`** — Worker → Settings → Domains & Routes → Add Custom Domain → SSL provisioning ~3 min. DNS już w Cloudflare (CNAME flattening dla apex auto).

7. **Supabase Auth update**: Site URL → `https://zapiszprzepis.pl`, Redirect URLs: production + workers.dev + localhost (Vercel URLs usunięte).

8. **`pnpm preview` / `pnpm deploy` scripts** dodane do `package.json` per OpenNext docs.

9. **README.md przepisany** na Cloudflare Workers-first (sekcja Deployment z `pnpm preview` + `pnpm deploy`, sekcja Setup z dwoma env var scopes).

**Workaround #962**: `src/proxy.ts` → `src/middleware.ts` rename (Next.js 16 deprecated rename, ale OpenNext nie wspiera nowej nazwy — issue open od Oct 2025). Detal w `context/changes/auth-and-supabase-scaffold/follow-ups/platform-migration.md`.

**Pełen plan migracji**: `context/changes/cloudflare-pages-custom-domain/plan.md`.

**Plan ewakuacji**: Vercel projekt **skasowany** 2026-06-02 (clean break, no warm fallback). Emergency hotfix path: `vercel --prod` z lokalnego repo (CLI tworzy nowy projekt Vercel jeśli kiedyś trzeba), plus re-add `zapiszprzepis.pl` jako Vercel custom domain + edit DNS w Cloudflare → wskaż na Vercel.

## Poza zakresem

W niniejszych badaniach nie oceniano następujących kwestii:

- Konfiguracja obrazu Docker (Cloudflare Workers nie używa Dockera).
- Konfiguracja potoku CI/CD (GitHub Actions deploy step — odrębna decyzja; agent może na razie deployować z lokalnego `wrangler deploy`).
- Architektura na skalę produkcyjną (wiele regionów, HA, DR) — PRD określa `target_scale.users: small`, więc to wykracza poza zakres MVP.
- Cloudflare R2 jako alternatywa dla Supabase Storage — bieżąca decyzja per tech-stack.md to Supabase Storage; konsolidacja do R2 to przyszła decyzja architektoniczna, nie infrastrukturalna.
- Cloudflare D1 jako alternatywa dla Supabase Postgres — analogicznie, poza zakresem.
- Cloudflare Workers AI jako alternatywa dla OpenAI — PRD wskazuje OpenAI dla ekstrakcji przepisów; substytucja runtime AI to zmiana produktowa, nie infrastrukturalna.
