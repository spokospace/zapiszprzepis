---
change_id: cloudflare-pages-custom-domain
title: Cloudflare Workers production deploy on zapiszprzepis.pl
status: implementing
created: 2026-05-31
updated: 2026-05-31
archived_at: null
---

## Notes

Migracja runtime'u z Vercel (gdzie F-01 było zweryfikowane przez PR #1-#4) na **Cloudflare Workers + Static Assets** z `@opennextjs/cloudflare` adapterem, podpięta od razu pod custom domain `zapiszprzepis.pl`. F-01 archiwum oczekuje — ta change musi przejść e2e weryfikację magic-link auth zanim F-01 może być zarchiwizowane jako legitymnie "implemented". Path B (Workers + modern adapter) wybrane po researchu zamiast Path A (Pages + legacy adapter) — eliminuje optycznie mylący `.vercel/output/static` katalog z legacy stacka.

**change_id** pozostaje `cloudflare-pages-custom-domain` (historical; zmiana scope na Workers nie zmienia katalogu).

Wejścia:
- `context/foundation/infrastructure.md` — decyzja Cloudflare jako rekomendowana platforma
- `context/changes/auth-and-supabase-scaffold/` — F-01 scope (auth scaffold, status: impl_reviewed)

Decyzje:
- Workers (NIE Pages) + `@opennextjs/cloudflare` (modern adapter)
- **Vercel project = DELETE** w Phase 7 (clean break, no warm fallback)
- Workaround na issue #962: rename `src/proxy.ts` → `src/middleware.ts`

Out of scope:
- WWW redirect (`www.zapiszprzepis.pl` → apex) — opcjonalne, mama nie wpisze www
- PWA manifest start_url update — F-01 nie ma PWA, to późniejsza change
- Trigger.dev integration — to F-02 scope
- Warm fallback Vercel — clean break w Phase 7
