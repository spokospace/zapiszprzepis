# Future feature — wyszukiwarka przepisów w sieci (discovery)

**Status:** poza zakresem MVP. Notatka kierunkowa, nie plan wdrożeniowy.
**Data:** 2026-07-04

## Cel

User wpisuje hasło (np. „tortilla") i dostaje **listę przepisów z internetu** — prosta
lista z preview (tytuł, zdjęcie, źródło). Przy każdym preview przycisk **Zapisz**.

To jest **odkrywanie nowych** przepisów, a nie przeszukiwanie własnej kolekcji.
Przeszukiwanie zapisanych przepisów już istnieje (`RecipeSearch`, `?q=`, po własnej bazie).

## Kluczowe rozstrzygnięcie: „Zapisz" = istniejący pipeline

Przycisk **Zapisz** przy preview **nie robi nic nowego** — wywołuje istniejący
`addRecipeFromUrl(url)`:

```
Zapisz (URL z wyniku)
  → addRecipeFromUrl        (dedup: findExistingRecipeForUrl)
  → recipe_shares (Supabase)
  → event recipe/extract    (Inngest)
  → ekstrakcja: redakcja składników osobno, tekstu, kroków, zdjęcia
```

Czyli redagowanie składników / tekstu / kroków dzieje się dokładnie tak jak przy
dzisiejszym zapisie z URL. Nowa funkcja dokłada tylko **źródło URL-i** przed ten pipeline.

## Ścieżka bliska (rekomendowana) — Exa REST API

- Źródło wyników: **Exa REST API** (`POST https://api.exa.ai/search`, nagłówek `x-api-key`).
  NIE Exa MCP — MCP to narzędzie deweloperskie Claude Code, nie działa w aplikacji.
- Wołane z **server action** (klucz `EXA_API_KEY` po stronie serwera, nigdy w kliencie).
  Wzorzec jak istniejące wywołania Firecrawl/OpenAI w `inngest/functions.ts`.
- Cloudflare Workers: zwykły `fetch`, bez API Node — działa bez zmian.
- Limit darmowy Exa: 1000 req/mies. → wystarcza dla 1 usera.

### Trzy pułapki
1. **Nie debounce'ować** wyszukiwania webowego (jak `RecipeSearch` co 300 ms) —
   każdy znak = 1 request = spalony limit. Szukanie na **submit/Enter**.
2. **Dedup w wynikach** — oznaczyć `findExistingRecipeForUrl` te, które już są w bazie.
3. **`type: 'auto'`, bez `contents`** — treść wyciąga i tak własny pipeline po zapisie.
4. **Filtrowanie jakości** — Exa nie ma kategorii „recipe"; zawęzić `includeDomains`
   do serwisów, które ekstraktor już parsuje (blogi, YouTube), inaczej wpadną sklepy/fora.

## Ścieżka daleka (opcjonalna) — własny crawler-silnik

Gdyby to miał być prawdziwy silnik wyszukiwania nad korpusem (odpowiednik
`plan_wyszukiwarki_przepisy.md` z Downloads): zrealizować **cel** tamtego planu,
ale **odrzucić jego stack**. Tamten zakłada Python/FastAPI/Redis/Dramatiq/Meilisearch/
Docker Compose — obcy temu projektowi i niehostowalny na Cloudflare Workers.

Mapowanie na obecny stack (Inngest + Supabase + Next.js/Cloudflare):

| Plan z Downloads | U nas |
| --- | --- |
| Redis + Dramatiq | **Inngest** (fanout + `{ cron }` functions) |
| httpx + selectolax | `fetch` + parser JSON-LD w TS |
| PostgreSQL | **Supabase Postgres** |
| Meilisearch | **Postgres FTS / pg_trgm**; Meilisearch dopiero gdy korpus tego wymaga |
| FastAPI `/search` | Next.js route handler |

- Korpus = **osobna tabela** (np. `recipe_index`, url-keyed, bez `user_id`).
  Istniejąca `recipes` (per-user, RLS) zostaje kolekcją prywatną.
- Długie crawle muszą lecieć w krokach Inngest, nie w request-handlerze Workers.
- **Ryzyko prawne** (do świadomej decyzji): przechowywanie i serwowanie pełnej treści
  cudzych przepisów (opis/kroki/zdjęcia) to nie to samo co enumeracja URL-i z sitemap.
  Podejście Exa (import tylko wybranych, pojedynczo) jest tu bezpieczniejsze.

## Rekomendacja

Zacząć od ścieżki Exa gdy funkcja wejdzie do zakresu. Crawler-silnik tylko jeśli
zapiszprzepis ma stać się realnym produktem wyszukiwania, i wtedy na własnym stacku.
