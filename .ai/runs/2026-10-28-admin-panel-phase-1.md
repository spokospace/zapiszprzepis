# Admin panel, Phase 1: foundation, users, imports, access codes

Source doc: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md
Brief: .ai/specs/briefs/2026-10-28-admin-panel.md

## Goal
A working `/admin` for admins and moderators: roles and permissions in the database, an audit log, users, the import queue, access codes and a roles screen. No recipe changes (Phase 2+), no MCP (Phase 4).

## Scope
Phase 1 steps 1-10 of the spec. Migrations are written but never applied to any database: local dev points at production, so applying needs the owner's explicit go.

## Non-goals
Recipe moderation, content editing, MCP, tokens. No new runtime dependency.

## Risks
- Migrations are `risk-high`; they ship as files only.
- Worker bundle 3 MiB limit: baseline recorded in step 1, re-measured at the end.
- No staff e2e account can exist (dev = production); permission logic is covered by Vitest and SQL assertions.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Foundation and screens

- [x] 1.1 Measure the Worker bundle
- [x] 1.2 Migration: roles and permissions
- [x] 1.3 Migration: audit log
- [x] 1.4 App: staff context and the /admin shell
- [x] 1.5 Users resource
- [x] 1.6 Import queue
- [x] 1.7 Access codes and entitlements
- [x] 1.8 Roles screen
- [x] 1.9 Audit screen
- [x] 1.10 PRD and docs
