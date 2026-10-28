# Mermaid conventions

The diagram vocabulary step 3 of `om-document-flow` draws with, so every flow
page in a repository reads the same way. GitHub, GitLab and most docs
renderers draw a ```` ```mermaid ```` block natively; keep to the syntax they
all support.

## Shape

- `flowchart TD` by default (top-down reads like the order of execution).
  `flowchart LR` only for a short linear flow (≤ 6 nodes, no branches).
- One node per stage from `references/tracing.md`; no node for a helper.
- Order top to bottom in execution order; a fallback sits beside the stage it
  replaces, not below it.

## Node vocabulary

| Meaning | Syntax | Example |
|---|---|---|
| Entry / trigger | `id([text])` stadium | `link([Link do przepisu])` |
| Stage | `id[text]` rectangle | `fetch[Pobranie strony<br/>markdown + HTML]` |
| Gate / decision | `id{text}` diamond | `gateIn{Bramka wejściowa<br/>looksUnextractable}` |
| Retry / dead end | `id[/text/]` parallelogram | `retry[/błąd → ponowienie/]` |
| Store | `id[(text)]` cylinder | `db[(recipes)]` |
| External service | a `subgraph` named after the service, or a node with the service name on the first line | `subgraph scrape [Scrape]` |
| Link-out to another flow | `id[[text]]` subroutine | `images[[Archiwum zdjęć — osobna strona]]` |

## Edges

- `-->` for the main path; `-- label -->` for a condition or an error code
  (`-- 402 / 429 -->`, `-- pl -->`, `-- brak tytułu -->`).
- `-.->` for an optional or best-effort path.
- A gate has at least two outgoing edges, each labelled with what makes it
  go that way.
- No edge labels longer than one short phrase; the condition's detail lives
  in the stage table.

## Labels

- Written in the page's language (`references/target-folder.md`); code
  identifiers stay as in the code.
- First line: the stage's name as a reader says it. Second and third lines
  (`<br/>`): the function or file a reader would grep for, or the three or
  four things the stage handles. Never a fourth line.
- Put `(inferred)` on a node whose behaviour was not read in the code.
- No emoji, no colour as the only carrier of meaning (`style`/`classDef`
  are allowed for emphasis but the diagram must read in black and white).

## Size

- 6–12 nodes; wider than 4 nodes per row or deeper than 12 → split into an
  overview and sub-flow pages (`references/tracing.md`, Granularity).
- One diagram per page. A second diagram means a second page.

## Validity

- Quote any label that contains `(`, `)`, `[`, `]`, `{`, `}`, `|` or `"`:
  `id["text (with parens)"]`.
- Node ids are ASCII identifiers (`gateIn`, `llm`), never the label text.
- Confirm it parses: the renderer in `references/svg-and-index.md` when
  available, otherwise a syntax read-through of every line.
