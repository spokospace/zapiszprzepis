import { describe, it, expect, vi } from 'vitest'
import { formatExistingRecipes, LABELING_PROMPT, labelRecipe, resolveTitle } from '@/lib/recipe-labeling'

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
  it('returns the re-cased title, the note and the resolved tags', async () => {
    const fetch = openaiReply({ title: 'Bardzo kruche ciastka', description: 'z polewą czekoladową', tags: ['czekoladowe', 'nowy'] })

    await expect(labelRecipe(RECIPE, [], { fetch, apiKey: 'k' })).resolves.toEqual({
      title: 'Bardzo kruche ciastka',
      description: 'z polewą czekoladową',
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
      tags: ['kruche', 'szybkie'],
    })
  })
})
