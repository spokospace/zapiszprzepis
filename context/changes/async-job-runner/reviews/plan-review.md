<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: F-01 Trigger.dev async job runner

- **Plan**: `context/changes/async-job-runner/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-06-04
- **Werdykt**: DO POPRAWY → **SOLIDNY** (po sortowaniu)
- **Ustalenia**: 1 krytyczne · 3 ostrzeżenia · 2 obserwacje

## Werdykty

| Wymiar                       | Werdykt (przed) | Werdykt (po sortowaniu) |
| ---------------------------- | --------------- | ----------------------- |
| Zgodność ze stanem końcowym  | NIEZALICZONY    | ZALICZONY               |
| Oszczędna realizacja         | ZALICZONY       | ZALICZONY               |
| Dopasowanie architektoniczne | OSTRZEŻENIE     | ZALICZONY               |
| Martwe punkty                | OSTRZEŻENIE     | ZALICZONY               |
| Kompletność planu            | OSTRZEŻENIE     | ZALICZONY               |

## Ugruntowanie

Grounding: 7/7 ścieżek ✓, 6/6 symboli ✓, brief↔plan ✓.
Wszystkie ścieżki planu istnieją: `src/middleware.ts`, `src/lib/supabase/{server,proxy,client}.ts`, `scripts/check-auth.ts`, `.env.local.example`, `README.md`.
Grep `process.env.NEXT_PUBLIC_SUPABASE_URL!|...ANON_KEY!`: 6 wystąpień w 3 plikach (server.ts:8-9, proxy.ts:11-12, client.ts:5-6) — F1 ujawniło pominięcie client.ts.

## Ustalenia

### F1 — `src/lib/supabase/client.ts` pominięty + `lib/env.ts` wzorzec rozbija client bundle

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🔬 WYSOKI — stawki architektoniczne; pomyśl dokładnie przed podjęciem decyzji
- **Wymiar**: Zgodność ze stanem końcowym + Martwe punkty
- **Lokalizacja**: Faza 1 — Wymagane zmiany + Krytyczne szczegóły
- **Szczegóły**: `client.ts:5-6` używa `process.env.NEXT_PUBLIC_*!` — plan tego nie wymienia. Dynamic `requireEnv(name)` z string variable NIE jest inline'owany przez Next.js. `TRIGGER_SECRET_KEY` w jednym env.ts crashuje client bundle. Konsekwencje: kryterium 1.9 nie spełnione + złamanie magic-link auth w produkcji.
- **Poprawka A ⭐ Zalecana**: `import 'server-only'` w `lib/env.ts`; `client.ts` zostaje z literalami + komentarz; update kryterium 1.9 "POZA client.ts".
  - Siła: Oficjalny Next.js wzorzec; compile-time ochrona przed regresją server/client mix; minimum kodu.
  - Kompromis: client.ts ma outlier pattern (literal `!`); ESLint rule jeszcze nie skonfigurowana.
  - Pewność: WYSOKA — `'server-only'` to oficjalny Next.js wzorzec, NEXT_PUBLIC_* inline tylko dla literal access per docs.
  - Martwy punkt: ESLint rule może być scope creep (przyszłość).
- **Poprawka B**: jeden `lib/env.ts` z literal-preserving `required(name, process.env.X)`; client.ts migruje.
  - Siła: Jeden plik, jeden wzorzec, kryterium 1.9 spełnione dosłownie.
  - Kompromis: Brak compile-time guard; przyszły server-only var łatwo crash'uje client.
  - Pewność: ŚREDNIA.
  - Martwy punkt: Tree-shaking server vars niezweryfikowany.
- **Decyzja**: NAPRAWIONO (Poprawka A) — `import 'server-only'` dodane do `lib/env.ts`; `client.ts` świadomie pominięty w Fazie 1 z komentarzem; kryterium 1.9 zaktualizowane; notatka w Krytycznych szczegółach implementacji.

### F2 — `/test-trigger` middleware bypass nieprecyzyjny

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2 — Wymagane zmiany #8 (test page)
- **Szczegóły**: Plan mówi "dodać do public paths matcher" ale matcher to regex w `config.matcher`, nie explicit list. Implementator nie ma wskazówki: regex (brittle) czy explicit bypass w `middleware()`?
- **Poprawka**: explicit `if (pathname.startsWith('/test-trigger')) return response` w `middleware()` przed `if (!user)`, kopiując wzorzec `/auth/callback` (linie 10-12); update kryterium 2.12.
- **Decyzja**: NAPRAWIONO — nowy krok Faza 2 / #8a (Middleware bypass) z konkretnym kontraktem; kryterium 2.12 zaktualizowane.

### F3 — `TRIGGER_SECRET_KEY` Workers env scope niedoprecyzowane

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 3 — Wymagane zmiany #2
- **Szczegóły**: Plan "Build (jeśli build się wyłoży wtedy dodać)" — niedeterministyczne. Per `infrastructure.md` krok #4: Build vary służą inline NEXT_PUBLIC_*, nie runtime secrets.
- **Poprawka**: deterministyczne — tylko Runtime jako Secret; komentarz cytuje infrastructure.md.
- **Decyzja**: NAPRAWIONO — Faza 3.2 zaktualizowana z explicit "Build scope NIE jest potrzebny" + cytat infrastructure.md.

### F4 — httpbin.org fallback wskazuje na nieistniejący endpoint

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 2 — Wymagane zmiany #5 (przykładowy task)
- **Szczegóły**: Plan "(można podmienić na zapiszprzepis.pl/api/ping)" — endpoint nie istnieje, fallback martwy.
- **Poprawka**: PRIMARY `https://httpbin.org/anything`, FALLBACK `https://api.github.com/zen`; helper `tryFetch(url)` z primary→fallback fallthrough; `source` field w output.
- **Decyzja**: NAPRAWIONO — Faza 2 / #5 kontrakt zaktualizowany; `PRIMARY_URL` + `FALLBACK_URL` jako stałe, fallthrough logic, `source: 'primary' | 'fallback'` w return.

### F5 — `change.md` notatka nadal mówi "F-02 from roadmap"

- **Waga**: 📝 OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Kompletność planu
- **Lokalizacja**: `context/changes/async-job-runner/change.md:13`
- **Szczegóły**: Frontmatter title naprawione, ale `## Notes` jeszcze mówi "F-02".
- **Poprawka**: Edit `change.md:13` "F-02 from roadmap" → "F-01 from roadmap".
- **Decyzja**: NAPRAWIONO.

### F6 — Polling UI: brak specyfikacji co renderuje się dla `status: queued/executing`

- **Waga**: 📝 OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 2 — Wymagane zmiany #8b (test page)
- **Szczegóły**: Raw JSON UI akceptowalne dla dev page, ale wzorzec nie ustawiony dla S-01.
- **Poprawka**: dopisać do Otwartych ryzyk "test page UI to raw JSON; S-01 wymyśli wzorzec stanów loading".
- **Decyzja**: NAPRAWIONO — notatka dodana do "Otwarte ryzyka i założenia" z explicit referencją do S-01.

---

```
═══════════════════════════════════════════════════════════
  SORTOWANIE ZAKOŃCZONE
═══════════════════════════════════════════════════════════

  Naprawiono:    F1 (Poprawka A), F2, F3, F4, F5, F6   (6)
  Pominięto:                                            (0)
  Zaakceptowano:                                        (0)
  Odrzucono:                                            (0)

  ► Werdykt po poprawkach: DO POPRAWY → SOLIDNY
═══════════════════════════════════════════════════════════
```
