# Audyt zgodności z finalnym handoffem projektu (2026-10-17)

Zakres: ekrany E01 już wdrożone na `master` (S01–S07, S09, S11–S14, S16, S18 + nagłówek mobilny) porównane z `.ai/design/przebudowa-handoff/README.md` i `designs/*.dc.html` (styl 1c, nawigacja 1a). Poza zakresem: S08, S10, S15, S17 (w toku).

**Metoda i ograniczenia.** Porównanie kodu z `master` (commit f128a26) z README. Produkcja nie była osobno oglądana (kod jest źródłem prawdy; zachowania zależne od konfiguracji — np. włączone providery OAuth — oznaczono „do sprawdzenia na produkcji”). Pliki `.dc.html` czytano przez README; wymiary pikselowe pochodzą z README. Zero zmian w kodzie, zero zapisów do bazy.

**Skala:** **blocker** = rozmija się z decyzją „finalną” albo blokuje podstawową ścieżkę / WCAG; **major** = brakujący element lub wyraźnie inny wygląd/zachowanie; **minor** = rozmiar, kolor, copy.

## Podsumowanie

| # | Ekran | Blocker | Major | Minor |
|---|---|---|---|---|
| 0 | Nagłówek mobilny | 2 | 2 | 2 |
| 1 | Strona główna (C1/A1/A2) | – | 4 | 5 |
| 2 | Wyniki (C2/A3) | – | 3 | 4 |
| 3 | Przepis (C3/A4/A5) | 1 | 5 | 6 |
| 4 | Menu (C5/3d) | – | – | 3 |
| 5 | Ustawienia (2a) | – | 1 | 3 |
| 6 | Logowanie / dostęp (3a–3d) | 1 | 5 | 3 |
| 7 | Kategoria + tagi (6) | – | 4 | 3 |
| 8 | Profil publiczny (7) | – | 2 | 3 |
| 9 | Wersje przepisu (8) | – | 1 (brak w backlogu) | – |

Najważniejsze: (1) nagłówek mobilny nie ma trzech przycisków „ikona nad podpisem” i jest poza siatką celów dotyku; (2) „Dodaj” prowadzi do `/?tab=add`, a Powiadomienia to wciąż mały dropdown; (3) logowanie nie ma ekranu 3a (przyciski Facebook/Google nie są wypełnione, brak tekstów i stopki) — w README to osobny ekran; (4) „Poprzedni/Następny” stoi na górze zamiast na końcu przepisu; (5) ekran 8 „Wersje przepisu” **nie ma żadnej historyjki w backlogu** ani kolumn `dish` / `variant_note` w kodzie.

---

## 0. Nagłówek mobilny (brak własnej historyjki)

Kod: `src/app/components/app-header.tsx`, `notification-bell.tsx`, `app-menu.tsx` (przycisk MENU).

| Sev | Luka | Jest | Ma być |
|---|---|---|---|
| blocker | „Dodaj” to pomarańczowa pigułka | `bg-orange-500`, tekst `text-sm`, `px-3 py-1.5` (biały tekst na `#f97316` ≈ 2,8:1 — zakazane w `ZASADY_PROJEKTU`), ikona link 16 px, cel ≈ 32 px | przycisk 64 × 56, `#c2410c`, ikona 24 px nad podpisem 13 px bold, radius 12 |
| blocker | Powiadomienia i MENU bez podpisu pod ikoną / za małe | dzwonek: sama ikona 20 px, `p-2` (cel ≈ 36 px), `aria-label` tylko; MENU: ikona + tekst w rzędzie `text-sm`, cel 48 px | „Powiadomienia” ≥ 100 px szer., MENU 60 px, oba 56 px wys., ikona 24 px nad podpisem 13 px bold |
| major | Licznik dzwonka | `h-4`, `text-[10px]`, brak białej obwódki | koło 22 px `#b91c1c`, biały 13 px bold, obwódka 2 px biała |
| major | „Dodaj” prowadzi do `/?tab=add` (formularz na stronie głównej, bez pełnego dostępu → bramka na `/`) | link do `/` z query | docelowo `/dodaj` (S10); bez pełnego dostępu ekran 3c — do uzgodnienia ze S10 |
| minor | Wysokość i obramowanie nagłówka | `border-b` 1 px `gray-200`, `py-3`, sticky + blur | ~64 px, `border-bottom: 2px solid #e5e7eb`, padding `4px 12px 4px 16px` |
| minor | Lewa strona na przepisie | tylko chevron 20 px (cel ~20 px) + logo; chevron prowadzi do `/recipes` (Moje przepisy — tylko właściciel; gość nie widzi, bo `showBackToList` wymaga logowania) | „← Wróć” 18 px bold, cel 56 px, zamiast logo; powrót do listy źródłowej |
| minor | Gość: „Zaloguj się” | `min-h-[44px]`, `text-sm` | obramowany, 52 px |

**Propozycja:** nowa historyjka **E01-S19 — Nagłówek mobilny wg handoffu** (3 przyciski ikona-nad-podpisem, licznik, układ gościa, „← Wróć” na ekranach szczegółu). Priorytet: **high** (widoczne na każdym ekranie). S15 dołoży panel powiadomień, ale kształt przycisku w nagłówku należy do S19, nie do S15 — uzgodnić, żeby dwie sesje nie dotykały `notification-bell.tsx` naraz.

## 1. Strona główna (C1 / A1 / A2) — S04

Kod: `src/app/page.tsx`, `components/home/*`.

| Sev | Luka | Jest | Ma być |
|---|---|---|---|
| major | Kafle kategorii bez ikon i koloru | białe kafle, sama nazwa, `min-h-[64px]`, ramka szara | gość: kafel `#fff7ed`, ikona 26 px `#9a3412`, nazwa 17 px bold; zalogowany: kafel 56 px `#fff7ed`, `border 1.5px #fed7aa`, nazwa 18 px bold (ikony z `recipe-categories.ts` — sprawdzić, czy mapa ikon istnieje) |
| major | Blok CTA gościa | jasnoszary `surface-2`, „Zapisuj ulubione przepisy” | ciemny `#111827`, „Zapisuj przepisy z linku i zbieraj ulubione” + „Załóż konto” / „Zaloguj się” |
| major | Kafle skrótów zalogowanego | ikona w kółku 40 px, tytuł 19 px, brak chevronu | wiersz min. 64 px, ikona 28 px, tytuł 20 px bold, podpis 16 px, chevron |
| major | Formularz dodawania nadal na stronie głównej zalogowanego | `AddRecipeForm`/`AccessCodeGate` pod kategoriami | strona główna ma tylko wyszukiwarkę + 3 kafle + kategorie (formularz → `/dodaj`, S10) — zależność od S10, nie osobna naprawa |
| minor | Pole wyszukiwania gościa | ramka `field` (`#4b5563`), placeholder „np. sernik, pierogi” | ramka `2px #c2410c`, radius 14, placeholder „Danie lub składnik, np. dynia”, mikrofon jako ikona w polu |
| minor | Etykieta i przycisk zalogowanego | etykieta „Szukaj przepisu po nazwie lub składniku” 18 px nie-bold; przycisk „Szukaj przepisu” | „Czego szukasz?” 18 px bold; przycisk „Szukaj” 58 px |
| minor | Hero gościa | H1 30 px | 28 px; tło `#fff7ed` jest (OK) |
| minor | Przycisk mikrofonu | tekst „Mów” obok pola | ikona mikrofonu w polu (zachować podpis ze względu na „ikony zawsze z podpisem”) |
| minor | Pasek „N przepisów wymaga uwagi” | brak (slot S15) | S15 |

**Propozycja:** nowa historyjka **E01-S20 — Strona główna: dopasowanie wizualne do C1/A1** (kafle kategorii, CTA gościa, skróty, pole wyszukiwania). Formularz → S10.

## 2. Wyniki wyszukiwania (C2 / A3) — S05

Kod: `app/szukaj/page.tsx`, `components/search/*`, `recipe-card.tsx` (wariant `row`).

| Sev | Luka | Jest | Ma być |
|---|---|---|---|
| major | Pasek ulubionych na karcie ma złą treść | `FavoriteButton size="compact"`: „Ulubione” / „W ulubionych” w ramce 48 px `border-2` | pasek pod kartą 52 px z `border-top: 2px`: „♡ Dodaj do ulubionych” (`#111827`) / „♥ W ulubionych” (tło `#fff7ed`, tekst `#9a3412`) |
| major | Brak przycisku filtra „Kategoria” przy liczniku | tylko wiersz „N przepisów dla „q”” | po prawej przycisk „Kategoria” (filtr kategorii wyników) |
| major | „Nie ma tego, czego szukasz?” tylko przy braku wyników | `WebSearchFallback` renderowany wyłącznie gdy `rows.length === 0` | na końcu każdej listy wyników (A3), obok „Pokaż kolejne” |
| minor | Segment „Szukaj w:” | etykieta 16 px nie-bold `ink-soft`; segmenty 48 px | etykieta 16 px bold; segmenty 52 px |
| minor | Ramka karty | `border` 1 px | `border: 2px solid #e5e7eb` |
| minor | Tytuł karty | 20 px, `line-clamp-3` | 20 px, line-height 1.25, max 2 linie bez ucinania w środku słowa |
| minor | Strona ma dodatkowy H1 „Szukaj przepisu” 28 px nad polem | – | brak H1 w makiecie (pole z wartością + „× Wyczyść”); zostawić dla a11y, ale sprawdzić wysokość |

**Propozycja:** rozszerzyć **S05** (follow-up, nie nowa): „Kategoria” filtr + fallback internetowy zawsze na końcu; pasek ulubionych to wspólny element → **S06 follow-up** (wariant paska w `FavoriteButton`).

## 3. Strona przepisu (C3 / A4 / A5) — S07 (+S06, S16)

Kod: `app/przepis/[slug]/*`, `favorite-button.tsx`, `ui/text-size-controls.tsx`.

| Sev | Luka | Jest | Ma być |
|---|---|---|---|
| blocker | Poprzedni/Następny na górze | w `RecipeListBar` (nad zdjęciem), dwa przyciski obok siebie (siatka 2 kol.), tytuł `truncate` | tylko „← lista” + „N z M” u góry; **Poprzedni/Następny na końcu przepisu, jeden pod drugim**, 64 px, podpis 14 px bold „Poprzedni przepis”, tytuł 18 px bold (pełny, bez ucinania) |
| major | Kolejność sekcji i brak „Tryb gotowania” | ulubione → (komentarz S08) → wielkość tekstu → składniki → kroki | ulubione 58 px → „Wielkość tekstu” → „Tryb gotowania” 58 px `#111827` → składniki → przygotowanie → galeria → „Otwórz oryginał” → prev/next → podobne (tryb: S08) |
| major | Składniki bez „na N porcji” | brak liczby porcji w nagłówku sekcji | „na 4 porcje” pod „Składniki” (jeśli dane mają `servings`) |
| major | Kroki jako lista ze checkboxami | każdy krok ma pole wyboru 32 px | tylko etykieta „Krok 2 z 3” 17 px bold `#9a3412`, treść 19 px, line-height 1.6 (README: odhaczanie dotyczy składników) |
| major | Checkbox składnika | natywny `<input>` 32 px, `accent-action` (pomarańcz) | 32 px, `border 2.5px #4b5563`, zaznaczony `#15803d` + ✓ (zielony), wiersz min. 56 px, ilość 19 px **bold** (teraz zwykła, po „ — ”) |
| major | Dolny przycisk „Otwórz oryginał na YouTube” | link „Otwórz oryginał” tylko w wierszu źródła na górze | obramowany przycisk 48 px przed prev/next, z nazwą serwisu |
| minor | Wielkość tekstu | działa (A / A+ / A++ = 1 / 1.15 / 1.3, `localStorage`) — zgodne; przyciski 52×48 zgodne | – (zgodne, bez luki) |
| minor | Toast „Dodano do ulubionych · Cofnij” | `role="status"`, ~5 s, `Cofnij` — **zgodne**; widoczny `fixed bottom` | zgodne; sprawdzić tylko kolor (`bg-ink`) i że pozostaje czytelny nad ewentualnym dolnym UI |
| minor | Autor | „Dodane przez {nazwa}” (neutralnie, świadoma decyzja S14: płeć prywatna) | README: „Dodała/Dodał {nazwa}” wg płci — właściciel zdecydował: wdrożyć formę wg płci z profilu (patrz „Do decyzji” pkt 1) |
| minor | Okruszki | „Strona główna › Zupy › tytuł” | „Przepisy › Zupy” |
| minor | Ulubione u gościa | przycisk-link do logowania (OK) | – |
| minor | Podobne | siatka 2 kolumny kart-kafli, link „Wszystkie przepisy: {kat} (N) →” | 4 karty, „Wszystkie zupy (96) →” 56 px |
| minor | Wideo YouTube | osobna sekcja „Wideo” (poza makietą) | dopuszczalne rozszerzenie (decyzja S-04), ale w makiecie źródło YouTube = przycisk „Otwórz oryginał na YouTube” |

**Propozycja:** **E01-S07b — Strona przepisu: poprawki wg handoffu** (nowa historyjka; prev/next na dół, kolejność, checkboxy, „porcje”, kroki bez checkboxów, dolny przycisk oryginału). Pasek ulubionych/toast bez zmian poza wariantem z §2.

## 4. Menu (C5 / A6 / 3d) — S09

Kod: `app-menu.tsx`, `app-menu-model.ts`. **Najbliżej makiety** — pełny ekran na mobile, sekcje „Moje” / „Wszystkie przepisy według kategorii”, kafle 2 kol., stopka z Ustawienia | Wyloguj, kłódka + „Wymaga kodu lub pełnego dostępu”.

| Sev | Luka | Jest | Ma być |
|---|---|---|---|
| minor | Nagłówek „Menu” | 21 px | 22 px; przycisk „Zamknij” — 48 px (OK), makieta 56 px |
| minor | Kafle kategorii | `min-h-[56px]`, 17 px | 54 px (OK); brak ikon kategorii (nie wymagane w menu) |
| minor | Zablokowane „Dodaj przepis” prowadzi do `/` (bramka wbudowana w home) | `ACCESS_GATE_HREF = '/'` | ekran 3c — po S10 `/dodaj` |
| minor | Stopka | `min-h-[56px]` | 64 px; etykieta „Ustawienia” (zgodne z 1c) |

**Propozycja:** brak osobnej historyjki; poprawki 1-linijkowe dołączyć do S19.

## 5. Mój profil / ustawienia (2a) — S13

Kod: `app/(authenticated)/settings/*`. Zgodne: kółko 96 px, wgrywanie zdjęcia, 6 kolorów, brak płci/username, „Zapisz zmiany” → „✓ Zapisano”, email read-only, Wyloguj.

| Sev | Luka | Jest | Ma być |
|---|---|---|---|
| major | Kolor tła znika po wgraniu zdjęcia | `{!shownSrc && <fieldset>…}` | wybór koloru (6 przycisków 52 px) zawsze — wybrany `3px solid #111827` + ✓, `aria-label` z nazwą |
| minor | Etykieta | „Obrazek” | „Twój obrazek” |
| minor | Kolory | kółka 48 px w siatce 3 kol. z podpisami | przyciski 52 px |
| minor | Podgląd | „Tak zobaczą Cię inni” + osobne „Powitanie” na `surface-2` | jedno zdanie „Dzień dobry, Antonino! Dodałaś 3 nowe przepisy.” na `#fff7ed`, `aria-live="polite"` (zdanie z formą płci — patrz „Do decyzji”) |
| minor | Pola | 56 px | 60 px |

**Propozycja:** dopisać do **S13** (follow-up).

## 6. Logowanie i dostęp (3a–3d) — S12, S11

Kod: `app/login/*`, `app/witaj/*`, `components/access-code-gate.tsx`.

**3a — `/login`**

| Sev | Luka | Jest | Ma być |
|---|---|---|---|
| blocker | Brak nagłówka „Zaloguj się” (H1 to samo logo) i tekstu podrzędnego | logo 192 px w `<h1>`, od razu przyciski | „← Wróć”; logo 160×40; „Zaloguj się” 30 px; „Bez nowego hasła. Użyj konta, które już masz.” 18 px |
| major | Przycisk Facebook | wariant `outline`, ikona F granatowa | tło `#1877f2`, biały tekst, 60 px; Google `2px #4b5563` (jest) |
| major | Brak tekstu prywatności i stopki | – | „Pierwsze logowanie od razu zakłada konto. Nic nie publikujemy na Twoim Facebooku.”; linki do regulaminu i polityki prywatności (podkreślone) — **potrzebne strony** |
| major | Układ | OAuth nad formularzem email/hasło (separator „lub emailem”) | makieta ma tylko OAuth; email/hasło jako dodatek — decyzja właściciela, czy zostaje (konta QA/starsze konta) |
| minor | Logo marek | własne SVG dla G/F | zgodne z wytycznymi Meta/Google — sprawdzić proporcje/odstępy |
| – | Providery | `AUTH_OAUTH_PROVIDERS` — przyciski pojawiają się tylko po ustawieniu | **do sprawdzenia na produkcji**, czy oba są włączone |

**3b — `/witaj`**

| Sev | Luka | Jest | Ma być |
|---|---|---|---|
| minor | Nagłówek | „Witaj/…” 32 px + „Jedno pytanie na start.” | avatar 80 px, „Witamy, {wołacz}!” 30 px, „Jeszcze jedno pytanie, żeby dobrze się do Ciebie zwracać.” |
| minor | Przycisk „Dalej” | `primary lg`, aktywny od początku? (sprawdzić) | nieaktywny do wyboru |

**3c — bramka kodu (wbudowana w stronę główną, nie osobny ekran)**

| Sev | Luka | Jest | Ma być |
|---|---|---|---|
| major | Brak kłódki 64 px w kole `#fff7ed`, nagłówek 24 px | „Dodawanie przepisów” | „Dodawanie własnych przepisów” 28 px |
| major | Etykieta i pole | „Kod dostępu”, pole zwykłe | „Masz kod?”, monospace 20 px, uppercase |
| major | Brak „albo” + „Zobacz pełny dostęp” | „Pełny dostęp płatny — wkrótce.” | link do płatności (cel: ustalić z właścicielem) |
| minor | Komunikat błędu | „Ten kod nie działa. Sprawdź, czy wpisano go bez błędów.” bez ikony | ikona + „Ten kod nie działa. Sprawdź litery i spróbuj jeszcze raz.”, 17 px bold |
| minor | Sukces | „Gotowe — możesz dodawać przepisy.” | „Gotowe! Możesz dodawać przepisy.” (tło `#dcfce7` jest) |
| minor | „Ulubione działają bez ograniczeń, z kodem i bez.” | „Ulubione i galeria działają bez kodu.” | wg README |

**Propozycja:** **E01-S12b — ekran logowania 3a/3b wg handoffu** (nowa; wymaga stron regulaminu/polityki) oraz dopisek do **S11** (3c: kłódka, etykieta, wygląd; faktyczny ekran jako trasa gotowy przy S10).

## 7. Kategoria z tagami i podobne (6) — S16

Kod: `app/przepisy/[kategoria]/*`, `components/ui/chip.tsx`, `similar-recipes.tsx`.

| Sev | Luka | Jest | Ma być |
|---|---|---|---|
| major | Nagłówek kategorii | H1 24 px „{label}” | ikona 52 px + nazwa 28 px + „N przepisów w kategorii” |
| major | Pytanie przy tagach | H2 „Tagi” 18 px | „Jakie ciasteczka?” 19 px bold + „Możesz zaznaczyć kilka. Pokażemy przepisy, które pasują do wszystkich.” 16 px |
| major | Wynik jako kafle 2 kol. | siatka `RecipeCard` tile, wiele zdjęć bez czasu | lista kart (miniatura 84, tytuł 19 bold, „czas · źródło”, tagi „kruche · maślane” 16 px) — jak w C2 |
| major | Podsumowanie wyboru | „N przepisów z tagami: …” + „× Wyczyść” (jest) | „3 przepisy: kruche i czekoladowe” — treść tagów bez „z tagami:”; pusty stan „Brak … z tymi tagami” — zgodne w sensie |
| minor | Chipy | `border-2 border-border-card-2` (jasny szary), 48 px, ✓ — kształt zgodny | ramka `#9ca3af` 2 px (kontrast pól 3:1), licznik 16 px |
| minor | „Podobne” | brak podpisu „też kruche i czekoladowe”, tytuł „Podobne” | „Podobne: {tag} {kategoria}”, 3–4 karty z podpisem wspólnych tagów |
| minor | Paginacja | „← Nowsze / Strona N z M / Starsze →” | „Pokaż kolejne N” (spójnie z C2) |

**Propozycja:** dopisać do **S16** (follow-up), wspólna karta-lista z S05.

## 8. Profil publiczny (7) — S14

Kod: `app/u/[username]/page.tsx`. Zgodne: avatar 88, „W ZapiszPrzepis od…”, chipy z ✓ i licznikami, „Tak widzą Twój profil inni.” + „Zmień nazwę lub obrazek”, `noindex` dla pustych.

| Sev | Luka | Jest | Ma być |
|---|---|---|---|
| major | Lista jako kafle 2 kol. | `RecipeCard` tile | karty-listy (miniatura 84, tytuł 19 bold, „kategoria · czas”, źródło) |
| major | Pusty profil | „Na tym profilu nie ma jeszcze przepisów.” | „{nazwa} nie dodała jeszcze przepisów” (forma wg płci — patrz „Do decyzji”) |
| minor | Nagłówek | H1 30 px, „Dodane przepisy: N” 19 px | 28 px, „Dodała/Dodał N przepisów” 17 px |
| minor | Chipy | `border-border-card-2` | zaznaczony `#111827` (jest), pozostałe `#9ca3af` |
| minor | Własny profil | `border-2` akcentu, `surface-accent` | blok `#f3f4f6` (kolor tła różny) |

**Propozycja:** dopisać do **S14**.

## 9. Wersje przepisu (8) — nowa funkcja

Sprawdzono: `grep` po backlogu (`.ai/specs/backlog-przebudowa.md`, `backlog.md`), specach `.ai/specs/*` i `src/`. **Brak historyjki, brak kolumn `dish` i `variant_note`, brak sekcji „Inne przepisy na {danie}”, brak wykluczania podobnych o tym samym daniu.** (Trafienia „dish” w `src/` to teksty w ekstrakcji/obrazach, nie model wersji.)

Zakres z README: kolumny `dish` (znormalizowana nazwa dania) i `variant_note` z AI przy ekstrakcji (zmiana `run-extract-recipe.ts` + migracja + backfill istniejących przepisów), przycisk-pasek „Mamy jeszcze N inne przepisy na {danie}” pod blokiem źródła, sekcja „Inne przepisy na {danie} (N)” przed „Podobnymi” (karty: opis różnicy jako tytuł, plakietki różnic porcji/czasu, „+ jest / − nie ma” do 4 składników, sortowanie po liczbie dodań do ulubionych), „Podobne” bez przepisów o tym samym `dish`.

**Propozycja:** nowa historyjka **E01-S21 — Wersje tego samego dania** (epik E01 lub osobny), zależna od S07b i S16; medium/high ryzyko (zmiana promptu ekstrakcji, backfill na produkcyjnej bazie — migracja przez Management API wg zasad projektu).

---

## Do decyzji właściciela

1. ~~Płeć w tekstach publicznych~~ — **rozstrzygnięte przez właściciela (2026-10-17):** teksty mają odmieniać się według płci z profilu użytkownika, wybranej przy rejestracji (ekran 3b). Skutek: „Dodane przez” → „Dodała/Dodał {nazwa}” (przepis, profil publiczny, pusty profil), podgląd w ustawieniach też z formą płci. Wymaga nowej historyjki technicznej: widok `public_recipes`/`profiles` musi wystawiać gościom **tylko formę gramatyczną** (np. `author_gender_form`), nie surową płeć ani `profiles_private` — do zaprojektowania w S07b/S14 (zmiana decyzji z S12/S14).
2. **Logowanie e-mail/hasło** obok Facebook/Google — zostaje czy znika z ekranu 3a?
3. **Płatność („Zobacz pełny dostęp”)** — co ma być celem linku w 3c?
4. **Sekcja „Wideo”** na przepisie (decyzja S-04) — zostaje obok „Otwórz oryginał na YouTube”?

## Proponowane historyjki (kolejność)

| Priorytet | Historyjka | Typ | Zakres |
|---|---|---|---|
| 1 | E01-S19 Nagłówek mobilny wg handoffu (+ drobiazgi menu) | nowa | §0, §4 |
| 2 | E01-S07b Strona przepisu: poprawki wg handoffu | nowa | §3 |
| 3 | E01-S20 Strona główna: C1/A1 wizualnie | nowa | §1 |
| 4 | E01-S12b Ekran logowania 3a/3b | nowa | §6 (3a, 3b) |
| 5 | Karta-lista + pasek ulubionych (wspólny element) | dopisek do S05/S06/S16/S14 | §2, §7, §8 |
| 6 | 3c: wygląd bramki | dopisek do S11 | §6 |
| 7 | Ustawienia: kolor zawsze, etykiety | dopisek do S13 | §5 |
| 8 | E01-S21 Wersje przepisu (dish / variant_note) | nowa | §9 |

Uwagi o kolizjach: S19 dotyka `notification-bell.tsx` (S15 w toku) i `/?tab=add` (S10 w toku) — uruchamiać po zmergowaniu S15/S10 albo uzgodnić kontrakt przycisków. Wspólna karta-lista wchodzi w `recipe-card.tsx` używany przez S17 (desktop).
