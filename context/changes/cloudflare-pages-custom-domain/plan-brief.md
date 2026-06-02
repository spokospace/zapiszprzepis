# Cloudflare Workers production deploy on zapiszprzepis.pl — Krótki plan

> Pełny plan: `context/changes/cloudflare-pages-custom-domain/plan.md`
> Decyzja platformy: `context/foundation/infrastructure.md`

## Co i dlaczego

Pełna migracja produkcji z Vercel na **Cloudflare Workers + Static Assets** z `@opennextjs/cloudflare` adapterem, od razu na custom domain `zapiszprzepis.pl`. F-01 (auth scaffold) został zweryfikowany na Vercel preview, ale infrastructure.md zarejestrowało Cloudflare jako platformę produkcyjną. Plan realizuje migrację end-to-end i kończy się **clean break** — projekt Vercel zostaje skasowany.

## Punkt wyjścia

Produkcja działa na `https://zapiszprzepis.vercel.app`. W repo brak `wrangler.jsonc`, `open-next.config.ts`, ani `@opennextjs/cloudflare` w deps. `.nvmrc` z `22.11.0` istnieje (niezacommitowany). `src/proxy.ts` (Next 16 rename) wymaga workaroundu — adapter nie wspiera tej nazwy (issue #962). Domena `zapiszprzepis.pl` jest w Cloudflare DNS. F-01 review wprowadziło 2 fixy w kodzie (site-url LAN IPs + server.ts narrow catch) oraz 6 reguł w `lessons.md`. `updateSession` w `lib/supabase/proxy.ts` już aplikuje `headers` z `setAll` (cache-poisoning mitigation).

## Pożądany stan końcowy

`https://zapiszprzepis.pl` serwuje aplikację z Cloudflare Workers runtime; magic-link flow działa end-to-end (zweryfikowany na live URL); Supabase Auth allowlist zaktualizowany (Vercel URLs usunięte); README + infrastructure.md dokumentują Cloudflare Workers-first stan; **Vercel projekt skasowany**.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego | Źródło |
|---|---|---|---|
| Adapter | `@opennextjs/cloudflare` (modern) | Currently-recommended dla Next.js, official Cloudflare guide | Research |
| Cloudflare surface | **Workers + Static Assets** (NIE Pages) | Pages auto-detect wymusza legacy `@cloudflare/next-on-pages` z `.vercel/output/static` katalogiem | Research |
| Git integration | **Workers Builds** | Equivalent Pages auto-deploy ale dla Workers | Cloudflare docs |
| `proxy.ts` → `middleware.ts` | Rename back | Issue #962 — adapter nie wspiera Next 16 `proxy.ts` rename. Workaround: nazwa `middleware.ts` (Next.js akceptuje obie) | GitHub issue #962 |
| `compatibility_date` | `2025-05-05` | Wymagana przez adapter (`FinalizationRegistry`) | OpenNext troubleshooting |
| `compatibility_flags` | `["nodejs_compat", "global_fetch_strictly_public"]` | Mandatory + parity z official template | OpenNext docs |
| Wrangler config format | `wrangler.jsonc` (NIE `.toml`) | Cloudflare preferowany format 2025+ | Cloudflare docs |
| Build vs Runtime env vars | DUPLIKACJA (oba scope) | Workers Builds: build vars nieaktywne w runtime per docs | OpenNext env-vars how-to |
| Vercel po migracji | **DELETE** (clean break) | User decision — zero fallback, emergency hotfix via `vercel --prod` CLI | User decision 2026-05-31 |
| `NEXT_PUBLIC_SITE_URL` w Preview env | NIE ustawione | `getSiteUrl()` fallback na `host` zwróci preview URL poprawnie | Plan (F-01 design) |
| WWW redirect | Pomijamy | Mama z PRD persony nie wpisze www | Plan |

## Zakres

**W zakresie:**
- Rename `src/proxy.ts` → `src/middleware.ts` (workaround #962)
- Dodanie `@opennextjs/cloudflare` (dep), `wrangler` (devDep)
- `wrangler.jsonc` + `open-next.config.ts` + edit `next.config.ts`
- Scripts w `package.json` (`preview`, `deploy`, `upload`, `cf-typegen`)
- `.gitignore` update (`.open-next/`, `.dev.vars`)
- Cloudflare Workers projekt + Workers Builds Git connect
- Build/Runtime env vars w Workers
- Custom domain `zapiszprzepis.pl` na Workerze
- Supabase Auth allowlist update + usunięcie Vercel URLs
- E2E weryfikacja magic-link na production URL
- README + infrastructure.md update (Cloudflare Workers-first)
- **Vercel project deletion**

**Poza zakresem:**
- WWW redirect (`www.zapiszprzepis.pl`)
- PWA manifest changes
- Trigger.dev integration (F-02 scope)
- Custom SMTP dla magic-link
- CI/CD GitHub Actions
- R2 / D1 / KV bindings
- Aplikacja F4/F9 z `lessons.md` (future-rules)
- Warm fallback Vercel

## Architektura / Podejście

7 faz sekwencyjnie zależnych:

```
Phase 1: adapter setup w repo (largest code change) → commit
   ↓
Phase 2: Workers project + Workers Builds Git connect → pierwszy build
   ↓
Phase 3: env vars (Build + Runtime) + redeploy → server odpowiada
   ↓
Phase 4: custom domain → zapiszprzepis.pl aktywne
   ↓
Phase 5: Supabase allowlist (+ usunięcie Vercel URLs)
   ↓
Phase 6: E2E verification (decision gate)
   ↓
Phase 7: docs + Vercel project DELETE
```

Runtime stack: Next.js 16 (App Router) → `@opennextjs/cloudflare` build → `.open-next/worker.js` + `.open-next/assets/` → Cloudflare Workers + Static Assets binding → user na `zapiszprzepis.pl`. Supabase Postgres + Auth pozostaje bez zmian (poza platformą).

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Pre-flight + adapter setup | `.nvmrc` (done), `middleware.ts` rename, deps, wrangler.jsonc, open-next.config.ts, scripts, .gitignore, lokalny `opennextjs-cloudflare build` zielony | #962 workaround musi być pierwszy; lokalny build catches config errors before pushing |
| 2. Workers project + Workers Builds | Pierwszy build w Workers Builds zielony, `<worker>.workers.dev` aktywny | Override default build/deploy commands na OpenNext CLI |
| 3. Env vars + redeploy | Server odpowiada na workers.dev z auth flow | Łatwo zapomnieć ustawić Build VS Runtime scope (oba potrzebne) |
| 4. Custom domain | `zapiszprzepis.pl` z SSL | Stary DNS record (Vercel CNAME) może być w drodze — sprawdzić |
| 5. Supabase Auth config | Allowlist akceptuje nowy URL, Vercel URLs usunięte | Brak — pure dashboard config |
| 6. E2E verification | Pełny magic-link flow zweryfikowany na live | Najbardziej prawdopodobne miejsce na ujawnienie ukrytych bugów adaptera; `wrangler tail` dla debugu |
| 7. Docs + Vercel deletion | Cloudflare Workers-first docs, Vercel skasowany | Brak — pure docs + dashboard delete |

**Wymagania wstępne:**
- F-01 zaimplementowane i zweryfikowane (✓ done, status `impl_reviewed`)
- Konto Cloudflare aktywne, domena `zapiszprzepis.pl` w Cloudflare DNS (✓ potwierdzone)
- Supabase Auth dashboard access (✓ author ma)
- Lokalne środowisko z Node 22 LTS, pnpm 10+ (✓ done)

**Szacowany nakład pracy:** ~2-3 godziny, jedna lub dwie after-hours sesje. Phase 1 (40-60 min code, najwięcej pracy), Phase 2-5 (30-40 min dashboard), Phase 6 (15-20 min e2e), Phase 7 (30 min docs + delete).

## Otwarte ryzyka i założenia

- **Issue #962 (`proxy.ts` blocker)** — workaround zastosowany. Plan polega na tym że Next.js będzie nadal akceptować `middleware.ts` (jest, stabilne convention).
- **Workers Builds pnpm + Node detection** — `.nvmrc` powinien być respected; fallback to env var `NODE_VERSION=22`.
- **Build vs Runtime env vars duplikacja** — łatwo zapomnieć. Plan w Phase 3 jest explicit.
- **Cookie / session handling workerd vs Node** — niska szansa na regression (cache headers handling już in place), ale Phase 6 to walidacja.
- **Vercel project deletion = finalne** — Vercel nie ma trash. Emergency hotfix path: `vercel --prod` CLI tworzy nowy projekt jeśli kiedyś trzeba.

## Kryteria sukcesu (podsumowanie)

- Mama (lub author) wpisuje `zapiszprzepis.pl` na telefonie → widzi polski formularz logowania w <2s
- Email submit → magic-link w <1 min → klik → zalogowany na `zapiszprzepis.pl` (NIE workers.dev, NIE Vercel)
- Session persistuje przez page refresh; logout działa; już-użyty link daje polski komunikat błędu
- Vercel projekt skasowany; `vercel --prod` CLI hotfix path udokumentowany w infrastructure.md
