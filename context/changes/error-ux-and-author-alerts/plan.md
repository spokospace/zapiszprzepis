---
change_id: error-ux-and-author-alerts
title: Obsługa błędów — dzwoneczek powiadomień + alerty autora
description: Nieudane ekstrakcje trafiają do dzwoneczka w nagłówku (Ponów / Odrzuć / Wyczyść wszystkie), a autor dostaje email przy trwałym fail
author: Szymon
status: implementing
dependencies:
  - S-01 (first-shared-recipe-fb-text)
---

# S-06: Error UX — notification bell + author alerts

> Plan spisany wstecz 2026-07-04 dla pracy wdrożonej bezpośrednio z rozmowy, aby `/10x-impl-review` miał punkt odniesienia. Fazy 1–2 wdrożone (PR #91); Faza 3 świadomie odłożona.

## Cel

Nieudane przetworzenia przepisów nie wiszą już w banerze nad listą, tylko żyją w **dzwoneczku powiadomień** w nagłówku (badge = liczba spraw do uwagi). Mama otwiera dzwoneczek i dla każdego wpisu ma „Ponów" i „Odrzuć", a na górze „Wyczyść wszystkie". Żadne udostępnione żądanie nie ginie cicho (NFR). Adresuje aktywny błąd na produkcji: baner nie znikał i przycisk „Ponów" był zepsuty (`action="javascript:throw…"`).

## Wymagania wstępne

- S-01: Complete (pipeline `recipe_shares` → Inngest `recipe/extract`, status enum `pending|completed|failed`, magic-link auth, RLS per-user)

## Fazy implementacji

### Faza 1: Nagłówek + dzwoneczek powiadomień (surface)

- `src/app/(authenticated)/layout.tsx` (nowy) — wspólny nagłówek nad trasami zalogowanymi; pobiera failed shares server-side i podaje do nagłówka.
- `src/app/components/app-header.tsx` (nowy) — przyklejony pasek: logo + dzwoneczek + wylogowanie (dotąd tylko na landingu).
- `src/app/components/notification-bell.tsx` (nowy, `'use client'`) — badge z liczbą, rozwijany panel z listą nieudanych, per wpis „Ponów"/„Odrzuć", „Wyczyść wszystkie", pusty stan; zamykanie na outside-click + Escape; `aria-expanded`/`aria-controls`/`role="menu"`.
- `src/lib/failed-shares.ts` (nowy) — `getFailedShares()`: zapytanie `status='failed' AND recipe_id IS NULL`, auto-resolve URL-i, które mają już przepis, dedup po URL; `import 'server-only'` jako bezpiecznik.
- `src/app/(authenticated)/recipes/dismiss-action.ts` (nowy) — `dismissShare` / `dismissAllFailedShares`: delete nieudanego wiersza (MVP, bez migracji enuma), `revalidatePath`.
- `src/app/(authenticated)/recipes/retry-action.ts` (zmiana) — `retryShare(shareId: number)` zamiast `FormData`; wołany bezpośrednio z dzwoneczka w `useTransition` (omija placeholder `javascript:throw`).
- `src/app/(authenticated)/recipes/recipes-content.tsx` + `page.tsx` (zmiana) — usunięcie inline banera i przekazywania `failedShares` (przeniesione do layoutu).
- `src/lib/supabase/server.ts` (zmiana) — wspólny guard `requireUser()` (client + getUser + redirect) dla akcji retry/dismiss.

### Faza 2: Odporność + naprawy z code-review

- `retry-action.ts` — gdy `inngest.send` padnie, cofnij status do `failed` (z `error_message`) zamiast zostawić w `pending` (który znika z dzwoneczka i gubi żądanie — łamałoby NFR); sprawdź błąd resetującego update; zostań na trasie przez `revalidatePath` zamiast `redirect` (dzwoneczek jest też na `/recipes/[slug]`).
- `dismiss-action.ts` — sprawdzaj i loguj błąd delete zamiast go połykać.
- `notification-bell.tsx` — `aria-controls` tylko gdy panel otwarty (bez wiszącego IDREF).

### Faza 3: Email do autora przy trwałym fail (FR-012 cz. 3) — NIE ROZPOCZĘTA

- Wysyłka transactional email (Resend przez `lib/env.ts`) w `src/inngest/functions.ts`, gdy Inngest wyczerpie retry i ekstrakcja trwale padnie: URL + komunikat błędu do autora.
- Świadomie odłożona; wymaga decyzji o kanale (Otwarte Pytanie #4 w mapie). Faza pozostaje oczekująca.

## Kryteria sukcesu

### Automated Verification
- [ ] `pnpm typecheck` przechodzi
- [ ] `pnpm lint` — 0 błędów
- [ ] `pnpm build` — kompiluje

### Manual Verification
- [ ] Nieudany przepis pojawia się w dzwoneczku (badge + wpis) zamiast w banerze
- [ ] „Odrzuć" usuwa wpis; „Wyczyść wszystkie" czyści listę
- [ ] „Ponów" ponawia i nie renderuje już `javascript:throw`
- [ ] Wpis znika automatycznie, gdy przepis dodał się inną drogą

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane, ` — <sha>` przy realizacji.

### Faza 1 — dzwoneczek (surface)
- [x] Nagłówek `(authenticated)/layout.tsx` + `app-header.tsx` — 9cf4e0a
- [x] `notification-bell.tsx` (badge, panel, Ponów/Odrzuć/Wyczyść wszystkie, pusty stan) — 9cf4e0a
- [x] `getFailedShares()` (auto-resolve + dedup) — 9cf4e0a, scoped w 4ce7d5c
- [x] `dismiss-action.ts` (delete + revalidatePath) — 9cf4e0a
- [x] `retryShare(shareId)` + usunięcie inline banera — 9cf4e0a
- [x] wspólny `requireUser()` — 4ce7d5c
- [x] a11y: Escape + aria-controls/role=menu — ef232b7

### Faza 2 — odporność (code-review fixes)
- [x] retry: revert do `failed` przy błędzie `inngest.send` + sprawdzenie update error — 4cd59e8
- [x] retry: `revalidatePath` zamiast redirect (usunięty martwy retrying-toast) — 4cd59e8
- [x] dismiss: sprawdzanie błędu delete — 4cd59e8
- [x] `import 'server-only'` w `failed-shares.ts` — 4cd59e8
- [x] aria-controls tylko gdy otwarty — 4cd59e8

### Faza 3 — email autora (FR-012 cz.3)
- [ ] transactional email przy trwałym fail w `src/inngest/functions.ts`

## What We're NOT Doing

- **Migracja enuma `dismissed`** — MVP odrzuca przez delete wiersza; miękki soft-delete odłożony.
- **Placeholder „Zapisuję…" (FR-010) i push (FR-011)** — nice-to-have, zaparkowane (V2).
- **Pełna ekstrakcja audio / retry z transkrypcją** — poza S-06.
- **Toast „Ponawiam…"** — usunięty; feedback = wpis znika z dzwoneczka (spójnie z „Odrzuć").
