# Discovery via Exa — Krótki plan

> Pełny plan: `context/changes/discovery-via-exa/plan.md`
> Badania: `context/changes/discovery-via-exa/research.md`

## Co i dlaczego

Dodajemy możliwość wyszukiwania przepisów w sieci przez Exa Search API. User wpisuje
"tiramisu" zamiast wklejać URL — Exa zwraca 5 wyników, user klika Zapisz.
Cel: usunąć barierę "skąd wziąć link" bez budowania własnego crawlera.

## Punkt wyjścia

`AddRecipeForm` przyjmuje URL i wywołuje `addRecipeFromUrl` → Inngest pipeline.
Exa to nowe źródło URL-i — pipeline, Supabase schema i Inngest zostają bez zmian.
Architektura opisana w `context/foundation/future-recipe-web-search.md`.

## Pożądany stan końcowy

User wpisuje nazwę przepisu w dotychczasowe pole → dostaje listę 5 propozycji z sieci →
klika Zapisz przy wybranym → przepis ląduje w kolekcji tak samo jak przy URL.
Wklejony URL nadal działa identycznie jak przed zmianą.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
|---|---|---|---|
| Punkt integracji Exa | Przed `addRecipeFromUrl`, nie w pipeline | Pipeline (Inngest) nie zmienia się — Exa to tylko nowy sposób uzyskania URL | Badania |
| UI | Jeden unified input (URL vs tekst auto-detect) | Brak drugiego inputu/zakładki — ten sam input, detekcja na submit | Plan |
| includeDomains | Brak filtrowania | Decyzja użytkownika: czysty Exa search | Plan |
| Liczba wyników | 5 | Krótka lista, darmowy limit 1000 req/mies. | Plan |
| Fallback na błąd | Komunikat + "wklej ręcznie" | User zawsze może zapisać przepis nawet gdy Exa nie działa | Plan |
| Exa API | REST API (nie MCP) | MCP to narzędzie dev — aplikacja woła `api.exa.ai` bezpośrednio | Badania |
| EXA_API_KEY | Przez `src/lib/env.ts` | lessons.md: required env vars centralnie, throw przy braku | Badania / lessons |

## Zakres

**W zakresie:**
- `EXA_API_KEY` w `src/lib/env.ts` (required, throw przy braku)
- `search-via-exa-action.ts` — server action: Exa REST API, 5 wyników, flaga `alreadySaved`
- Modyfikacja `AddRecipeForm` — unified input, detekcja URL vs tekst, panel wyników
- Wyniki ze znacznikiem "Już zapisany" gdy URL już w kolekcji usera
- Komunikat błędu gdy Exa niedostępny

**Poza zakresem:**
- Zmiany w `inngest/functions.ts`, `add-recipe-action.ts`, Supabase schema
- `includeDomains` / filtrowanie domen
- Tytuł z Exa jako hint do LLM (pipeline i tak go ekstrahuje z treści)
- Paginacja / "załaduj więcej"
- Debounce / live search (tylko na submit)

## Architektura / Podejście

```
User wpisuje tekst → handleSubmit wykrywa: NIE http → searchViaExa(query)
  → POST https://api.exa.ai/search { query, numResults: 5, type: 'auto' }
  → [ { url, title, alreadySaved } × 5 ]
  → ExaResultsPanel: każdy wynik ma mini-form → addRecipeFromUrl (hidden url input)

User wkleja URL → handleSubmit wykrywa: startsWith('http') → addRecipeFromUrl (stary flow)
```

Exa REST API jest wołane z server action (`'use server'`) — klucz nigdy nie trafia do klienta.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Infrastruktura Exa | `EXA_API_KEY` w env + server action z wynikami + dedup flag | Exa API może mieć inne pola niż docs opisują — sprawdzić kształt odpowiedzi |
| 2. UI — unified input + panel wyników | Działający end-to-end flow: szukaj → zapisz | UX detekcji URL vs tekstu może być mylący — placeholder musi być jasny |

**Wymagania wstępne:** Konto na exa.ai, klucz API → `.env.local` + Cloudflare secrets.
**Szacowany nakład pracy:** ~1-2 sesje implementacji w 2 fazach.

## Otwarte ryzyka i założenia

- Kształt odpowiedzi Exa REST API: implementator sprawdza przed kodowaniem (`results[].url`, `results[].title` — standard, ale zweryfikować).
- Bez `includeDomains` wyniki mogą zawierać przepisy z serwisów, których ekstraktor nie parsuje dobrze — akceptowalne ryzyko na MVP.
- Limit 1000 req/mies. wystarczy dla 1 usera, ale warto logować użycie.

## Kryteria sukcesu (podsumowanie)

- Tekst w inputu → Exa search → 5 wyników → Zapisz → przepis w kolekcji
- URL w inputu → identyczne zachowanie jak przed zmianą (brak regresji)
- Exa error → user widzi komunikat i może wkleić URL ręcznie
