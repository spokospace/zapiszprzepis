# F-01 follow-up: Platform migration Vercel → Cloudflare Workers

## Co się zmieniło

F-01 (auth scaffold) został zaimplementowany i przegłosowany na Vercel (PR #1-#4, May 2026), ale produkcja docelowa była Cloudflare. 2026-06-02 zmigrowaliśmy runtime z Vercel na **Cloudflare Workers + Static Assets** z adapterem `@opennextjs/cloudflare`. Vercel projekt został skasowany (clean break, no warm fallback per `infrastructure.md` plan ewakuacji).

## Kiedy

- F-01 plan: 2026-05-28
- F-01 implementacja: 2026-05-29 (PR #1-#4 merged)
- F-01 review: 2026-06-01 (6 lessons zapisanych w `context/foundation/lessons.md`)
- Cloudflare migration plan: 2026-05-31 (`context/changes/cloudflare-pages-custom-domain/plan.md`)
- Cloudflare migration completion: 2026-06-02 (commit `81765c8` merged to master, Phase 1-6 zweryfikowane, Phase 7 docs to ten plik + rówieśniki)

## Co zostało zweryfikowane na Vercel (legacy)

Faza 5.4-5.6 z `auth-and-supabase-scaffold/plan.md`:
- Vercel autodeploy zielony po squash-merge PR #1
- Production magic-link flow działa po dodaniu `NEXT_PUBLIC_SITE_URL` w Production scope env vars
- Sign-out czyści cookies, redirect na `/login`

Detale: `context/changes/auth-and-supabase-scaffold/change.md` (status flip do `implemented` w epilogue commit `8ffdcda`).

## Co zostało zweryfikowane na Cloudflare Workers

Pełny test e2e na `https://zapiszprzepis.pl` (Phase 6 z migration plan):

- Cold start: incognito → `zapiszprzepis.pl` → 307 redirect na `/login` → polski formularz + logo
- Submit email → `/login?sent=1&email=...` → komunikat "Wysłaliśmy link na …"
- Email w skrzynce w <1 min, `From: noreply@mail.app.supabase.io`
- Link href zaczyna się od `https://zapiszprzepis.pl/auth/callback?code=...` (poprawna domena po Supabase allowlist update)
- Klik → callback → "Zalogowano jako cnk.one@gmail.com" + przycisk wylogowania
- Session persiststs na refresh (cookie `sb-<ref>-auth-token` obecny)

Curl smoke tests:
- `curl -I https://zapiszprzepis.pl` → 307, `Location: https://zapiszprzepis.pl/login`, `Server: cloudflare`, SSL OK
- `curl -I https://zapiszprzepis.pl/login` → 200, `Server: cloudflare`

## Workaround #962 — middleware.ts rename

Next.js 16 zmieniło konwencję z `middleware.ts` na `proxy.ts`. Plik F-01 oryginalnie był jako `src/proxy.ts`. Ale `@opennextjs/cloudflare` (v1.19.11) **nie wspiera** Next 16 `proxy.ts` — issue https://github.com/opennextjs/opennextjs-cloudflare/issues/962 (open od Oct 2025).

Workaround zastosowany w Phase 1 (commit `74001ff`): rename `src/proxy.ts` → `src/middleware.ts`, funkcja `proxy` → `middleware`. Next.js akceptuje obie nazwy (rename jest backwards-compatible non-breaking). Konsekwencje:
- `next build` warning: `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` — expected, ignorujemy
- Gdy issue #962 zostanie zamknięte, można przemianować z powrotem

## Konsekwencje dla recurring rules

Migracja ujawniła klasę bugów udokumentowaną w nowej regule lessons.md:
- **Update Supabase Auth Site URL + Redirect URLs on every deployment URL change** — Supabase Site URL + Redirect URLs allowlist muszą być zsynchronizowane z każdym nowym deployment URL. Brak update'u skutkuje cichym fallbackiem magic-link na Site URL (default `http://localhost:3000`), co zostało zaobserwowane **dwukrotnie** w trakcie tego projektu (Vercel deploy F-01 + Cloudflare migration Phase 6).

Reguła zostaje wpisana do `context/foundation/lessons.md` jako rule #7.

## Linki

- Plan migracji: `context/changes/cloudflare-pages-custom-domain/plan.md`
- Plan brief: `context/changes/cloudflare-pages-custom-domain/plan-brief.md`
- Decyzja platformy: `context/foundation/infrastructure.md`
- Reguły: `context/foundation/lessons.md`
- PR #5 (Cloudflare migration squash merge): https://github.com/spokospace/zapiszprzepis/pull/5
- Production URL: https://zapiszprzepis.pl
- Worker URL: https://zapiszprzepis.szymon-spoko-space.workers.dev (subdomena Cloudflare account)
