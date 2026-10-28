# Admin panel: roles, users, recipe moderation and MCP

- Date: 2026-10-28
- Category: feature
- Priority signal: medium: the owner manages data by hand with no tool; there is no urgent incident
- Risk signal: high: new roles, account deletion (GDPR), edits to public recipes, RLS changes
- Routing: Next: om-spec-writing "ZapiszPrzepis admin panel — brief: .ai/specs/briefs/2026-10-28-admin-panel.md"

> Written in Polish during the brainstorm and translated here to follow the repository's English-only rule for `.md` files. Where this brief and the spec `.ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md` differ, the spec wins; the one material difference is noted under "Agreed direction".

## Problem

The service has no tool for managing content or accounts. Every recipe fix (title, cover, SEO description, category, duplicate merge), every account block and every deletion on request means manual work in the database or in Supabase Studio. Imports sometimes fail silently and the reason is visible only in Inngest logs. The public recipe base keeps growing (824 sitemap URLs), and without moderation its quality and duplicates will get worse.

## Agreed direction

An admin panel inside this repository for the owner and several people with roles.

- **Roles:** at least `admin` and `moderator`; more can come later, so the role set must be open (a new role must not need a schema rebuild). Permissions are enforced on the server and in the database, not only in the UI. Each person has their own account and role; no shared account.
  - *Superseded by the spec:* the brainstorm proposed a role column in `profiles`. The spec rejects it, because `profiles` is readable by `anon` and updatable by its owner, which would let anyone grant themselves a role. Roles live in a private table.
- **Recipes:** list and search across all recipes including hidden ones, source preview and the author who added it, hide and delete, merge duplicates (the `recipe_merge` infrastructure exists), fix category and tags, edit title, SEO description, cover framing and content.
- **Users:** list and search (accounts, registration date, sign-in method, number of recipes and favorites), block an account without deleting data, delete an account with its data on request (GDPR).
- **Import queue:** failed imports with the reason and a retry.
- **MCP:** the same operations exposed as an MCP server so that Claude Code can manage the data instead of Supabase Studio. The tools use the same server layer and the same role rules. Authentication by a token bound to a specific account and role. Destructive operations need an explicit confirmation argument, as in the `polo-catalog` and `garazyn-nazwy` servers. Every MCP call is written to an audit log.
- **One universal system inside this repository:** one mechanism serves all resources (recipes, users, categories, imports). Resources, fields, role rules and destructive operations are described by configuration in the repo. The same mechanism feeds the panel and the MCP, so a new resource needs neither new authorization code nor a new MCP tool.

Rejected: "build nothing" (Supabase Studio does not provide roles or an audit trail, and the owner wants the panel in the app). Also rejected: a single-person version without roles, because the owner deliberately chose several people with roles, and shared accounts, because separate accounts give attribution and revocation.

Suggested phases (confirmed in the spec):
1. Roles, users and the import queue.
2. Recipe moderation: list, hide, delete, merge, categories and tags.
3. Editing content, SEO and cover framing.
4. MCP.

## Resolved unknowns

| Question | Answer (from the conversation) |
|----------|--------------------------------|
| Who enters the panel? | The owner plus several people with roles, not one account. |
| Which actions on recipes? | List and search, source preview, hide and delete, merge duplicates, fix categories and tags, edit title, SEO description, cover framing and content. |
| Which actions on users? | List and search, block an account, delete an account with data, view the import queue and errors. |
| Should the panel be reachable through MCP? | Yes. Claude Code manages data through MCP instead of Supabase Studio, with the same operations and the same role rules. |
| Do the PRD and roadmap allow roles and manual editing? | No: `context/foundation/prd.md` says "no roles" and `roadmap.md` excludes manual editing after extraction. The owner chose both. The spec amends them in its Phase 1 PR. |

## Non-goals

- Family sharing (ZapiszPrzepis Family): out of scope per the PRD.
- A native app or Capacitor: out of scope.
- Changes to the public recipe URLs `/przepis/{slug}`, other than 301 redirects on merge.
- The panel does not replace the extraction pipeline and does not rewrite recipes automatically.
- MCP does not use the Supabase service role and does not bypass role rules; it has the same entry point as the panel.
- The system is not extracted into a separate package and is not shared with other services.

## Affected areas (if known)

- Role and permission tables with RLS policies; the public views `public_recipes` and the allowlist guard.
- The service-role write path behind the `recipe_write_lockdown` migration: admin writes must go through database functions, not a user session.
- The duplicate-merge mechanism (`recipe_merge_infra`) and the 301 redirects (`merged-redirect.ts`).
- The Inngest import queue (`src/inngest/`).
- Cover images in the R2 archive (`recipe_image_archive`).
- A new MCP endpoint sharing the server layer with the panel, account tokens and an audit log.
