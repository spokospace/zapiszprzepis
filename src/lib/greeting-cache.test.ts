import { describe, expect, it } from 'vitest'
import { runInNewContext } from 'node:vm'
import { GREETING_SCRIPT, clearGreetingCache, readGreetingCache, writeGreetingCache } from './greeting-cache'
import { greetingSuffix, homeGreeting } from './home'

function memory(initial?: string) {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set('zp-greeting', initial)
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

describe('greeting cache', () => {
  it('round-trips a name and a "no name" answer', () => {
    const s = memory()
    writeGreetingCache('u1', 'Aniu', s)
    expect(readGreetingCache(s)).toEqual({ userId: 'u1', name: 'Aniu' })
    writeGreetingCache('u1', null, s)
    expect(readGreetingCache(s)).toEqual({ userId: 'u1', name: '' })
  })

  it('reads nothing from a missing, broken or foreign entry', () => {
    expect(readGreetingCache(memory())).toBeNull()
    expect(readGreetingCache(memory('{nope'))).toBeNull()
    expect(readGreetingCache(memory('{"userId":1,"name":"x"}'))).toBeNull()
  })

  it('clears the entry', () => {
    const s = memory()
    writeGreetingCache('u1', 'Aniu', s)
    clearGreetingCache(s)
    expect(readGreetingCache(s)).toBeNull()
  })
})

describe('GREETING_SCRIPT', () => {
  function run(entry: string | undefined, session: boolean) {
    const style = new Map<string, string>()
    const documentElement = {
      dataset: (session ? { session: '1' } : {}) as Record<string, string>,
      style: { setProperty: (k: string, v: string) => void style.set(k, v) },
    }
    const storage = memory(entry)
    runInNewContext(GREETING_SCRIPT, { document: { documentElement }, localStorage: storage, JSON })
    return { dataset: documentElement.dataset, style }
  }

  it('hands the cached name to CSS for a reader with a session', () => {
    const { dataset, style } = run('{"userId":"u1","name":"Mateuszu"}', true)
    expect(dataset.greet).toBe('1')
    expect(style.get('--zp-greeting')).toBe('", Mateuszu"')
  })

  it('marks a cached "no name" without a name', () => {
    const { dataset, style } = run('{"userId":"u1","name":""}', true)
    expect(dataset.greet).toBe('1')
    expect(style.size).toBe(0)
  })

  it('does nothing for a guest, with no cache, or with an unsafe name', () => {
    expect(run('{"userId":"u1","name":"Aniu"}', false).dataset.greet).toBeUndefined()
    expect(run(undefined, true).dataset.greet).toBeUndefined()
    expect(run('{"userId":"u1","name":"x\\"}body{"}', true).dataset.greet).toBeUndefined()
  })
})

describe('greeting parts', () => {
  it('compose the same H1 as homeGreeting', () => {
    expect(greetingSuffix('Aniu')).toBe(', Aniu')
    expect(greetingSuffix(null)).toBe('')
    expect(homeGreeting('Aniu')).toBe('Czego dziś szukasz, Aniu?')
    expect(homeGreeting(null)).toBe('Czego dziś szukasz?')
  })
})
