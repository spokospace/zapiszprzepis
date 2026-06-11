# Recipe URL deduplication — krótki plan

> Pełny plan: `context/changes/recipe-url-dedup/plan.md`

## Co i dlaczego

Zapobiec re-ekstrakcji tego samego URL przepisu gdy user udostępnia go ponownie. Oszczędza koszty Firecrawl/OpenAI/Inngest, eliminuje duplikaty w liście. Bonusowo: napraw bug `(user_id, slug)` collision gdy dwa przepisy z różnych źródeł mają ten sam tytuł.

## Punkt wyjścia

Schema `recipes` ma `unique(user_id, slug)` ale brak ograniczenia na `source_url`. Oba Server Actions (Web Share Target i manualny formularz) wstawiają nowy `recipe_shares` i wywołują Inngest bez sprawdzania czy ten URL już był przetwarzany. Slug generuje się z tytułu, więc dwa różne przepisy o tym samym tytule crashują INSERT.

## Pożądany stan końcowy

Share URL completed → redirect na detail z toast „Ten przepis już masz". Share URL pending → redirect na listę z toast „Już przetwarzam…". Share URL failed → normalna nowa próba. Dwa przepisy o tym samym tytule → slugi `tortilla-z-patelni` i `tortilla-z-patelni-2`. DB egzekwuje unikalność URL per user — race protection na poziomie schematu.

## Kluczowe podjęte decyzje

| Decyzja                                          | Wybór                                                  | Dlaczego                                                                | Źródło |
| ------------------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------- | ------ |
| Reakcja na duplikat completed                    | Redirect do `/recipes/<slug>?duplicate=1`              | Zerowy koszt API, user widzi swój przepis; zgodne z archive-first       | Plan   |
| Reakcja na duplikat pending                      | Blokuj z toast „Już przetwarzam"                       | Race protection, oszczędność Firecrawl quota                            | Plan   |
| Reakcja na poprzedni failed                      | Pozwól re-extract (no dedup)                           | Po naprawieniu pipeline można odzyskać failed przez ponowny share        | Plan   |
| URL normalization                                | Minimalna: lowercase host + strip trailing `/` + strip `#` | Wyłapuje 80%+ duplikatów; query params często niosą info o przepisie | Plan   |
| Strategia slug collision                         | Retry z licznikiem `-2`, `-3`, ...                     | Pierwszy URL pięknie się prezentuje; suffix tylko gdy konflikt          | Plan   |
| DB enforcement URL uniqueness                    | Unique partial index `(user_id, source_url)` WHERE NOT NULL | Race protection bez wymuszania source_url=not null                      | Plan   |
| Migracja istniejącego przepisu                   | Backfill `source_url` do normalized form               | Spójność danych od deployu; dedup działa dla obecnego przepisu          | Plan   |
| Code placement dedup logiki                      | Nowy `src/lib/recipe-dedup.ts` shared helper           | DRY — używane przez 2 Server Actions; centralizacja jak w lessons.md     | Plan   |
| Slug collision: w tej zmianie czy osobno?        | W tej zmianie (jedna „recipe identity")                | Spójny temat, jeden PR, mniej overhead na koordynację                   | Plan   |

## Zakres

**W zakresie:**
- Migration: backfill normalized URL + unique partial index na `recipes(user_id, source_url)`
- `src/lib/url-normalize.ts` (pure function) + unit testy
- `src/lib/recipe-dedup.ts` (Supabase query helper)
- Wpięcie w `share/actions.ts` i `add-recipe-action.ts`
- UX: query params `?duplicate=1` / `?duplicate=pending` + toast/banner
- Slug retry w Inngest function `extract-recipe`

**Poza zakresem:**
- Bulk re-extract istniejących failed shares
- Cross-user dedup
- Aggressive normalization (`?utm_*`, `?fbclid`, `www.` strip)
- URL shorteners unfolding
- Telemetria dedup hit rate
- Migration istniejących duplikatów (brak ich obecnie)

## Architektura / Podejście

Trzy warstwy obrony:
1. **DB**: unique constraint `recipes(user_id, source_url)` blokuje finalny INSERT przy race.
2. **Application**: pre-check w Server Action zatrzymuje request przed Inngest (oszczędza API koszty + natychmiastowy redirect).
3. **Slug retry**: Inngest function retry z licznikiem przy `(user_id, slug)` collision.

URL normalization minimalna: `new URL()` → lowercase hostname, strip trailing `/`, strip fragment. `source_url` i `shared_url` przechowywane w znormalizowanej formie.

## Fazy w skrócie

| Faza                                          | Co dostarcza                                                      | Kluczowe ryzyko                                                       |
| --------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1. Schema + URL normalizer                    | Migration z backfill + unique index; `url-normalize.ts` + testy   | SQL i TS normalizer muszą zwracać identyczny wynik — synchronizacja   |
| 2. Dedup helper + Server Actions              | `recipe-dedup.ts`; wpięcie w 2 Server Actions; UX banner          | `triggerRecipeExtraction` zwraca nowy wariant — caller musi obsłużyć  |
| 3. Slug collision retry w Inngest             | Loop retry z licznikiem przy unique violation                     | Identyfikacja konkretnej nazwy constraintu w `error.details`          |

**Wymagania wstępne:** Brak — masterowa baza i działający Inngest pipeline (PR #54 zmergowany).
**Szacowany nakład pracy:** ~1 sesja na fazę, 3 PR-y (każdy mergowany niezależnie). Faza 1 wymaga lokalnego dostępu do Supabase CLI do testu migracji.

## Otwarte ryzyka i założenia

- Brak istniejących duplikatów do scalenia w danych produkcyjnych (założenie zweryfikowane: 1 przepis testowy).
- `recipe_shares.shared_url` przy nowych insertach musi być przechowywany znormalizowany — implementator musi pamiętać żeby normalizować w obu Server Actions (nie tylko w `recipes.source_url`).
- Maks 10 prób retry dla slug to arbitralne — jeśli user ma 10+ przepisów o tym samym tytule, throw. Akceptowalne.

## Kryteria sukcesu (podsumowanie)

- Powtórny share completed URL → redirect na detail page z komunikatem (zero kosztu API)
- Powtórny share pending URL → blokada z komunikatem (race protection)
- Dwa przepisy o tym samym tytule z różnych źródeł — oba zapisane, drugi ma slug z suffix
