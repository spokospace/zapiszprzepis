import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Static privacy guard for E01-S23 (the rolled-back rehearsal
 * .ai/qa/s23-rehearse-author-gender-form.sql checks the live grants): guests
 * may receive only the grammatical form, never the raw gender, and
 * profiles_private never gains an anon grant.
 */
const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')
const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'))
const sql = (f: string) => readFileSync(join(MIGRATIONS, f), 'utf8').replace(/--.*$/gm, '')

describe('gender privacy in migrations', () => {
  it('no migration grants anything on profiles_private to anon', () => {
    for (const f of files) {
      expect(sql(f), f).not.toMatch(/grant[^;]*on\s+(table\s+)?public\.profiles_private[^;]*\banon\b/i)
    }
  })

  it('the S23 view exposes the form only, not the raw gender', () => {
    const m = sql('20261017210000_author_gender_form.sql')
    const view = m.slice(m.indexOf('create or replace view public.public_recipes'), m.indexOf('comment on view'))
    // The only use of pp.* in the view is inside the case expression.
    expect(view).toMatch(/case pp\.gender when 'female' then 'f' when 'male' then 'm' end as author_gender_form/)
    expect(view.match(/pp\.\w+/g)).toEqual(['pp.gender', 'pp.id'])
    expect(view).not.toMatch(/first_name|gender_set_at/)
  })

  it('profile_gender_form returns only the form', () => {
    const m = sql('20261017210000_author_gender_form.sql')
    const fn = m.slice(m.indexOf('create or replace function public.profile_gender_form'))
    expect(fn).toMatch(/returns text/)
    expect(fn).toMatch(/select case pp\.gender when 'female' then 'f' when 'male' then 'm' end\s+from/)
    expect(fn).toMatch(/security definer\s+set search_path = ''/)
  })
})
