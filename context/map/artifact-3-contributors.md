# Artifact 3 — Contributors Map

> Generowany: 2026-07-06 | Zakres: cały dostępny git log (218 commitów, maj–lipiec 2026)

---

## Summary

Projekt ma jednego autora: **Szymon** (cnk.one@gmail.com). 218 z 218 commitów — 100% własności kodu. Brak podziału wiedzy między osobami, brak ryzyka „bus factor" w sensie interpersonalnym. Ryzyko koncentracji wiedzy istnieje, ale ma wyłącznie charakter dokumentacyjny: jeśli autor nie opisał decyzji architektonicznych, nikt inny ich nie zna. Kontekst zmian przechowywany jest w `context/changes/` i `context/archive/` — to główny zewnętrzny magazyn wiedzy.

---

## Key Contributors per Area

| Obszar | Kontrybutor | Commity (6M) | Uwagi |
|---|---|---|---|
| `src/inngest/` | Szymon | 23 | Wszystkie commity |
| `src/app/api/` | Szymon | 4 | Wszystkie commity |
| `src/lib/` | Szymon | ~53 | Wszystkie commity |
| `src/app/(authenticated)/` | Szymon | ~43 | Wszystkie commity |
| `src/app/share/` | Szymon | 14 | Wszystkie commity |
| `src/middleware.ts` | Szymon | 6 | Wszystkie commity |
| `supabase/migrations/` | Szymon | 8 | Wszystkie commity |

---

## Important Architectural Commits

### Pipeline core

| Hash | Opis | Dotknięte pliki |
|---|---|---|
| `6a3df37` | `feat: Inngest pipeline hardening + integration tests (Risks 2, 3, 6)` | `src/inngest/`, `src/app/(authenticated)/recipes/add-recipe-action.ts` |
| `915b40f` | `refactor: fix Firecrawl response shape, Inngest v4 trigger, extract slugify` | `src/inngest/functions.ts`, `src/lib/firecrawl.ts`, `src/lib/slugify.ts` |
| `6704eb5` | `chore(test-pure-pipeline-units): close out plan` | `src/inngest/`, `context/changes/` |
| `61dca94` | `chore: post-LLM recipe validator + remove dead trigger twin` | `src/lib/content-quality.ts`, `src/lib/content-quality.test.ts` |

### Share flow

| Hash | Opis | Dotknięte pliki |
|---|---|---|
| `b4f8ab8` | `feat: add manual URL input form for recipe extraction (#51)` | `src/app/(authenticated)/recipes/`, `src/app/share/` |
| `f66d788` | `fix(discovery-via-exa): re-throw Next.js redirect errors and log catch in searchViaExa` | `src/app/(authenticated)/recipes/search-via-exa-action.ts` |

### Discovery / Exa pivot

| Hash | Opis | Dotknięte pliki |
|---|---|---|
| `88e6184` | `feat(discovery-via-exa): add Exa search server action and tabbed recipe UI` | `src/app/(authenticated)/recipes/`, `src/app/components/` |
| `c7338c8` | `fix: exclude e2e from tsconfig and fix delete endpoint auth (#52)` | `tsconfig`, `src/app/api/recipes/delete/route.ts` |

### Auth & infrastruktura

| Hash | Opis | Dotknięte pliki |
|---|---|---|
| `0dd268b` | `chore(deps): upgrade wrangler + opennextjs, park PWA serwist migration` | `package.json`, Cloudflare config |
| `ad41814` | `feat: mobile layout fixes and logo-lettering in navbar (#101)` | `src/app/components/`, `src/app/layout.tsx` |

### Usunięta gałąź — Trigger.dev

Projekt zaczynał z Trigger.dev (`src/trigger/extract-recipe.ts`). Plik został usunięty przy migracji na Inngest (commit `915b40f` — „remove dead trigger twin"). Decyzja architektoniczna: Inngest lepiej pasuje do środowiska serverless (Cloudflare Workers / Vercel Edge). Kontekst tej decyzji istnieje w `context/changes/` ale nie ma osobnego change folderu dla samej migracji — wiedza jest w commit message.

---

## Knowledge Concentration Risks

| Ryzyko | Obszar | Sposób mitygacji |
|---|---|---|
| **Jedyny autor** — cały kontekst decyzji w jednej głowie | Cały projekt | Częściowo mitigowane przez `context/changes/` i `context/archive/` |
| **Brak opisu migracji Trigger.dev → Inngest** | `src/inngest/` | Decyzja zakopana w commit message `915b40f`; nie ma `research.md` ani `plan.md` dla tej zmiany |
| **`run-extract-recipe.ts` bez komentarzy architektury** | Pipeline | 350+ linii; logika rozgałęzień (FB/YT/Blogspot/web) nie jest opisana na poziomie architektury |
| **Firecrawl integration** | `src/lib/firecrawl.ts` | Opcje buildera (`buildFirecrawlOptions`, `buildEmbedScanOptions`) nie są opisane w żadnym design doc |
| **Cloudflare Workers / opennextjs config** | infrastruktura | `wrangler.jsonc`, OpenNext config — zmiany bez `context/changes/` folderu |
