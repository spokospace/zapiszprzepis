# Target folder, language and conventions

How step 1 of `om-document-flow` decides where the page goes, in which
language it is written, and which update convention it follows.

## Folder, in order of precedence

1. `--out <path>` — used as given; its parent folder sets the conventions.
2. A folder that already holds flow pages: look for Markdown files with a
   ```` ```mermaid ```` block under `context/foundation/`, `docs/`,
   `doc/`, `.ai/specs/`, `.ai/analysis/` and the `paths` entries of
   `.ai/agentic.config.json`. The folder with the most such pages wins.
3. `context/foundation/` when it exists.
4. `docs/` when it exists.
5. Otherwise ask the user — one question, with the candidates found — and do
   not create a new top-level folder on your own.

The page name is a kebab-case slug of the flow (`extraction-pipeline.md`,
`checkout-flow.md`), never dated, unless the folder's README asks for dated
files.

## Update convention

Read the folder's `README.md` (or `index.md`) before writing:

- **Edit-in-place** (the usual foundation-docs rule): a later run rewrites the
  existing page, keeping its heading ids; the date in the scope line moves.
- **Dated copies / archive**: follow the README literally (e.g. move the old
  page to `archive/YYYY-MM-DD-<name>.md` and write the new one at the
  original path).
- **No README**: edit in place.

## Language

`--lang` wins. Otherwise: the language the folder's existing pages are written
in (count the first paragraph of three of them); English when the folder is
empty or mixed. Code identifiers, file paths and function names stay as they
are in the code regardless of language. In a repository whose `CLAUDE.md`
fixes the comment or docs language, that rule wins over the folder count.

## What to read before tracing

- The folder's existing flow pages: reuse their node vocabulary and heading
  shape so the set reads as one (see `references/mermaid-conventions.md`).
- The repository's agent instruction files for naming rules and for any
  statement about the flow that contradicts the code — that contradiction is
  a known limit to record, not an instruction to follow.
