import { describe, it, expect, vi } from 'vitest'
import { formatExistingRecipes, generateMetaDescription, isNearCopy, LABELING_PROMPT, labelRecipe, resolveTitle } from '@/lib/recipe-labeling'

const RECIPE = {
  title: 'Bardzo Kruche Ciastka',
  category: 'ciasteczka',
  ingredients: [{ name: 'masło', amount: '200', unit: 'g' }],
  steps: ['Zagnieć ciasto', 'Piecz 15 minut'],
  totalTimeMinutes: 25,
}

function openaiReply(content: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
  })) as unknown as typeof globalThis.fetch
}

describe('LABELING_PROMPT', () => {
  it('offers the LLM every tag with its meaning, except the computed one', () => {
    expect(LABELING_PROMPT).toContain('majonezowe: mayonnaise')
    expect(LABELING_PROMPT).not.toMatch(/^\s+szybkie:/m)
  })
})

describe('resolveTitle', () => {
  it('accepts a change of letter case only', () => {
    expect(resolveTitle('Bardzo kruche ciastka', 'Bardzo Kruche Ciastka')).toBe('Bardzo kruche ciastka')
  })

  it('keeps the original when the LLM reworded it or gave nothing', () => {
    expect(resolveTitle('Kruche ciasteczka maślane', 'Bardzo Kruche Ciastka')).toBe('Bardzo Kruche Ciastka')
    expect(resolveTitle(undefined, 'Tiramisu')).toBe('Tiramisu')
  })
})

describe('formatExistingRecipes', () => {
  it('lists titles with their notes', () => {
    expect(
      formatExistingRecipes([
        { title: 'Maślane ciasteczka', description: 'z rowkami' },
        { title: 'Tiramisu', description: null },
      ]),
    ).toBe('- Maślane ciasteczka — z rowkami\n- Tiramisu')
    expect(formatExistingRecipes([])).toBe('(none)')
  })
})

describe('labelRecipe', () => {
  it('returns the re-cased title, the note, the meta description and the resolved tags', async () => {
    const fetch = openaiReply({
      title: 'Bardzo kruche ciastka',
      description: 'z polewą czekoladową',
      metaDescription: 'Bardzo kruche ciastka maślane z polewą czekoladową — prosty przepis na chrupiące ciasteczka.',
      tags: ['czekoladowe', 'nowy'],
    })

    await expect(labelRecipe(RECIPE, [], { fetch, apiKey: 'k' })).resolves.toEqual({
      title: 'Bardzo kruche ciastka',
      description: 'z polewą czekoladową',
      metaDescription: 'Bardzo kruche ciastka maślane z polewą czekoladową — prosty przepis na chrupiące ciasteczka.',
      tags: ['kruche', 'szybkie', 'czekoladowe'],
    })
  })

  it("sends the user's other recipes so the note can differ from theirs", async () => {
    const fetch = openaiReply({})
    await labelRecipe(RECIPE, [{ title: 'Kruche ciastka', description: 'z dżemem' }], { fetch, apiKey: 'k' })

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))
    expect(body.messages[0].content).toContain('- Kruche ciastka — z dżemem')
  })

  it('falls back to the title-and-time tags when the call fails, instead of throwing', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof globalThis.fetch

    await expect(labelRecipe(RECIPE, [], { fetch, apiKey: 'k' })).resolves.toEqual({
      title: 'Bardzo Kruche Ciastka',
      description: null,
      metaDescription: null,
      tags: ['kruche', 'szybkie'],
    })
  })
})

describe('generateMetaDescription', () => {
  it('returns the clamped sentence and passes the source description as a hint', async () => {
    const fetch = openaiReply({ metaDescription: 'Kruche ciastka maślane, chrupiące i proste w wykonaniu.' })

    await expect(
      generateMetaDescription(RECIPE, { sourceDescription: 'Najlepsze kruche ciastka!', fetch, apiKey: 'k' }),
    ).resolves.toBe('Kruche ciastka maślane, chrupiące i proste w wykonaniu.')

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))
    expect(JSON.parse(body.messages[1].content).sourceDescription).toBe('Najlepsze kruche ciastka!')
  })

  it('returns null when the call fails, so the caller can fall back', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof globalThis.fetch

    await expect(generateMetaDescription(RECIPE, { fetch, apiKey: 'k' })).resolves.toBeNull()
  })

  it('retries without the hint when the model echoes the source, then keeps the rewrite', async () => {
    const source = 'Najlepsze kruche ciastka maślane prosto z pieca.'
    const replies = [source, 'Maślane ciasteczka, które rozpływają się w ustach — szybkie i chrupiące.']
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ metaDescription: replies.shift() }) } }] }),
    })) as unknown as typeof globalThis.fetch

    await expect(generateMetaDescription(RECIPE, { sourceDescription: source, fetch, apiKey: 'k' })).resolves.toBe(
      'Maślane ciasteczka, które rozpływają się w ustach — szybkie i chrupiące.',
    )
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
  })

  it('returns null when even the retry echoes the source, so the caller falls back', async () => {
    const source = 'Najlepsze kruche ciastka maślane prosto z pieca.'
    const fetch = openaiReply({ metaDescription: source })

    await expect(
      generateMetaDescription(RECIPE, { sourceDescription: source, fetch, apiKey: 'k' }),
    ).resolves.toBeNull()
  })
})

describe('isNearCopy', () => {
  it('flags verbatim and lightly-reworded copies', () => {
    expect(isNearCopy('Kruche ciastka maślane.', 'kruche ciastka maślane')).toBe(true)
    expect(isNearCopy('Najlepsze kruche ciastka maślane z pieca, extra.', 'Najlepsze kruche ciastka maślane z pieca')).toBe(true)
  })

  it('allows a genuinely different sentence', () => {
    expect(isNearCopy('Maślane ciasteczka, które rozpływają się w ustach.', 'Najlepsze kruche ciastka z pieca')).toBe(false)
    expect(isNearCopy('', 'cokolwiek')).toBe(false)
  })
})
