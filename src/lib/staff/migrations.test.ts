import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Static guards over the admin panel migrations (files starting 20261028 or
// later whose name begins with a staff/admin word). They cannot replace the
// assertion functions the migrations run themselves, but they fail in CI, before
// a migration is ever applied to the database.
const DIR = join(process.cwd(), 'supabase', 'migrations')
const ADMIN_MIGRATION = /^2026102[89]\d{6}_(staff|admin)_.*\.sql$/

const files = readdirSync(DIR).filter((f) => ADMIN_MIGRATION.test(f))
const sql = (name: string) => readFileSync(join(DIR, name), 'utf8')

describe('admin panel migrations', () => {
  it('finds the Phase 1 migrations', () => {
    expect(files.some((f) => f.includes('staff_roles_permissions'))).toBe(true)
    expect(files.some((f) => f.includes('staff_audit_log'))).toBe(true)
  })

  // The guards SQL enforces cannot run in Vitest. Pin their presence so a rewrite
  // that drops one fails here; the behaviour is covered by supabase/tests (manual).
  describe('admin_roles', () => {
    const roles = files.find((f) => f.includes('admin_roles'))
    const text = roles ? sql(roles).replace(/--.*$/gm, '') : ''

    it('refuses a self role change and removing the last admin, under a lock', () => {
      expect(text).toMatch(/p_actor = p_user[\s\S]*cannot_change_own_role/)
      expect(text).toMatch(/last_admin/)
      expect(text).toMatch(/pg_advisory_xact_lock\(hashtext\('admin_set_role'\)\)/)
    })
  })

  describe('admin_users', () => {
    const users = files.find((f) => f.includes('admin_users'))
    const text = users ? sql(users).replace(/--.*$/gm, '') : ''

    it('refuses to block or delete oneself or a staff member', () => {
      expect(text).toMatch(/cannot_target_self/)
      expect(text).toMatch(/cannot_target_staff/)
    })

    it('searches e-mail only for callers who may read it', () => {
      expect(text).toMatch(/can_email and u\.email ilike/)
    })
  })

  describe('admin_access', () => {
    const access = files.find((f) => f.includes('admin_access'))
    const text = access ? sql(access).replace(/--.*$/gm, '') : ''

    it('keeps the generated code out of the audit log', () => {
      const audit = text.match(/staff_audit\([\s\S]*?\);/g) ?? []
      expect(audit.length).toBeGreaterThan(0)
      for (const call of audit) expect(call).not.toMatch(/new_code|raw/)
    })
  })

  for (const file of files) {
    describe(file, () => {
      // Comments are prose ("take them back from anon") and must not trip the grep.
      const text = sql(file).replace(/--.*$/gm, '')

      it('sets an empty search_path on every SECURITY DEFINER function', () => {
        const functions = text.split(/create or replace function /i).slice(1)
        for (const body of functions) {
          const header = body.split(/\$\$/)[0]
          if (/security definer/i.test(header)) {
            expect(header, header.split('\n')[0]).toMatch(/set search_path\s*=\s*''/i)
          }
        }
      })

      it('never grants a staff table or function to anon', () => {
        for (const stmt of text.match(/grant\s+[^;]+;/gi) ?? []) {
          if (/\bto\b[^;]*\banon\b/i.test(stmt)) {
            // The only allowed anon grant would be a deliberate public function; none exists in Phase 1.
            expect.fail(`grants to anon: ${stmt}`)
          }
        }
      })

      it('gives authenticated no write grant on a table', () => {
        for (const stmt of text.match(/grant\s+[^;]+;/gi) ?? []) {
          if (/\bon\s+(table\s+)?public\.[a-z_]+\s+to\b[^;]*\bauthenticated\b/i.test(stmt)) {
            expect(stmt).not.toMatch(/\b(insert|update|delete|all)\b/i)
          }
        }
      })

      it('does not add a role column to profiles', () => {
        expect(text).not.toMatch(/alter table public\.profiles[^;]*\brole\b/i)
      })
    })
  }
})
