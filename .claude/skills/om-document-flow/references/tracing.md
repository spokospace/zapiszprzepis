# Tracing the flow in code

The questions step 2 of `om-document-flow` answers per stage, the sources it
trusts, and the stop rule. The table in the page and the nodes in the diagram
come only from what this step recorded.

## Find the entry point

- A path or function name: open it.
- An HTTP route or event name: grep the router, the job registry, the queue
  consumer, the CLI command table.
- A phrase ("saving a recipe from a link"): grep the repository's agent
  docs, specs and tests for the phrase and its nouns, then the code for the
  handlers those name. Two candidates → ask which; none → stop and say what
  was searched.

## Per stage, record

| Field | Where it comes from |
|---|---|
| What it does | the code of the stage, in one sentence a reader can act on |
| Where | file path and function/class name, as a reader would grep it |
| Reads / calls outside | services, APIs, models, queues, storage, env vars (name only) |
| Branches | the condition and what each branch leads to |
| Fails how | thrown error, returned null, retry, fallback, silent skip — and who sees it |
| Guarded by | gates, validations, feature flags, dedup checks |
| Tested by | the test file that pins the behaviour, when one exists |

## Sources, in order of trust

1. The code itself (control flow, conditions, error handling).
2. Tests — they say what the code is held to; a behaviour only a test
   mentions is still real.
3. Comments and docs — useful for *why*; when they contradict the code, the
   code wins and the contradiction goes under known limits.
4. Config and env examples — for which services and thresholds exist; never
   copy values that look like secrets.

## Granularity

- A stage is something a reader would point at when asking "where does X
  happen": a scrape, a gate, a model call, a write. A helper called from one
  stage is part of that stage, named in its "where" cell, not a node.
- Aim for 6–12 nodes. More than 12: split the flow into an overview page and
  one page per sub-flow, each its own run of this skill, and link them.
- Fewer than 4: the flow is probably a function, not a page; say so and
  offer to document the larger flow it belongs to.

## Stop rule

Stop at the terminal state the user cares about (a row written, a response
sent, a job completed) and at the first stage that belongs to another flow
(mark it as a link-out node). Do not trace into third-party libraries; name
them as external services.

## Record inferences separately

A fact read in the code is a fact. A behaviour inferred (from naming, from a
similar stage, from a comment) is an inference: mark it in the page's table
with "(inferred)" and list it in the report. Never promote an inference to a
fact by rewording it.
