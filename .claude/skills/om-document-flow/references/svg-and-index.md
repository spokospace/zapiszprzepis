# SVG render, index entry and refresh

What step 5 of `om-document-flow` does beside writing the page: the optional
SVG, the one-line index entry, and the rule for refreshing an existing page.

## SVG beside the page

Render only when `--svg` was given or the folder already keeps an `.svg`
next to a diagram page. Use the Mermaid CLI through the project's package
runner without adding a dependency to the project:

```bash
# extract the first mermaid block, render it next to the page
awk '/^```mermaid/{f=1;next} /^```/{if(f){exit}} f' "<page>.md" > "<page>.mmd"
npx --yes @mermaid-js/mermaid-cli -i "<page>.mmd" -o "<page>.svg" --backgroundColor transparent
rm "<page>.mmd"
```

- The renderer needs a headless browser; when `npx` is unavailable, the
  download is refused, or the render fails, **skip the SVG, keep the page,
  and say so in the report** — the Markdown with its Mermaid block is the
  deliverable, the SVG is a convenience.
- Never commit a temporary `.mmd`; never leave a half-written `.svg`.
- The SVG is referenced from nowhere by default; add
  `![<flow name>](<page>.svg)` under the Mermaid block only when the folder's
  other pages do the same (some renderers do not draw Mermaid, a wiki export
  for instance).

## Index entry

When the target folder has a `README.md` or `index.md` that lists its pages
(a bullet list or a table of links), add one line in the list's own shape,
alphabetically or at the end as the list is kept:

```markdown
- [<Flow name>](<page>.md) — <what the page answers, one phrase>
```

- `--no-index` skips this.
- An index that is generated (a comment says so, or a script in the repo
  writes it) is not edited by hand: run the generator when it is a documented
  project script, otherwise leave it and note it in the report.
- No index → do not create one.

## Refreshing an existing page

When the page already exists (same path, or a page whose scope line names the
same entry point):

1. Read it first; keep its heading ids and section order.
2. Re-trace the flow (step 2) rather than patching the old table — a stage
   that disappeared must disappear from the page.
3. Rewrite the diagram, the table and the known limits from the new trace;
   move the date and the last-shaping-change note in the scope line.
4. Keep "Related pages" links that still resolve; drop the rest.
5. Re-render the SVG when one exists beside the page.
6. In the report, list what changed since the previous version (stages
   added, removed, renamed; limits closed or opened).

Follow the folder's own convention when it is not edit-in-place
(`references/target-folder.md`).
