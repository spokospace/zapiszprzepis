# Home & Recipe Mobile Layout — Implementation Plan

## Overview

Four Tailwind responsive-class fixes across four files. No logic changes, no data model changes. All fixes are purely presentation layer.

## Current State Analysis

- `src/app/page.tsx:33` — `py-12` is rem-based and non-responsive: applies 48px top/bottom padding on all screen sizes
- `src/app/components/add-recipe-form.tsx:189` — form `flex gap-2` puts the submit button inline with the input on all screen sizes; no wrapping occurs
- `src/app/(authenticated)/recipes/[slug]/page.tsx:97` — `h-96` = 24rem; when the device has a large accessibility font size (e.g. 20px base), `24rem = 480px`, making the container taller than it is wide (portrait) on a typical ~375px-wide phone
- `src/app/components/recipe-card.tsx:16` — `aspect-square` renders 1:1 thumbnails; food photos are typically landscape and the square crop wastes vertical space

## Desired End State

- Home page on phones: less empty space above the form (24px instead of 48px); form submit button occupies a full second row; mic button stays next to the input
- Recipe detail page: hero image is always landscape (4:3) regardless of phone font-size settings
- Recipe cards everywhere: thumbnails are 4:3 instead of square

### Key Findings

- `aspect-[4/3]` is a pure width-relative ratio — immune to `rem` scaling from accessibility settings; `h-96` is not
- Next.js `<Image fill>` works correctly with any `aspect-*` parent as long as the parent has `position: relative` — both hero and card wrappers already have `relative`
- Wrapping input + mic in a shared div is required for the mobile stacking: the submit button must be a direct flex child of the form to wrap to its own row; the input and mic should remain in the same row on mobile

## What We Are NOT Doing

- Not changing padding on auth pages (login, signup, forgot-password, reset-password) — the `py-12` there is intentional vertical centering
- Not changing the mic button position — it stays next to the input
- Not touching the YouTube `aspect-video` iframe — already correct
- Not changing card text layout or hover effects
- Not updating the `sizes` attribute on card `<Image>` (currently `100vw` on mobile even in a 2-col grid — separate optimization)

## Phase 1: Responsive Tailwind Fixes

### Required Changes

#### 1. `src/app/page.tsx`

**Cel**: Reduce vertical spacing above the form on mobile screens.

**Kontrakt**: Line 33 — replace `py-12` with `py-6 sm:py-12`.

#### 2. `src/app/components/add-recipe-form.tsx`

**Cel**: On screens < 640px the submit button ("Szukaj" / "Dodaj przepis") should occupy its own full-width row below the input; on ≥ 640px everything stays in one row.

**Kontrakt**: Three targeted edits, all in the `return` block:

1. Form element (line 189): `flex gap-2` → `flex flex-col gap-2 sm:flex-row`
2. Wrap the existing input `<div className="relative flex-1">` (line 190) AND the mic `<button>` block (lines 204–213) together in a new `<div className="flex gap-2 sm:flex-1 min-w-0">` wrapper
3. Submit button (line 215): add `w-full sm:w-auto justify-center` to its `className`

On mobile (`flex-col`): the wrapper div (input + mic) fills the full width; the submit button below it also gets `w-full`.  
On desktop (`sm:flex-row`): the wrapper grows via `sm:flex-1`; submit reverts to `sm:w-auto`.

#### 3. `src/app/(authenticated)/recipes/[slug]/page.tsx`

**Cel**: Fix the hero image becoming portrait-tall on devices with large accessibility text settings.

**Kontrakt**: Line 97 — replace `h-96` with `aspect-[4/3] sm:aspect-video`:

```
before: relative w-full h-96 rounded-lg overflow-hidden mb-8
after:  relative w-full aspect-[4/3] sm:aspect-video rounded-lg overflow-hidden mb-8
```

#### 4. `src/app/components/recipe-card.tsx`

**Cel**: Show recipe card thumbnails in 4:3 landscape ratio instead of square.

**Kontrakt**: Line 16 — `aspect-square` → `aspect-[4/3]`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- TypeScript typecheck passes: `npm run typecheck`
- No lint errors: `npm run lint`

#### Weryfikacja ręczna

- Home page on phone: top padding visually smaller (gap above description text noticeably reduced)
- Submit button ("Szukaj" / "Dodaj przepis") takes full width on phone (< 640px), inline on wider screens
- Mic button stays in the same row as the input on mobile
- Recipe detail hero: image container is landscape (wider than tall) even with phone font size set to "Large" or "Extra Large"
- Recipe cards: thumbnails are 4:3 landscape ratio on home page grid and recipes list

## Strategia testowania

### Testy manualne

1. Open home page on a phone-width browser (375px) — verify reduced top padding
2. Tab to "Dodaj przez link", check "Dodaj przepis" button is full-width below the input
3. If on iOS/Android with SpeechRecognition, verify mic button stays next to the input
4. Open a recipe with an image on a phone set to large text (iOS: Settings → Display & Brightness → Text Size; Android: Settings → Display → Font Size) — verify hero image is landscape
5. Check recipe cards on home ("Ostatnio dodane") and `/recipes` — verify 4:3 thumbnails

### Regresja

- Desktop (≥ 640px): form still shows input + submit in one row
- Desktop: hero image shows in 16:9 landscape (`sm:aspect-video` at max-width 672px ≈ 378px height)

## Referencje

- Change: `context/changes/home-mobile-layout/change.md`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany.

### Faza 1: Responsive Tailwind Fixes

#### Automatyczne

- [x] 1.1 TypeScript typecheck passes: `npm run typecheck`
- [x] 1.2 No lint errors: `npm run lint`

#### Ręczne

- [x] 1.3 Home page top padding visually smaller on phone (< 640px)
- [x] 1.4 Submit button full-width on mobile, inline on desktop
- [x] 1.5 Mic button stays next to input on mobile
- [x] 1.6 Recipe detail hero image is landscape with phone large-text setting
- [x] 1.7 Recipe card thumbnails are 4:3 landscape ratio
