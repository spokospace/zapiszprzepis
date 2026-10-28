import type { StaffPermission } from './permissions'

/**
 * One thing staff can do to a resource. The panel and (Phase 4) the MCP are both
 * generated from this list, so a permission is declared once, next to the
 * operation it protects. `destructive` operations get a confirmation step in the
 * panel and a `confirm` argument on the MCP. The SQL function re-checks the
 * permission either way; this entry only decides what to show.
 */
export interface StaffOperation {
  name: string
  /** Polish, for the button. */
  label: string
  permission: StaffPermission
  destructive: boolean
}

export interface StaffResource {
  name: string
  /** Polish, for the navigation. */
  label: string
  path: string
  /** What it takes to open the resource at all. */
  permission: StaffPermission
  operations: readonly StaffOperation[]
}

export const STAFF_RESOURCES: readonly StaffResource[] = [
  {
    name: 'users',
    label: 'Użytkownicy',
    path: '/admin/uzytkownicy',
    permission: 'users.read',
    operations: [
      { name: 'block', label: 'Zablokuj konto', permission: 'users.block', destructive: true },
      { name: 'unblock', label: 'Odblokuj konto', permission: 'users.block', destructive: false },
      { name: 'delete', label: 'Usuń konto i dane', permission: 'users.delete', destructive: true },
    ],
  },
  {
    name: 'imports',
    label: 'Kolejka importów',
    path: '/admin/importy',
    permission: 'imports.read',
    operations: [{ name: 'retry', label: 'Ponów import', permission: 'imports.retry', destructive: false }],
  },
  {
    name: 'access',
    label: 'Kody dostępu',
    path: '/admin/dostep',
    permission: 'access.manage',
    operations: [
      { name: 'create_code', label: 'Utwórz kod', permission: 'access.manage', destructive: false },
      { name: 'set_full_access', label: 'Zmień pełny dostęp', permission: 'access.manage', destructive: true },
    ],
  },
  {
    name: 'roles',
    label: 'Role',
    path: '/admin/role',
    permission: 'roles.manage',
    operations: [{ name: 'set_role', label: 'Zmień rolę', permission: 'roles.manage', destructive: true }],
  },
  {
    name: 'audit',
    label: 'Dziennik zmian',
    path: '/admin/dziennik',
    permission: 'audit.read',
    operations: [],
  },
]

/** The resources this staff member may open, in navigation order. */
export function visibleResources(permissions: ReadonlySet<StaffPermission>): StaffResource[] {
  return STAFF_RESOURCES.filter((r) => permissions.has(r.permission))
}

/** Whether `permissions` allow `operation` (the panel shows its button only then). */
export function canRun(permissions: ReadonlySet<StaffPermission>, operation: StaffOperation): boolean {
  return permissions.has(operation.permission)
}
