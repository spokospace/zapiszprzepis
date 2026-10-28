/**
 * Admin panel permissions (spec: .ai/specs/2026-10-28-admin-panel-roles-moderation-mcp.md).
 *
 * The database decides who holds what (`staff_role_permissions`); this list only
 * names the permissions the app knows how to use, so a typo in a page guard is a
 * type error instead of a screen nobody can open. The strings are a contract:
 * they are the same ones stored in the `staff_role_permissions` table.
 */
export const STAFF_PERMISSIONS = [
  'users.read',
  'users.read_email',
  'users.block',
  'users.delete',
  'imports.read',
  'imports.retry',
  'access.manage',
  'roles.manage',
  'audit.read',
  'recipes.read',
  'recipes.hide',
  'recipes.delete',
  'recipes.merge',
  'recipes.taxonomy',
  'recipes.edit',
  'tokens.own',
] as const

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number]

const KNOWN = new Set<string>(STAFF_PERMISSIONS)

/** Keeps only the permissions this build knows; an unknown string from the database is ignored, not trusted. */
export function parsePermissions(raw: unknown): ReadonlySet<StaffPermission> {
  if (!Array.isArray(raw)) return new Set()
  return new Set(raw.filter((p): p is StaffPermission => typeof p === 'string' && KNOWN.has(p)))
}
