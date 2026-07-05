# UI improvements — Plan implementacji

## Przegląd

Seria czterech ulepszeń UI: (1) SVG logo + warunkowy chevron powrotu w navbarze, (2) trzy ostatnie przepisy na stronie głównej, (3) większy tekst wyników wyszukiwania Exa, (4) większy tekst chipów kategorii.

## Analiza stanu obecnego

- `AppHeader` (`src/app/components/app-header.tsx`) renderuje tekst "ZapiszPrzepis". Komponent jest serwerowy, renderowany z `(authenticated)/layout.tsx` (dla wszystkich tras `/recipes*`) oraz bezpośrednio z `src/app/page.tsx`.
- Logo SVG istnieje pod `public/logo.svg` — używane tylko na home page w `<Image>`.
- Widok detalu przepisu (`recipes/[slug]/page.tsx:96–101`) ma własny link "Powrót" w treści (poza navbarem), zajmujący pełen wiersz z `mb-8`.
- Strona główna (`page.tsx`) nie wyświetla ostatnich przepisów — tylko formularz i link do `/recipes`.
- `ExaResultsPanel` używa klas `text-sm`/`text-xs` — mały tekst na mobile.
- `CategoryFilter` używa `text-sm` dla chipów.

## Pożądany stan końcowy

- Navbar na każdej stronie: logo SVG po lewej; na widoku `/recipes/[slug]` — chevron-left przed logo linkujący do `/recipes`.
- Home page: poniżej formularza sekcja "Ostatnio dodane" z 3 kartami `RecipeCard` (widoczna tylko jeśli użytkownik ma ≥1 przepis).
- Wyniki wyszukiwania Exa: tytuł `text-base`, hostname i snippety `text-sm`.
- Chipy kategorii: `text-base` zamiast `text-sm`.

### Kluczowe odkrycia:

- `AppHeader` jest serwerowym komponentem — wymaga dodania `'use client'` + `usePathname`, aby wykryć trasę i warunkowo pokazać chevron.
- `form action={signOut}` (Server Action) działa bez zmian w komponentach klienckich w Next.js App Router.
- `NotificationBell` jest już klientowym komponentem — zmiana `AppHeader` na klientowy jest bezpieczna.
- RLS Supabase filtruje przepisy per-user — zapytanie o ostatnie przepisy na home nie potrzebuje jawnego `user_id` WHERE.
- `RecipeCard` props: `slug`, `title`, `imageUrl?`, `category` — komponent gotowy do reuse.

## Czego NIE robimy

- Ustawień font-size per-user (ani localStorage, ani Supabase) — zostawione na przyszłość.
- Śledzenia last_viewed_at — ostatnie przepisy = `created_at DESC LIMIT 3`.
- Nowego zasobu SVG dla navbar — używamy istniejącego `public/logo.svg`.
- Powiększania tekstu w innych miejscach niż `ExaResultsPanel` i `CategoryFilter`.

## Podejście do implementacji

Trzy niezależne zmiany w kolejności: najpierw AppHeader (zmienia komponent używany wszędzie), potem home page (dodaje nową sekcję), potem style tekstu (drobne edycje CSS).

## Faza 1: AppHeader — SVG logo + warunkowy back chevron

### Przegląd

`AppHeader` otrzymuje `'use client'` i `usePathname`. Na trasach pasujących do `/recipes/[slug]` (tj. `/recipes/` + jeden segment bez `/`) renderuje chevron-left jako link do `/recipes` przed logo. Logo staje się `<Image src="/logo.svg" />` zamiast tekstu. Istniejący link "Powrót" z detalu przepisu jest usuwany.

### Wymagane zmiany:

#### 1. AppHeader — klient + SVG logo + back chevron

**Plik**: `src/app/components/app-header.tsx`

**Cel**: Zastąpić tekst logo obrazkiem SVG; dodać warunkowy chevron-left przed logo gdy jesteśmy na widoku detalu przepisu.

**Kontrakt**: Dodać `'use client'` i importy `usePathname` (z `next/navigation`) i `Image` (z `next/image`). Logika: `const pathname = usePathname()` + `const isRecipeDetail = /^\/recipes\/[^/]+$/.test(pathname)`. Gdy `isRecipeDetail === true` — renderować przed logo `<Link href="/recipes">` z SVG chevron-left (np. 20×20px, `text-gray-600 hover:text-gray-900`). Logo: `<Image src="/logo.svg" alt="ZapiszPrzepis" width={120} height={41} unoptimized />` (proporcja ~2.95:1 wynikająca z viewBox 1970×668).

#### 2. Recipe detail page — usunięcie "Powrót"

**Plik**: `src/app/(authenticated)/recipes/[slug]/page.tsx`

**Cel**: Usunąć link "Powrót" z treści strony — jest teraz w navbarze.

**Kontrakt**: Usunąć blok `<Link href="/recipes" className="inline-flex items-center text-orange-600 ...">...</Link>` (linie 96–101).

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- TypeScript kompiluje się bez błędów: `npx tsc --noEmit`
- Linting przechodzi: `npx next lint`

#### Weryfikacja ręczna:

- Na `/` — navbar pokazuje logo SVG bez chevrona
- Na `/recipes` — navbar pokazuje logo SVG bez chevrona
- Na `/recipes/[slug]` — navbar pokazuje chevron-left przed logo; kliknięcie przenosi do `/recipes`; brak duplikatu "Powrót" w treści

**Uwaga implementacyjna**: Po zakończeniu tej fazy zatrzymaj się na ręczne potwierdzenie przed przejściem do Fazy 2.

---

## Faza 2: Strona główna — 3 ostatnie przepisy

### Przegląd

`HomePage` pobiera 3 ostatnio dodane przepisy (RLS per-user, `created_at DESC LIMIT 3`) i renderuje je w siatce `RecipeCard` poniżej formularza, powyżej linka "Zapisane przepisy →". Sekcja nie jest renderowana gdy brak przepisów.

### Wymagane zmiany:

#### 1. Home page — zapytanie + sekcja recent recipes

**Plik**: `src/app/page.tsx`

**Cel**: Pobrać 3 ostatnie przepisy i wyświetlić je w siatce przed buttonem "Zapisane przepisy".

**Kontrakt**:

Zapytanie (dodać po `getFailedShares`):
```typescript
const { data: recentRecipes } = await supabase
  .from('recipes')
  .select('slug, title, image_url, category')
  .order('created_at', { ascending: false })
  .limit(3)
```

Import: dodać `RecipeCard` z `'@/app/components/recipe-card'`.

Sekcja JSX — między `<AddRecipeForm>` a `<Link href="/recipes">`:
```tsx
{recentRecipes && recentRecipes.length > 0 && (
  <div className="mt-8">
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
      Ostatnio dodane
    </h2>
    <div className="grid grid-cols-3 gap-3">
      {recentRecipes.map((r) => (
        <RecipeCard
          key={r.slug}
          slug={r.slug}
          title={r.title}
          imageUrl={r.image_url ?? undefined}
          category={r.category}
        />
      ))}
    </div>
  </div>
)}
```

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- TypeScript kompiluje się bez błędów: `npx tsc --noEmit`

#### Weryfikacja ręczna:

- Użytkownik z ≥1 przepisem widzi sekcję "Ostatnio dodane" z ≤3 kartami
- Użytkownik bez przepisów NIE widzi sekcji (zero kart, zero headera)
- Karty linkują do właściwych `/recipes/[slug]`
- Layout nie łamie się na mobile (3 kolumny mogą być ciasne — sprawdzić)

**Uwaga implementacyjna**: Jeśli 3 kolumny są zbyt ciasne na mobile (< 375px), zmienić na `grid-cols-2 sm:grid-cols-3`. Zatrzymaj się na weryfikację ręczną przed Fazą 3.

---

## Faza 3: Powiększenie tekstu — Exa results + Category chips

### Przegląd

Drobne podwyżki rozmiarów tekstu w dwóch komponentach: `ExaResultsPanel` (tytuły i snippety wyników wyszukiwania) oraz `CategoryFilter` (chipy kategorii).

### Wymagane zmiany:

#### 1. ExaResultsPanel — większy tekst wyników

**Plik**: `src/app/components/add-recipe-form.tsx`

**Cel**: Poprawić czytelność wyników wyszukiwania Exa na mobile przez zwiększenie rozmiarów tekstu.

**Kontrakt**: W `ExaResultsPanel` (linie 20–87):
- Tytuł wyniku (`line 47`): `text-sm font-medium` → `text-base font-medium`
- Hostname (`line 48`): `text-xs text-gray-500` → `text-sm text-gray-500`
- Highlight snippety (`line 53`): `text-xs text-gray-600` → `text-sm text-gray-600`
- Link "Otwórz stronę" (`line 62`): `text-xs text-orange-600` → `text-sm text-orange-600`
- Badge "Już zapisany" (`line 66`): `text-xs text-green-600` → `text-sm text-green-600`
- Button "Zapisz" (`line 72`): `text-xs font-medium` → `text-sm font-medium`

#### 2. CategoryFilter — większe chipy

**Plik**: `src/app/components/category-filter.tsx`

**Cel**: Zwiększyć czytelność chipów kategorii na mobile.

**Kontrakt**: W klasie buttonów (`linia 57`): `text-sm font-medium` → `text-base font-medium`. Ikona: `size={15}` → `size={17}` (proporcjonalnie). Count badge (`linia 66`): `text-xs` pozostaje bez zmian.

### Kryteria sukcesu:

#### Weryfikacja automatyczna:

- TypeScript kompiluje się bez błędów: `npx tsc --noEmit`
- Linting przechodzi: `npx next lint`

#### Weryfikacja ręczna:

- Wyniki wyszukiwania Exa: tytuły i snippety czytelne na ekranie 375px
- Chipy kategorii: tekst większy, ikony proporcjonalne, badge z liczbą czytelny
- Żadna z tych zmian nie łamie layoutu na desktop

---

## Strategia testowania

### Kroki testowania ręcznego:

1. Zaloguj się i przejdź przez: `/` → `/recipes` → `/recipes/[slug]` → weryfikuj navbar na każdym
2. Na `/recipes/[slug]` kliknij chevron w navbar — powinien wrócić do `/recipes`
3. Na home page sprawdź sekcję "Ostatnio dodane" przy 0, 1, 2, 3+ przepisach
4. Wyszukaj przepis na home (tab "Wyszukaj przepis") — sprawdź czytelność wyników Exa na wąskim widoku (DevTools: 375px)
5. Na `/recipes` sprawdź chipy kategorii — rozmiar tekstu i wyrównanie ikon

## Referencje

- AppHeader: `src/app/components/app-header.tsx`
- Recipe detail page: `src/app/(authenticated)/recipes/[slug]/page.tsx`
- Home page: `src/app/page.tsx`
- ExaResultsPanel: `src/app/components/add-recipe-form.tsx:20–87`
- CategoryFilter: `src/app/components/category-filter.tsx`
- RecipeCard: `src/app/components/recipe-card.tsx`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany.

### Faza 1: AppHeader — SVG logo + back chevron

#### Automatyczne

- [x] 1.1 TypeScript kompiluje się bez błędów (`npx tsc --noEmit`) — 8cd7ed2
- [x] 1.2 Linting przechodzi (`npx next lint`) — 8cd7ed2

#### Ręczne

- [x] 1.3 Navbar na `/` pokazuje logo SVG, brak chevrona — de026e8
- [x] 1.4 Navbar na `/recipes` pokazuje logo SVG, brak chevrona — de026e8
- [x] 1.5 Navbar na `/recipes/[slug]` pokazuje chevron-left przed logo; kliknięcie → `/recipes`; brak duplikatu "Powrót" w treści — de026e8

### Faza 2: Strona główna — 3 ostatnie przepisy

#### Automatyczne

- [x] 2.1 TypeScript kompiluje się bez błędów (`npx tsc --noEmit`) — e2078ff

#### Ręczne

- [x] 2.2 Użytkownik z przepisami widzi sekcję "Ostatnio dodane" z ≤3 kartami — e2078ff
- [x] 2.3 Użytkownik bez przepisów nie widzi sekcji — e2078ff
- [x] 2.4 Karty linkują poprawnie; layout nie łamie się na mobile — e2078ff

### Faza 3: Powiększenie tekstu

#### Automatyczne

- [ ] 3.1 TypeScript kompiluje się bez błędów (`npx tsc --noEmit`)
- [ ] 3.2 Linting przechodzi (`npx next lint`)

#### Ręczne

- [ ] 3.3 Wyniki Exa czytelne na 375px
- [ ] 3.4 Chipy kategorii — większy tekst, proporcjonalne ikony, brak regresji na desktop
