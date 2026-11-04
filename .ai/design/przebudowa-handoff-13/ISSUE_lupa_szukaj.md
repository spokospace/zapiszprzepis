# Lupa „Szukaj” w nagłówku (mobile), „Dodaj” tylko dla pełnego dostępu, wyszukiwanie na całym ekranie

Projekt: `designs/Wyszukiwarka.dc.html` (ekran 4), `designs/Propozycja C - wysoka czytelność.dc.html` (nagłówek 1c). README: sekcja „4 — Wyszukiwarka na pełnym ekranie”.

## Nazwa
- **Nazwa:** wszędzie „Zapisz Przepis” (dwa słowa, wielkie litery) — w nagłówku (napis: „Zapisz” `#111827`, „Przepis” `#c2410c`, odstęp `margin-left:.28em`), na logowaniu, w tytułach stron (`… · Zapisz Przepis`), e-mailach, `manifest.json` i `aria-label`. W zdaniach z odmianą: „w aplikacji Zapisz Przepis”. Adres = „zapiszprzepis.pl”. Zamienić wszystkie „ZapiszPrzepis” w UI i `LogoWordmark`.

## Nagłówek (poniżej lg)
- [ ] Wszyscy: napis „Zapisz Przepis” · **„Szukaj”** · „MENU”. Usunąć „Dodaj” z nagłówka poniżej lg (`lg:inline-flex hidden`); zostaje w menu i jako kafel na stronie głównej.
- [ ] „Szukaj”: 64×56 px, ikona `Search` 24 px nad podpisem 13 px bold, jak „Dodaj” i „MENU”. Link do `/szukaj`, bez samej ikony.
- [ ] Nie pokazywać na `/szukaj` (tam jest już pole).
- [ ] Logo w nagłówku mobile: sam napis „Zapisz Przepis” (bold, „Przepis” w `#c2410c`), bez ikony. 24 px. Link do „/”, `aria-label="Zapisz Przepis — strona główna"`. Ikona `logo-icon.svg` zostaje na logowaniu (3a), /signup, favicon i PWA; od lg nagłówek bez zmian (ikona + napis). Sprawdzić 320 px bez przewijania w poziomie.
- [ ] Od lg bez zmian: zalogowany ma `HeaderSearch`, gość „Przepisy” w `HeaderNav`.

## /szukaj jako widok na całym ekranie (poniżej lg)
- [ ] Nagłówek strony: „✕ Zamknij” (wraca do poprzedniej strony, `router.back()`, fallback `/`) + tytuł „Szukaj przepisu”, zamiast `AppHeader`.
- [ ] Pole dostaje focus po wejściu bez `q` (jest `autoFocus`).
- [ ] Bez `q`: ostatnie wyszukiwania (localStorage, max 5, „Wyczyść”), popularne hasła, kafle kategorii.
- [ ] Pasek szybkich haseł przyklejony do dołu widoku (nad klawiaturą: `position: sticky; bottom: 0` + `visualViewport`/`interactive-widget=resizes-content`), widoczny bez wpisanego hasła i podczas pisania do 2 liter. Tytuł 16 px bold „Ostatnio i często szukane” (gość: „Często szukane”). Chipy 48 px, 17 px bold, radius pełny, gap 8 px, przewijanie w poziomie wewnątrz paska (strona nie przewija się w bok). Najpierw ostatnie (ikona `history`, ramka 2 px `#4b5563`, max 5 z localStorage), potem popularne (ikona `trending-up`, tło `#fff7ed`, ramka `#fdba74`, z `PopularSearches`). Naciśnięcie = `/szukaj?q=…`.
- [ ] Pole na stronie głównej zostaje; jego wysłanie prowadzi do `/szukaj?q=…` jak teraz.

## Głos
- [ ] Przycisk „Powiedz” zamiast „Mów” (podpis widoczny, ramka 2 px `#4b5563`).
- [ ] Po naciśnięciu ekran „Słucham…”: koło 120 px `#c2410c` (pulsowanie wyłączone przy `prefers-reduced-motion`), tekst 28 px, rozpoznane słowa na żywo 24 px (`interimResults: true`), przycisk „Przestań słuchać i pisz”. Po ciszy wyszukiwanie od razu.
- [ ] Brak zgody na mikrofon: komunikat, jak ją włączyć. Brak API: przycisk ukryty (jak teraz).

## Testy
- [ ] `app-header.test.ts`: „Szukaj” widoczne poniżej lg dla gościa i zalogowanego, ukryte na `/szukaj`; „Dodaj” niewidoczne poniżej lg.
- [ ] Głos: stan „Słucham…”, przerwanie, błąd zgody.
