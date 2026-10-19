# Przebudowa: publiczna aplikacja, wyszukiwarka, przepis, dostęp (WCAG 2.2 AA)

Projekt i specyfikacja: folder `design_handoff_zapiszprzepis_przebudowa/` (README.md + `designs/*.dc.html`, otwierają się w przeglądarce). Zasady z `ZASADY_PROJEKTU.md` dopisać do `CLAUDE.md`.

## Cel
Aplikacja publiczna: gość przegląda i szuka, zalogowany (Facebook/Google) ma ulubione i galerię, dodawanie przepisów tylko z pełnym dostępem (kod lub płatność). Czytelność dla starszych osób, WCAG 2.2 AA na każdym ekranie.

## Decyzje
Warianty wybrane w README, sekcja „Decyzje (finalne)”: 1c + nawigacja MENU z 1a; 1b nie wdrażamy.

## Zakres
### Fundamenty
- [ ] Tokeny: `#c2410c` dla przycisków z białym tekstem (zamiast `#f97316`), tekst pomocniczy min. `#374151` / 16 px, treść 19 px, cele dotyku min. 48 px, focus 3 px, podkreślone linki
- [ ] Strony publiczne (start, wyszukiwarka, kategoria, przepis, profil) poza grupą `(authenticated)`; RLS: odczyt przepisów dla `anon`
- [ ] Nagłówek zalogowanego: „Dodaj” · „MENU” z podpisami, „Powiadomienia” w MENU na telefonie (#323; pierwotnie trzeci przycisk w nagłówku); gość: „Zaloguj się” · „MENU”
- [ ] Menu: sekcje „Moje” i „Wszystkie przepisy według kategorii”

### Model danych
- [ ] Jeden przepis na link źródłowy (deduplikacja globalna po znormalizowanym `source_url`); ponowne dodanie → do Ulubionych
- [ ] Slug `/przepis/{slug}` (bez loginu), 301 ze starych `/recipes/[slug]`
- [ ] Tabela ulubionych (serce z podpisem)
- [ ] Profil: `username` (generowany), `display_name`, `first_name`, `gender` (raz, przy 1. logowaniu), `avatar_url`, `avatar_color`, `has_full_access`
- [ ] Kody dostępu (kod, limit, ważność, użyty przez)
- [ ] Pola przepisu: źródło do wyświetlania (domena / „YouTube · kanał”), `dish`, `variant_note` (AI przy ekstrakcji)
- [ ] Tagi: wiele naraz (AND), dopisać m.in. `kokosowe`, `owsiane`

### Ekrany (numery jak w README)
- [ ] 1c/1a Strona główna — gość i zalogowany
- [ ] 4 Wyszukiwarka: podpowiedzi, „W serwisie” / „Na blogach” (Exa, tylko zalogowani, na żądanie), zakres Wszystkich / Moich / Ulubionych
- [ ] 6 Kategoria z filtrami tagów
- [ ] Przepis: źródło + „Dodała …”, ulubione z „Cofnij”, wielkość tekstu A/A+/A++, odhaczanie składników, poprzedni/następny w liście źródłowej, galeria zablokowana dla gościa
- [ ] 8 Inne wersje tego samego dania (różnice w porcjach, czasie, składnikach)
- [ ] 6 Podobne przepisy (kategoria + wspólne tagi, bez wersji tego dania)
- [ ] C4 Tryb gotowania (Wake Lock)
- [ ] A7 Dodaj przepis (link; „ze zdjęcia — wkrótce”)
- [ ] 5 Powiadomienia: problem / w trakcie / gotowe, zrozumiałe powody błędów, pasek na stronie głównej
- [ ] 2a Mój profil: obrazek (wgrywanie lub kolor + litera), nazwa, imię, podgląd powitania z wołaczem
- [ ] 7 Profil publiczny `/u/{username}`
- [ ] 3a–3c Logowanie Facebook + Google (Supabase OAuth), wybór płci przy 1. logowaniu, odblokowanie kodem

### Do ustalenia
- [ ] Płatność za pełny dostęp
- [ ] Co z istniejącymi duplikatami przepisów
- [ ] Oficjalne logo Facebook/Google; konfiguracja aplikacji Meta (polityka prywatności, usuwanie danych)
