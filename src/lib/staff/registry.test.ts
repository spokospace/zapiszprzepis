import { describe, it, expect } from 'vitest'
import { parsePermissions, STAFF_PERMISSIONS } from './permissions'
import { STAFF_RESOURCES, visibleResources, canRun } from './registry'

describe('staff registry', () => {
  it('only references permissions the app knows', () => {
    const known = new Set<string>(STAFF_PERMISSIONS)
    for (const r of STAFF_RESOURCES) {
      expect(known.has(r.permission), r.name).toBe(true)
      for (const op of r.operations) expect(known.has(op.permission), `${r.name}.${op.name}`).toBe(true)
    }
  })

  it('gives each resource a unique name and an /admin path', () => {
    expect(new Set(STAFF_RESOURCES.map((r) => r.name)).size).toBe(STAFF_RESOURCES.length)
    for (const r of STAFF_RESOURCES) expect(r.path.startsWith('/admin/')).toBe(true)
  })

  it('permission matrix: a moderator sees users and imports, never roles, access codes or the audit log', () => {
    const moderator = parsePermissions(['users.read', 'imports.read', 'imports.retry', 'recipes.read'])
    expect(visibleResources(moderator).map((r) => r.name)).toEqual(['users', 'imports'])
  })

  it('permission matrix: an admin sees every Phase 1 resource', () => {
    const admin = parsePermissions(STAFF_PERMISSIONS)
    expect(visibleResources(admin).map((r) => r.name)).toEqual(['users', 'imports', 'access', 'roles', 'audit'])
  })

  it('shows no resource to someone with no permissions', () => {
    expect(visibleResources(new Set())).toEqual([])
  })

  it('a moderator cannot run the user operations (read-only on users)', () => {
    const moderator = parsePermissions(['users.read', 'imports.read', 'imports.retry'])
    const users = STAFF_RESOURCES.find((r) => r.name === 'users')!
    expect(users.operations.some((op) => canRun(moderator, op))).toBe(false)
    const imports = STAFF_RESOURCES.find((r) => r.name === 'imports')!
    expect(canRun(moderator, imports.operations[0])).toBe(true)
  })

  it('marks account deletion, blocking and role changes as destructive', () => {
    const destructive = STAFF_RESOURCES.flatMap((r) => r.operations.filter((o) => o.destructive).map((o) => `${r.name}.${o.name}`))
    expect(destructive).toEqual(expect.arrayContaining(['users.block', 'users.delete', 'roles.set_role']))
  })
})
