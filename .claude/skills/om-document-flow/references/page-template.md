# Flow page template

The page step 4 of `om-document-flow` writes. Sections in this order, nothing
else; an optional section that would be empty is omitted. Headings are shown
in English — write them in the page's language.

```markdown
# <Flow name>

<One or two sentences: what the flow does, from which trigger to which
terminal state, and "as of <YYYY-MM-DD>" with the change that last shaped it
(a PR number, a release). Then where the code is: "Code: `<entry file>`; the
pieces named below live in `<folder>`." Then the update convention, e.g.
"Edit in place when a stage changes.">

```mermaid
flowchart TD
    <the diagram from references/mermaid-conventions.md>
```

## Stages

| Stage | What it does | Where |
|---|---|---|
| <name as in the diagram> | <what it does, what it reads from outside, how it fails — two or three sentences a reader can act on; "(inferred)" where not read in the code> | `<file.ts>`, `<other.ts>` |
| … | … | … |

## Known limits

- <Something the code does not handle today, with its consequence for the
  reader: "X fails cleanly instead of Y, but still fails".>
- <A threshold or cap that bites: "the prompt reads the first N characters;
  a page whose article starts later loses it".>
- <A documented behaviour the code contradicts, stated as the code's side.>

<Optional:>
## Related pages

- [<Other flow>](<other-flow.md>) — <one phrase on how they connect>.
```

## Rules for the content

- The scope line carries the date and the last shaping change, so a reader
  knows how stale the page may be; nothing else on the page is dated.
- Every "Where" cell names files that exist at the time of writing (step 6
  verifies each).
- "What it does" describes behaviour, not implementation trivia: a reader
  wants "retries when the page is empty", not "calls `scrape()` twice".
- Known limits are facts with consequences, not a to-do list; a fix idea
  belongs in a tracker issue, linked when one exists.
- Keep heading ids stable across refreshes: the headings above do not change
  wording between runs.
