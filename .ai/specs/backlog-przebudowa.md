# Backlog: E01 — Przebudowa ZapiszPrzepis (publiczna aplikacja, wysoka czytelność)

> Format: Open Mercato (`om-backlog`) — epik `E01`, stories `E01-Sxx` z kryteriami Given/When/Then, linią `Epic:`, zależnościami i etykietami SDLC (kategoria / priorytet / ryzyko). To **dry-run** backlogu do zatwierdzenia — issue w GitHubie jeszcze nie są zakładane. Po akceptacji podziału: `om-prepare-issue` / `om-backlog` zakładają po jednym issue na story.
>
> Źródło: `design_handoff_zapiszprzepis_przebudowa/` (README.md + ZASADY_PROJEKTU.md), handoff z `spokospace/zapiszprzepis`.
> Stan kodu odniesienia: branch `fix/auth-email-links-token-hash`, Next.js App Router + Supabase + Tailwind v4, Inngest, Cloudflare Workers.

---

## E01 — Epik

**Wynik (dla użytkownika):** ZapiszPrzepis staje się aplikacją publiczną o wysokiej czytelności (grupa docelowa obejmuje osoby starsze). Gość przegląda i szuka przepisów; zalogowany (Facebook/Google) ma Ulubione i galerię zdjęć; dodawanie własnych przepisów wymaga pełnego dostępu (kod lub płatność). Cały interfejs jest odtworzony wg wariantu projektowego **1c (styl, typografia, kontrast) + struktura nawigacji 1a**, z **WCAG 2.2 AA jako twardym wymaganiem każdego ekranu**.

**Zakres (Now):** stories E01-S01 … E01-S17 poniżej.

**Poza zakresem (Non-goals):**
- Wariant **1b** (dolny pasek zakładek + stały panel boczny) — nie wdrażać, chyba że zostanie wybrany (`Propozycja B.dc.html`).
- Dodawanie przepisów ze **zdjęcia / zrzutu ekranu / książki** — w UI tylko stan „wkrótce” (wyszarzone).
- Płatność za pełny dostęp — ekran 3c pokazuje „Zobacz pełny dostęp” jako placeholder; sama bramka płatności to osobny epik.
- Obserwowanie profili, komentarze, oceny (gwiazdka świadomie odrzucona).
- Transkrypcja/analiza treści źródeł (pipeline ekstrakcji bez zmian poza nowymi stanami powiadomień).

**Ograniczenia i decyzje (obowiązują każdą story):**
- `WCAG-AA` — kontrast tekstu ≥ 4,5:1 (duże nagłówki 3:1), UI/obramowania pól 3:1, cele dotyku ≥ 48 px, widoczny focus (`outline: 3px solid #1d4ed8; offset 2px`), linki podkreślone, ikony zawsze z podpisem, brak przewijania w poziomie.
- `READABILITY` — treść 19 px (mobile), tekst pomocniczy ≥ 16 px `#374151`, przyciski główne 56–60 px.
- `COLOR` — pomarańcz akcji z białym tekstem to `#c2410c` (nigdy `#f97316` — 2,8:1).
- `VARIANT` — docelowy styl 1c, struktura 1a; pliki `.dc.html` to referencja wyglądu, nie kod.
- Pierwsza story wdrożeniowa (`E01-S01`) dopisuje te zasady do `CLAUDE.md` repo (ZASADY_PROJEKTU.md).

**Zależności zewnętrzne epiku:**
- Rejestracja aplikacji w **Meta for Developers** (Facebook Login) + klient OAuth w **Google Cloud** + włączenie obu providerów w Supabase (blokuje `E01-S12`).
- Publiczna polityka prywatności + instrukcja usuwania danych (wymagane przez Meta).

**Checklist stories:**

- [ ] E01-S01 — Design system i tokeny czytelności *(fundament, odblokowuje całe UI)*
- [ ] E01-S02 — Publiczny dostęp: wyjście stron z `(authenticated)` + RLS dla `anon` *(fundament)*
- [ ] E01-S03 — Model danych: źródło zamiast loginu, globalny dedup, slug `/przepis`, „kto dodał” *(fundament)*
- [ ] E01-S12 — Logowanie OAuth Facebook/Google + pierwsze logowanie (płeć) + wołacz *(fundament auth)*
- [ ] E01-S04 — Strona główna: gość i zalogowany
- [ ] E01-S05 — Jedna wyszukiwarka z wynikami i zakresem (Wszystkie / Moje / Ulubione)
- [ ] E01-S06 — Ulubione: serce z podpisem + przepływ gość → logowanie → zapis
- [ ] E01-S07 — Strona przepisu: przebudowa (powrót, prev/next, źródło, autor, galeria)
- [ ] E01-S08 — Tryb gotowania (pełny ekran, Wake Lock)
- [ ] E01-S09 — Menu (drawer): „Moje” + „Wszystkie wg kategorii”
- [ ] E01-S10 — Dodaj przepis: osobna strona `/dodaj`
- [ ] E01-S11 — Bramka dodawania: kod dostępu (ekran 3c)
- [ ] E01-S13 — Mój profil / Ustawienia (`/settings`)
- [ ] E01-S14 — Profil publiczny (`/u/{username}`)
- [ ] E01-S15 — Powiadomienia: pełny ekran + pasek na stronie głównej
- [ ] E01-S16 — Kategoria z tagami + podobne przepisy
- [ ] E01-S17 — Layouty desktop (A8, A9)

---

## Zależności i fale

Pełna niezależność nie jest możliwa — są **cztery fundamenty**, które odblokowują resztę. Po nich większość stories jest niezależna i można je prowadzić równolegle (osobne PR-y, osobni autorzy).

```
Fala 0 (fundamenty):
  S01 (design system) ─────────────► odblokowuje każde UI
  S02 (public/anon) ──┐
  S03 (model danych) ─┤ (S02 i S03 ~równoległe, dzielą migracje — koordynacja schematu)
  S12 (OAuth+płeć)  ──┘ (S12 zależy od S02)

Fala 1 (ekrany rdzeniowe, zależą od Fali 0):
  S04 home        (S01, S02)
  S05 szukaj      (S01, S02; zakres Moje/Ulubione dociąga S06)
  S07 przepis     (S01, S02, S03; serce ← S06; podobne ← S16)
  S09 menu        (S01; stan kłódki ← S11)

Fala 2 (funkcje/ekrany, w większości równoległe):
  S06 ulubione    (S02; id przepisu)
  S08 tryb got.   (S01; wejście z S07)
  S10 dodaj       (S01; bramka ← S11)
  S11 kod dostępu (S02)
  S13 ustawienia  (S01, S12, S03)
  S14 profil publ.(S02, S03)
  S15 powiadom.   (S01; rozszerza notification-bell)
  S16 kategoria+tagi (S01, S03)

Fala 3:
  S17 desktop     (S01 + ekrany, które poszerza: S04, S05, S07)
```

| Story | Zależy od | Można równolegle z | Ryzyko | Priorytet |
|---|---|---|---|---|
| S01 | — | wszystkim | low | high |
| S02 | — | S01, S03 | **high** (RLS, scoping) | high |
| S03 | — | S01, S02 | **high** (migracja, dedup, 301) | high |
| S12 | S02 | S01, S03 | **high** (auth) | high |
| S04 | S01, S02 | S05, S07, S09 | medium | high |
| S05 | S01, S02 | S04, S07, S09 | medium | high |
| S06 | S02 | S08, S10, S15, S16 | medium | medium |
| S07 | S01, S02, S03 | S04, S05, S09 | medium | high |
| S08 | S01, S07 | większością Fali 2 | low | medium |
| S09 | S01 | S04, S05, S07 | low | medium |
| S10 | S01, S11 | Fala 2 | medium | medium |
| S11 | S02 | Fala 2 | **high** (dostęp) | medium |
| S13 | S01, S12, S03 | Fala 2 | medium | medium |
| S14 | S02, S03 | Fala 2 | medium | low |
| S15 | S01 | Fala 2 | medium | medium |
| S16 | S01, S03 | Fala 2 | medium | medium |
| S17 | S01, S04, S05, S07 | — | low | low |

---

## Stories

### E01-S01 — Design system i tokeny czytelności
**Epic:** E01 · **Kategoria:** refactor, feature · **Priorytet:** high · **Ryzyko:** low · **Ref:** `Propozycja C`, sekcja „Design Tokens”, `ZASADY_PROJEKTU.md`

Fundament wizualny: tokeny kolorów/typografii, bazowe prymitywy (przycisk, karta, chip, pole), widoczny focus, cele dotyku, skala „Wielkość tekstu” A/A+/A++ w `localStorage`. Dopisuje zasady projektu do `CLAUDE.md`.

- **Given** dowolny ekran w nowym stylu, **When** używa koloru/typografii/odstępu, **Then** pochodzą z jednego zestawu tokenów (Tailwind theme / CSS vars) zgodnych z „Design Tokens”, bez `#f97316` na białym tekście.
- **Given** użytkownik korzysta z klawiatury, **When** fokusuje element interaktywny, **Then** widoczny jest kontur `3px #1d4ed8` z offsetem 2 px.
- **Given** treść przepisu, **When** użytkownik wybierze A / A+ / A++, **Then** skala 1 / 1,15 / 1,3 zapisuje się w `localStorage` i wraca po powrocie.
- **Given** `CLAUDE.md`, **When** story zakończona, **Then** zawiera zasady z `ZASADY_PROJEKTU.md` (WCAG, czytelność, kolory, model).
- **Pliki:** `src/app/globals.css`/theme Tailwind, nowy katalog prymitywów w `src/app/components/ui/`, hook/util `text-scale`, `CLAUDE.md`.
- **Uwaga:** brak nowej trasy; weryfikacja na istniejących ekranach + Storybook/przykład.

### E01-S02 — Publiczny dostęp: wyjście stron z `(authenticated)` + RLS dla `anon`
**Epic:** E01 · **Kategoria:** refactor, security · **Priorytet:** high · **Ryzyko:** high · **Ref:** README „Model danych i dostępu”, tabela dostępu

Strona główna, wyszukiwarka i przepis działają bez logowania; nagłówek ma warianty gość/zalogowany.

- **Given** niezalogowany gość, **When** wejdzie na stronę główną, wyszukiwarkę lub `/przepis/{slug}`, **Then** widzi treść (nie jest przekierowany na `/login`).
- **Given** klient `anon` w Supabase, **When** czyta przepisy, **Then** RLS zezwala na odczyt opublikowanych przepisów, a zapisy/dane prywatne (ulubione, profile) pozostają chronione per użytkownik (test izolacji: `anon` nie czyta cudzych ulubionych).
- **Given** gość na dowolnym ekranie, **When** patrzy na nagłówek, **Then** widzi „Zaloguj się” + MENU; zalogowany widzi Dodaj / Powiadomienia / MENU.
- **Pliki:** przeniesienie `page.tsx` (home), wyszukiwarki i przepisu poza grupę `(authenticated)`; `middleware.ts`; polityki RLS w `supabase/`; `src/app/components/app-header.tsx`.
- **Uwaga risk-high:** wymaga testu integracyjnego ścieżki odmowy i odczytu w złym zakresie + review drugiej osoby (SDLC).

### E01-S03 — Model danych: źródło zamiast loginu, globalny dedup, slug `/przepis`, „kto dodał”
**Epic:** E01 · **Kategoria:** refactor, feature · **Priorytet:** high · **Ryzyko:** high · **Ref:** README „Model danych i dostępu”, „Źródło zamiast loginu”, „Kto dodał”

Jeden przepis na znormalizowany `source_url` (globalnie), publiczny slug `/przepis/{slug}` z 301 ze starego `/recipes/[slug]`, etykieta źródła, „pierwszy dodający” i dane do profilu.

- **Given** dwóch użytkowników udostępnia ten sam link, **When** drugi go doda, **Then** nie powstaje kopia; przepis trafia do jego Ulubionych + komunikat „Ten przepis już jest… Dodaliśmy go do Twoich ulubionych.” + „Otwórz przepis”.
- **Given** istniejący przepis, **When** otwierany jest stary adres `/recipes/{slug}`, **Then** 301 → `/przepis/{slug}` (unikalny, sufiks przy kolizji, bez loginu w ścieżce).
- **Given** karta lub strona przepisu, **When** renderuje źródło, **Then** pokazuje domenę bez `www`/ścieżki (`aniagotuje.pl`) lub „YouTube · {kanał}” / „Facebook · {profil}”; dla przepisów bez strony „Z książki kucharskiej” / „Przepis od: {podane}”.
- **Given** przepis, **When** renderuje autora, **Then** „Dodała/Dodał {displayName}” (forma wg płci) z podkreślonym linkiem do `/u/{username}`; username generowany z imienia (małe litery, `ł→l`, bez diakrytyków, sufiks unikalności), nieedytowalny.
- **Pliki:** migracje `supabase/` (globalny unikalny indeks dedup, kolumna/relacja „added_by/first_sharer”, pola profilu), `src/lib/url-normalize.ts`, `src/lib/recipe-dedup.ts`, `src/lib/slugify.ts`, logika źródła (nowy util), `next.config`/route dla 301.
- **Uwaga risk-high:** migracja schematu w górę i w dół + plan rollbacku w PR; zmiana semantyki dedup z per-user na globalną — test izolacji i idempotencji.

### E01-S12 — Logowanie OAuth Facebook/Google + pierwsze logowanie (płeć) + wołacz
**Epic:** E01 · **Kategoria:** feature, security · **Priorytet:** high · **Ryzyko:** high · **Ref:** README 3a, 3b; „Wołacz”

Logowanie przez Facebooka/Google (zamiast nowego hasła), jednorazowy wybór płci po pierwszym logowaniu, wołacz w powitaniach.

- **Given** ekran `/login`, **When** użytkownik wybiera „Zaloguj przez Facebooka” lub „…Google”, **Then** `supabase.auth.signInWithOAuth` prowadzi przez `/auth/callback?next=…` i wraca zalogowany; pierwsze logowanie zakłada konto.
- **Given** profil bez płci po pierwszym callbacku, **When** użytkownik trafia na ekran 3b, **Then** wybiera „Kobietą/Mężczyzną” (jednorazowo, nieedytowalne), po zapisie wraca do `next`.
- **Given** znane imię, **When** aplikacja wita użytkownika, **Then** używa wołacza (słownik + reguły zapasowe `-sia/-nia/-cia/-zia→-u`, `-a→-o`); brak pewności → „Dzień dobry!”.
- **Given** konto Facebook bez emaila lub drugie konto z tym samym emailem, **When** logowanie, **Then** obsłużone (łączenie / brak kolizji).
- **Pliki:** `src/app/login/*`, `src/app/auth/callback/route.ts`, nowy ekran pierwszego logowania, pola profilu (płeć/wołacz), `src/lib/` util wołacza.
- **Uwaga:** blokuje zależność zewnętrzna (Meta/Google/Supabase providers); auth + sesje → review drugiej osoby i test ścieżki odmowy.

### E01-S04 — Strona główna: gość i zalogowany
**Epic:** E01 · **Kategoria:** feature · **Priorytet:** high · **Ryzyko:** medium · **Ref:** A1, A2, C1 · **Zależy:** S01, S02

- **Given** gość, **When** wchodzi na `/`, **Then** widzi hero `#fff7ed` (H1 „Czego dziś szukasz?”, pole 60 px, mikrofon, „Szukaj przepisu”), „Często szukane”, „Kategorie” (3 kol.), „Ostatnio dodane” (2 kol.), blok CTA „Załóż konto / Zaloguj się”.
- **Given** zalogowany, **When** wchodzi na `/`, **Then** widzi „Dzień dobry, {wołacz}”, pole wyszukiwania, kafle „Moje przepisy” (tylko pełny dostęp) / „Ulubione” / „Dodaj przepis”, „Kategorie” (2 kol.).
- **Given** dowolny stan, **When** renderuje kategorie, **Then** pochodzą z `src/lib/recipe-categories.ts` (8 pozycji).
- **Pliki:** `src/app/page.tsx`, komponenty hero/siatki, `recipe-search.tsx`.

### E01-S05 — Jedna wyszukiwarka z wynikami i zakresem
**Epic:** E01 · **Kategoria:** feature · **Priorytet:** high · **Ryzyko:** medium · **Ref:** C2, A3 · **Zależy:** S01, S02 (zakres Moje/Ulubione dociąga S06)

- **Given** zapytanie, **When** otwiera `/szukaj?q=`, **Then** widzi pole z „× Wyczyść”, licznik „N przepisów dla „q””, karty wyników (miniatura 96, tytuł 20 px, „Kategoria · czas”, źródło, pasek ulubionych) i „Pokaż kolejne 14” (bez infinite scroll).
- **Given** zalogowany, **When** patrzy na „Szukaj w:”, **Then** segment Wszystkich / Moich / Ulubionych (aktywny `#111827`); gość — segment ukryty.
- **Given** brak wyników, **When** lista pusta, **Then** „Nie ma tego, czego szukasz?” + „Szukaj „q” w internecie” (istniejąca wyszukiwarka zewnętrzna/Exa).
- **Pliki:** nowa trasa `src/app/szukaj/`, `recipe-search.tsx`, `recipe-card.tsx`, `category-filter.tsx`; utwardzenie zapytania (ILIKE/pg_trgm, indeks GIN).

### E01-S06 — Ulubione: serce z podpisem + przepływ gość → logowanie → zapis
**Epic:** E01 · **Kategoria:** feature · **Priorytet:** medium · **Ryzyko:** medium · **Ref:** README „Ulubione”, „Serce u gościa” · **Zależy:** S02

- **Given** zalogowany na karcie/przepisie, **When** klika serce „Dodaj do ulubionych”, **Then** optimistic update + komunikat „Dodano do ulubionych · Cofnij” (`role="status"`, ~5 s); stan „W ulubionych”.
- **Given** gość, **When** klika serce, **Then** przekierowanie `/login?next={url}&fav={id}`; po zalogowaniu przepis trafia do ulubionych i wraca na stronę.
- **Given** ikona ulubionych, **When** renderowana, **Then** zawsze z podpisem (bez samej ikony), nigdy gwiazdka.
- **Pliki:** tabela `favorites` + RLS, server action toggle, komponent przycisku, liczniki do menu, obsługa `fav=` w callbacku.

### E01-S07 — Strona przepisu: przebudowa
**Epic:** E01 · **Kategoria:** feature · **Priorytet:** high · **Ryzyko:** medium · **Ref:** C3, A4, A5 · **Zależy:** S01, S02, S03 (serce ← S06; podobne ← S16)

- **Given** wejście z listy źródłowej (wyniki/kategoria/ulubione), **When** otwiera przepis, **Then** pasek „← {nazwa listy}” + „N z M”, a Poprzedni/Następny prowadzą po tej liście; bez kontekstu — kategoria przepisu.
- **Given** strona przepisu, **When** renderuje nagłówek, **Then** zdjęcie 4:3, okruszki, tytuł 32 px, „Kategoria · czas”, „Źródło: …” (ikona globe) + „Otwórz oryginał”, „Dodała {autor}” z linkiem.
- **Given** składniki i kroki, **When** gotuje, **Then** checkboxy 32 px (odhaczane lokalnie, sessionStorage), kroki „Krok N z M”, działa „Wielkość tekstu”.
- **Given** gość, **When** patrzy na galerię, **Then** blok zablokowany (kłódka, „Galeria N zdjęć po zalogowaniu”, „Zaloguj się”); zalogowany — siatka zdjęć.
- **Pliki:** przeniesiony `recipes/[slug]/page.tsx` → `/przepis/[slug]`, kontekst listy źródłowej (`?from=…`/sessionStorage), `recipe-gallery.tsx`, przycisk trybu gotowania, sekcja podobnych.

### E01-S08 — Tryb gotowania (pełny ekran, Wake Lock)
**Epic:** E01 · **Kategoria:** feature · **Priorytet:** medium · **Ryzyko:** low · **Ref:** C4 · **Zależy:** S01, S07

- **Given** strona przepisu, **When** użytkownik włącza „Tryb gotowania”, **Then** pełny ekran `#111827`, pasek postępu segmentowy, „Krok N z M”, treść 30 px, przyciski „← Wstecz” / „Dalej →” 72 px.
- **Given** tryb gotowania aktywny, **When** ekran chciałby wygasnąć, **Then** `navigator.wakeLock.request('screen')` utrzymuje go, ponawiany po `visibilitychange`.
- **Given** użytkownik, **When** klika „× Zakończ”, **Then** wraca do przepisu, wake lock zwolniony.
- **Pliki:** nowy komponent trybu gotowania, util wake lock.

### E01-S09 — Menu (drawer)
**Epic:** E01 · **Kategoria:** feature · **Priorytet:** medium · **Ryzyko:** low · **Ref:** C5, A6, 3d · **Zależy:** S01 (stan kłódki ← S11)

- **Given** zalogowany, **When** otwiera MENU, **Then** sekcja „Moje” (Moje przepisy — tylko pełny dostęp z licznikiem, Ulubione z licznikiem, Dodaj przepis) + „Wszystkie przepisy według kategorii” (siatka 2 kol. z `recipe-categories.ts`) + stopka „Ustawienia | Wyloguj”.
- **Given** brak pełnego dostępu, **When** patrzy na „Dodaj przepis”, **Then** podpis „Wymaga kodu lub pełnego dostępu” + kłódka → ekran 3c.
- **Given** gość, **When** otwiera MENU, **Then** zamiast „Moje” — „Zaloguj się / Załóż konto”.
- **Pliki:** `src/app/components/app-menu.tsx` (nowy/rozbudowa), pełny ekran mobile / panel 330 px.

### E01-S10 — Dodaj przepis: osobna strona `/dodaj`
**Epic:** E01 · **Kategoria:** feature · **Priorytet:** medium · **Ryzyko:** medium · **Ref:** A7 · **Zależy:** S01, S11

- **Given** pełny dostęp, **When** wchodzi na `/dodaj`, **Then** kafel „Z linku” (aktywny) + „Ze zdjęcia — wkrótce” (wyszarzony), pole „Link do przepisu” z „Wklej” (Clipboard API), „Dodaj przepis”, lista 3 kroków.
- **Given** brak pełnego dostępu, **When** wchodzi na `/dodaj`, **Then** ekran 3c (bramka kodu).
- **Pliki:** nowa trasa `src/app/dodaj/`, `add-recipe-form.tsx`, `add-recipe-action.ts`.

### E01-S11 — Bramka dodawania: kod dostępu (ekran 3c)
**Epic:** E01 · **Kategoria:** feature, security · **Priorytet:** medium · **Ryzyko:** high · **Ref:** 3c · **Zależy:** S02

- **Given** użytkownik bez pełnego dostępu, **When** wpisze ważny kod i kliknie „Odblokuj”, **Then** sukces (`role="status"`, zielony ✓) i od razu formularz linku; kod jednorazowo przypisany do konta.
- **Given** zły kod, **When** zatwierdza, **Then** błąd `role="alert"` „Ten kod nie działa…”, ramka pola `#b91c1c` (wielkość liter bez znaczenia).
- **Given** tabela kodów, **When** kod użyty, **Then** zapis „użyty przez”, respektowanie limitu użyć i daty ważności.
- **Pliki:** tabela kodów + RLS, server action redeem, komponent 3c, flaga `hasFullAccess` w profilu/sesji.
- **Uwaga:** sprawdzić ponowne użycie istniejącego `invite-code-registration-gate` (S-07 w roadmap) — to bramka *dodawania*, nie *rejestracji*; możliwe współdzielenie tabeli kodów.

### E01-S13 — Mój profil / Ustawienia (`/settings`)
**Epic:** E01 · **Kategoria:** feature · **Priorytet:** medium · **Ryzyko:** medium · **Ref:** 2a · **Zależy:** S01, S12, S03

- **Given** zalogowany, **When** otwiera `/settings`, **Then** jeden ekran: obrazek (zdjęcie lub litera na kolorze z 6), „Nazwa przy przepisach”, „Imię”, podgląd (`aria-live`), „Zapisz zmiany” → „✓ Zapisano”, email (odczyt), „Wyloguj”.
- **Given** ekran ustawień, **When** renderowany, **Then** **nie** zawiera płci ani username.
- **Pliki:** `src/app/(authenticated)/settings/page.tsx`, upload avatara (bucket), wybór koloru.

### E01-S14 — Profil publiczny (`/u/{username}`)
**Epic:** E01 · **Kategoria:** feature · **Priorytet:** low · **Ryzyko:** medium · **Ref:** 7 · **Zależy:** S02, S03

- **Given** gość lub zalogowany, **When** otwiera `/u/{username}`, **Then** nagłówek (obrazek 88 px, nazwa, „Dodała/Dodał N przepisów”, „W ZapiszPrzepis od {mies. rok}”), chipy kategorii (tylko te z wpisami), lista przepisów dodanych jako pierwsza osoba + „Pokaż kolejne”.
- **Given** właściciel, **When** ogląda własny profil, **Then** blok „Tak widzą Twój profil inni.” + „Zmień nazwę lub obrazek” → `/settings`.
- **Given** profil bez przepisów, **When** renderowany, **Then** pusty stan + `noindex`; nie pokazujemy imienia/emaila/płci/ulubionych.
- **Pliki:** nowa trasa `src/app/u/[username]/`.

### E01-S15 — Powiadomienia: pełny ekran + pasek na stronie głównej
**Epic:** E01 · **Kategoria:** feature · **Priorytet:** medium · **Ryzyko:** medium · **Ref:** 5 · **Zależy:** S01 (rozszerza `notification-bell.tsx`)

- **Given** zalogowany, **When** otwiera powiadomienia, **Then** pełnoekranowy panel (nie dropdown 320 px) z sekcjami „Wymaga uwagi” / „W trakcie” / „Wcześniej” i kartami typu Problem / W trakcie / Gotowe.
- **Given** nieudany przepis, **When** widzi kartę Problem, **Then** domena + powód zrozumiałym językiem (mapowanie `error_message`) + „Spróbuj ponownie” / „Usuń”.
- **Given** problem istnieje, **When** gość/zalogowany na stronie głównej, **Then** pasek `#fef2f2`/`#b91c1c` „N przepisów wymaga uwagi” + „Zobacz”.
- **Pliki:** nowa trasa powiadomień, `notification-bell.tsx`, `src/lib/failed-shares.ts` + nowe stany „w trakcie”/„gotowe” (tabela udostępnień/Inngest), pasek na `page.tsx`.

### E01-S16 — Kategoria z tagami + podobne przepisy
**Epic:** E01 · **Kategoria:** feature · **Priorytet:** medium · **Ryzyko:** medium · **Ref:** 6 · **Zależy:** S01, S03

- **Given** kategoria, **When** otwiera `/przepisy/{kategoria}?tag=a,b`, **Then** nagłówek kategorii, chipy tagów (min. 48 px, zaznaczone `#111827` + ✓, liczniki, pierwsze 8 + „Pokaż wszystkie (N)”), logika AND (`contains('tags', …)`), podsumowanie `aria-live` + „× Wyczyść”.
- **Given** strona przepisu (dół), **When** renderuje tagi, **Then** „Ten przepis jest” + tagi jako przyciski → kategoria z tagiem; „Podobne” 3–4 przepisy z tej kategorii sortowane po wspólnych tagach; „Wszystkie {kategoria} (N) →”.
- **Given** `RECIPE_TAGS`, **When** story zakończona, **Then** dopisane `kokosowe`, `owsiane` i inne brakujące.
- **Pliki:** nowa trasa `src/app/przepisy/[kategoria]/`, `category-filter.tsx`, `src/lib/recipe-categories.ts`, sekcja podobnych w przepisie.

### E01-S17 — Layouty desktop (A8, A9)
**Epic:** E01 · **Kategoria:** refactor · **Priorytet:** low · **Ryzyko:** low · **Ref:** A8, A9 · **Zależy:** S01, S04, S05, S07

- **Given** szeroki ekran, **When** otwiera nagłówek, **Then** logo, „Przepisy”, „Kategorie ▾”, pole wyszukiwania (max 460 px), „+ Dodaj przepis”, dzwonek, MENU (gość: „Zaloguj się / Załóż konto”).
- **Given** desktop, **When** otwiera stronę główną gościa, **Then** hero H1 46 px, pole 760×64, kategorie 9 kol., „Ostatnio dodane” 4 kol.
- **Given** desktop, **When** otwiera przepis, **Then** układ `1fr 1.6fr` (składniki w panelu | kroki + galeria 4 kol.), prev/next obok siebie, podobne 4 kol.
- **Given** każdy ekran, **When** poszerzany, **Then** kontener `max-width: 1152px`, padding 32 px, bez przewijania w poziomie.
- **Pliki:** responsywne warianty w komponentach z S04/S05/S07 + `app-header.tsx`.

---

## Jak kontynuować (po akceptacji podziału)

1. **Założenie issue** — dla każdej story `om-prepare-issue` (albo `om-backlog <ten plik>` jednym przebiegiem) zakłada issue z etykietami SDLC i sekcjami Definition of Ready; backlog mirror w `.ai/specs/backlog.md`.
2. **Fundamenty najpierw** — S01, a potem S02 + S03 (koordynacja migracji) i S12; dopiero po nich równoległe ekrany.
3. **Spec dla cięższych stories** — S02, S03, S11, S12 (risk-high) warte pełnego spec (`om-auto-write-spec`) przed implementacją; reszta może iść wprost przez `om-auto-fix-issue`.
4. **UX/design** — referencje `.dc.html` są kontraktem wyglądu; `om-ux-review-pr` sprawdza zgodność ekranów w PR.

> ⚠️ Projekt `om` (Open Mercato) nie jest zainstalowany w tej sesji — ten backlog jest napisany ręcznie w jego formacie. Aby uruchomić realne skille: `npx skills add open-mercato/skills --skill '*'` + `/om-setup-agent-pipeline` (zapisze `.ai/agentic.config.json` i `SDLC.md`).
