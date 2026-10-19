# Instrukcja zmian: nagłówek mobile, wyszukiwanie, nazwa

Dla Claude Code. Repo `spokospace/zapiszprzepis`, stan wyjściowy: master z 19.10.2026 (po #323, powiadomienia już w menu). Projekty: `designs/Propozycja C - wysoka czytelność.dc.html` (1c), `designs/Wyszukiwarka.dc.html` (4). Zasady: `CLAUDE.md` / `ZASADY_PROJEKTU.md`. WCAG 2.2 AA, cele dotyku min. 48 px.

## 1. Nazwa „Zapisz Przepis”
- Wszędzie „Zapisz Przepis” (dwa słowa, wielkie litery) zamiast „ZapiszPrzepis”: nagłówek, logowanie (3a, /signup), tytuły stron (`… · Zapisz Przepis`), e-maile, `manifest.json` (`name`, `short_name`), `aria-label`, strony prawne.
- W zdaniach z odmianą: „w aplikacji Zapisz Przepis” (np. „W aplikacji Zapisz Przepis od marca 2026”, „Otwórz w aplikacji Zapisz Przepis”).
- Adres zawsze „zapiszprzepis.pl”.
- `brand-logo.tsx` → `LogoWordmark`: `<span>Zapisz</span><span className="ml-[.28em] text-action">Przepis</span>` (odstęp marginesem, nie spacją w JSX — nie znika przy formatowaniu). „Zapisz” `text-gray-900`, „Przepis” `#c2410c`.
- Testy: zaktualizować oczekiwane teksty i nazwy dostępne.

## 2. Nagłówek poniżej lg (`app-header.tsx`)
- Dla wszystkich (gość, zalogowany, pełny dostęp): **napis „Zapisz Przepis” · „Szukaj” · „MENU”**.
- Logo: sam napis, bez `LogoIcon`, 24 px bold, link do „/”, `aria-label="Zapisz Przepis — strona główna"`. Ikona zostaje na logowaniu, favicon, PWA. Od lg bez zmian (ikona + napis).
- **Usunąć „Dodaj” poniżej lg** (`hidden lg:inline-flex`). „Dodaj przepis” zostaje w menu (sekcja „Moje”; bez pełnego dostępu z kłódką i „Wymaga kodu lub pełnego dostępu”) i jako kafel na stronie głównej. Od lg „+ Dodaj przepis” bez zmian.
- **Nowy przycisk „Szukaj”**: 64×56 px, ikona `Search` 24 px nad podpisem 13 px bold (jak „MENU”), link do `/szukaj`. Ukryty na `/szukaj`. Od lg niewidoczny (jest `HeaderSearch`).
- „← Wróć” na podstronach bez zmian (zastępuje napis jak dziś).
- Sprawdzić 320 px: brak przewijania w poziomie.

## 3. /szukaj jako widok na całym ekranie (poniżej lg)
- Zamiast `AppHeader`: pasek „✕ Zamknij” (`router.back()`, fallback „/”) + tytuł „Szukaj przepisu” 20 px bold.
- Pole 60 px, tekst 19 px, `autoFocus` bez `q`. W polu: „Powiedz” gdy puste, „Wyczyść” gdy wpisano.
- Bez `q`: ostatnio szukane (localStorage, max 5, „Wyczyść historię”), kategorie.
- Pole na stronie głównej zostaje; wysłanie → `/szukaj?q=…`.
- **Pasek szybkich haseł na dole**, przyklejony nad klawiaturą (`position: sticky; bottom: 0`, viewport `interactive-widget=resizes-content`), widoczny bez hasła i przy 1–2 literach:
  - tytuł 16 px bold: „Ostatnio i często szukane” (gość: „Często szukane”),
  - chipy 48 px, 17 px bold, `rounded-full`, gap 8 px, przewijanie w poziomie tylko wewnątrz paska,
  - najpierw ostatnie (ikona `History`, ramka 2 px `#4b5563`), potem popularne (`TrendingUp`, tło `#fff7ed`, ramka `#fdba74`, źródło jak `PopularSearches`),
  - naciśnięcie = `/szukaj?q=…`.

## 4. Głos (`home-search.tsx`)
- Podpis „Powiedz” zamiast „Mów”, ramka 2 px `#4b5563`.
- Po naciśnięciu ekran „Słucham…”: koło 120 px `#c2410c` z pulsowaniem (bez animacji przy `prefers-reduced-motion`), napis 28 px, rozpoznany tekst na żywo 24 px (`interimResults: true`), przycisk „Przestań słuchać i pisz”. Po ciszy od razu wyszukiwanie. `role="status" aria-live="polite"`.
- Brak zgody na mikrofon: komunikat, jak ją włączyć. Brak API: przycisk ukryty (jak dziś).

## 5. Testy
- `app-header.test.ts`: poniżej lg brak „Dodaj”, jest „Szukaj” (oprócz `/szukaj`), napis „Zapisz Przepis” bez ikony; od lg bez zmian.
- `/szukaj`: „Zamknij” wraca, pasek chipów (gość tylko popularne), klik chipa wyszukuje.
- Głos: stany słuchania, przerwania, błędu zgody.
- Grep: brak „ZapiszPrzepis” w UI (poza adresem `zapiszprzepis.pl`).

## Bez zmian
Powiadomienia w menu + licznik na MENU (#323), menu z kategoriami, strona główna C1/A1, desktop A8/A9.
