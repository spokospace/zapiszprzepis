import { describe, it, expect } from 'vitest'
import { parsePermissions, STAFF_PERMISSIONS } from './permissions'

describe('parsePermissions', () => {
  it('keeps the permissions the app knows', () => {
    expect([...parsePermissions(['users.read', 'audit.read'])].sort()).toEqual(['audit.read', 'users.read'])
  })

  it('drops unknown strings and non-strings instead of trusting the database blindly', () => {
    expect([...parsePermissions(['users.read', 'users.fly', 7, null])]).toEqual(['users.read'])
  })

  it('treats anything but an array as no permissions', () => {
    expect(parsePermissions(null).size).toBe(0)
    expect(parsePermissions('users.read').size).toBe(0)
    expect(parsePermissions({ 0: 'users.read' }).size).toBe(0)
  })

  it('lists each permission once', () => {
    expect(new Set(STAFF_PERMISSIONS).size).toBe(STAFF_PERMISSIONS.length)
  })
})
