# Recipe detail page — prep time — krótki plan

> Pełny plan: `context/changes/recipe-detail-improvements/plan.md`

## Co i dlaczego

Detail page przepisu nie pokazuje czasów (przygotowanie / gotowanie / łącznie). Mama widzi tylko składniki i kroki — nie wie ile to zajmie. Dodajemy 3 osobne pola czasu zgodne ze schema.org Recipe vocabulary, ekstrakcję AI z nową treścią promptu, render z czytelnym po polsku formatem („1 godz 30 min").

## Punkt wyjścia

Schema `recipes` nie ma żadnych pól czasu. OpenAI prompt nie pyta o czas. Detail page renderuje title / image / ingredients / steps i kończy się tam. Inngest function ma już insert-with-slug-retry + URL-collision branch (z recipe-url-dedup Phase 3) — URL collision branch obecnie tylko linkuje share do existing recipe, nie aktualizuje.

## Pożądany stan końcowy

Każdy nowy przepis ma `prep_time_minutes`, `cook_time_minutes`, `total_time_minutes` (każde nullable). Detail page pokazuje sekcję czasów (ikony + format „1 godz 30 min") nad/przy Składnikach; renderuje tylko te pola które nie są null; cała sekcja ukryta gdy wszystkie 3 null. Skrypt jednorazowo wypełnia czasy istniejących przepisów (1 wiersz dzisiaj).

## Kluczowe podjęte decyzje

| Decyzja                                | Wybór                                          | Dlaczego                                                                                |
| -------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Scope tej zmiany                       | Wąsko: tylko prep/cook/total time              | „Dodatkowe media" nakłada się z S-04 youtube-recipe-source — osobny issue              |
| Ile pól czasu                          | 3 osobne (prep + cook + total)                 | Schema.org standard; total != prep+cook (passive time np. marynowanie)                  |
| Format storage                         | `int minutes` nullable                         | Sortowalne, sumowalne, prosty formatter; rezygnujemy z zachowania oryginalnej formuły   |
| Format render                          | „1 godz 30 min" z ikonami badge'y              | Naturalne po polsku, pasuje do stylu blogów kulinarnych                                 |
| Co gdy AI zwróci null                  | Pokaż tylko wypełnione pola; wszystkie null → ukryj sekcję | Czysty UI gdy brak danych, najwięcej info gdy częściowe                     |
| Backfill istniejących przepisów        | Bulk re-extract via Inngest                    | Skala 1 wiersz dzisiaj, ale wzorzec gotowy na większą bazę                              |
| Update strategia                       | Gap-fill (update tylko null pola)              | Nie nadpisuj danych jeśli już są; bezpieczne re-run skryptu                              |

## Zakres

**W zakresie:**
- Migration: 3 nullable int kolumny
- OpenAI prompt update + RecipeData interface
- `src/lib/format-minutes.ts` pure helper
- Sekcja czasów na detail page z ikonami z lucide-react
- Inngest URL-collision branch: gap-fill update istniejącego przepisu
- Jednorazowy skrypt `scripts/refresh-recipe-times.ts`

**Poza zakresem:**
- Gallery / multi-image extraction (osobna zmiana)
- YouTube embed (część S-04 youtube-recipe-source)
- `performTime` ze schema.org
- Servings / yield
- Manual edycja w UI (przeciwne „zero data entry" z PRD)
- JSON-LD SEO markup

## Architektura / Podejście

Trzy fazy następujące po sobie:
1. **Schema + extraction:** DB columns + AI prompt → nowe przepisy mają czasy
2. **Render:** formatter + detail page section → czasy widoczne
3. **Bulk refresh:** Inngest gap-fill + skrypt → stare przepisy podciągnięte

Każda faza shippable niezależnie. Phase 2 może lecieć bez Phase 1 (renderuje pusto). Phase 3 wymaga Phase 1 (potrzebuje pól w DB).

## Fazy w skrócie

| Faza                            | Co dostarcza                                                       | Kluczowe ryzyko                                              |
| ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1. Schema + extraction          | Migration + zmieniony prompt OpenAI + `RecipeData` interface       | AI może halucynować wartości jeśli przepis ich nie podaje    |
| 2. Render                       | `format-minutes.ts` + sekcja na detail page                        | Brak — small UI add                                          |
| 3. Bulk refresh                 | Inngest gap-fill + skrypt CLI dla istniejących przepisów           | Inngest update-gaps musi nie nadpisywać już wypełnionych pól |

**Wymagania wstępne:** Brak. Master ma już wszystkie fix-y (recipe-url-dedup, images, categories).
**Szacowany nakład pracy:** ~1 sesja na fazę, 3 PR-y.

## Otwarte ryzyka i założenia

- AI może zwracać czasy w innych jednostkach niż minuty (np. „pół godziny" → musi konwertować). Założenie: prompt explicit wymaga int minutes; w razie kłopotów dodaj dodatkową zasadę w prompcie.
- Aktualny prompt nie ma viewing perspective konwertora jednostek — założenie że gpt-4o-mini sobie radzi z konwersją „30 minut" / „pół godziny" → 30.
- Brak vitest setup → testy `format-minutes.ts` pominięte (tak jak w recipe-url-dedup Phase 1).

## Kryteria sukcesu (podsumowanie)

- Nowy share przepisu z bloga zawierającego czasy → wszystkie 3 pola w bazie wypełnione (lub null jeśli AI nie znalazł)
- Detail page nowego przepisu pokazuje sekcję czasów w polskim formacie
- Po skrypcie refresh, Tortilla z patelni ma czasy i pokazuje je na detail page
