# Report template

How step 6 of `om-document-flow` reports. Lead with what the page now
answers; keep it to the shape below, omitting an empty optional section.

```markdown
📝 Flow page: `<repo-relative path>.md` (<new | refreshed>)
<One sentence: the flow from trigger to terminal state, N stages, date in the scope line.>

🔍 Read in the code
- <stage count> stages across <file count> files; entry `<file>:<function>`.
- Gates: <names>. Fallbacks: <names>. Terminal: <what>.

⚠️ Inferred, not read  (omit when empty)
- <node or table cell> — <why it was inferred and what would confirm it>.

🔁 Changed since the previous page  (refresh only)
- <added / removed / renamed stages; limits opened or closed>.

🧪 Verified
- Every path and function in the Where column exists: <yes | list of misses fixed>.
- Mermaid parses: <renderer | read-through>.
- SVG: <written at <path> | skipped — <reason>>.
- Index: <line added to <file> | unchanged (--no-index | no index | generated)>.

📋 What the page still cannot tell the reader  (omit when empty)
- <a sub-flow that deserves its own page, a behaviour only reachable in prod, a test that does not exist>.
```

Rules:

- No process narration ("I opened the file…"); the reader wants the page's
  coverage and its gaps.
- An inference reported here must also carry "(inferred)" in the page.
- When the SVG or the index was skipped for a tooling reason, say the reason
  in one phrase so the user can decide whether to install the tool.
