# UI improvements — Krótki plan

> Pełny plan: `context/changes/uix-changes/plan.md`

## Co i dlaczego

Cztery niezależne ulepszenia UI: logo SVG w navbarze zamiast tekstu, chevron powrotu w navbarze na widoku przepisu, sekcja trzech ostatnich przepisów na stronie głównej, oraz większy tekst w wynikach wyszukiwania i chipach kategorii. Motywacja: spójność wizualna, czytelność na mobile.

## Punkt wyjścia

Navbar renderuje tekst "ZapiszPrzepis". Logo SVG istnieje w `public/logo.svg` ale jest używane tylko na home. Link "Powrót" na widoku przepisu jest w treści strony, nie w navbarze. Home nie wyświetla przepisów użytkownika.

## Pożądany stan końcowy

Każda strona ma navbar z logo SVG; widok `/recipes/[slug]` ma dodatkowo chevron-left przed logo. Strona główna wyświetla sekcję "Ostatnio dodane" z ≤3 kartami jeśli użytkownik ma przepisy. Wyniki wyszukiwania Exa i chipy kategorii mają czytelniejszy tekst na mobile.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
|---------|-------|---------------------|--------|
| Ustawienia font-size | Nie teraz | Powiększamy na sztywno — zero nowego stanu, prostsze | Plan |
| Logo w navbar | Istniejące logo.svg | Brak potrzeby nowego zasobu graficznego | Plan |
| Back chevron mechanism | usePathname w AppHeader | Jeden komponent, wykrywa trasę bez zmian w layoutach | Plan |
| Ostatnie przepisy | 3 ostatnio DODANE (created_at) | Proste zapytanie, jasna semantyka | Plan |
| Układ ostatnich przepisów | Grid 3 kart RecipeCard | Reuse istniejącego komponentu, spójny wygląd z /recipes | Plan |
| Które wyniki wyszukiwania | Tylko Exa (ExaResultsPanel) | Wyniki lokalne na /recipes to już karty RecipeCard | Plan |

## Zakres

**W zakresie:**
- SVG logo w `AppHeader` (zastąpienie tekstu)
- Chevron-left przed logo na `/recipes/[slug]`, usunięcie "Powrót" z treści
- Sekcja "Ostatnio dodane" na home (3 karty RecipeCard)
- Większy tekst w `ExaResultsPanel` (tytuł, hostname, snippety, przyciski)
- Większy tekst chipów w `CategoryFilter` (text-sm → text-base)

**Poza zakresem:**
- Ustawienia font-size per-user (localStorage lub Supabase)
- Śledzenie last_viewed_at
- Nowe zasoby SVG
- Powiększanie tekstu poza ExaResultsPanel i CategoryFilter

## Architektura / Podejście

`AppHeader` staje się klientowym komponentem (`'use client'` + `usePathname`) — jedyna zmiana architektoniczna. Pozostałe fazy to drobne edycje: dodanie zapytania Supabase na home page i zmiana klas CSS w dwóch komponentach.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|------|-------------|-----------------|
| 1. AppHeader | Logo SVG + chevron powrotu | AppHeader staje się client component — upewnić się że NotificationBell nie powoduje problemów z hydracją |
| 2. Ostatnie przepisy | Sekcja 3 kart na home | 3 kolumny mogą być ciasne na mobile < 375px — fallback grid-cols-2 |
| 3. Tekst | Większy tekst w Exa results + category chips | Ryzyko minimalne — tylko klasy CSS |

**Wymagania wstępne:** Brak — wszystkie zmiany są niezależne od siebie nawzajem.  
**Szacowany nakład pracy:** ~1 sesja implementacyjna, 3 fazy.

## Otwarte ryzyka i założenia

- Logo `public/logo.svg` ma proporcje panoramiczne (viewBox 1970×668) — przy małej wysokości w navbarze może być trudno odczytać na bardzo wąskich ekranach; do weryfikacji ręcznej.
- AppHeader jako client component: Server Action `signOut` w `<form action={signOut}>` działa w komponentach klienckich w Next.js App Router — brak ryzyka.

## Kryteria sukcesu (podsumowanie)

- Logo SVG widoczne w navbarze na każdej stronie
- Na widoku przepisu: kliknięcie chevrona w navbar wraca do `/recipes` bez duplikatu "Powrót" w treści
- Home page wyświetla ostatnio dodane przepisy (gdy istnieją)
