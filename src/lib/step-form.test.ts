import { describe, it, expect, vi } from 'vitest'
import { acceptRewrite, isInstructionStep, needsStepRewrite, rewriteSteps, STEP_REWRITE_PROMPT } from './step-form'

/** A fetch that returns one OpenAI chat completion whose content is `body`. */
function mockFetch(body: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(body) } }] }),
  })) as unknown as typeof globalThis.fetch & ReturnType<typeof vi.fn>
}

// The steps of the Facebook recipe that prompted the rule (filet z kurczaka w musztardowym sosie).
const NARRATED = [
  'Umyte mięso pokroiłam w dość grubą kostkę.',
  'W rondlu na niewielkiej ilości rozgrzanego oleju delikatnie przyrumieniłam.',
  'Do rumianego mięsa dodałam pokrojoną drobno cebulę - zeszkliłam.',
]

describe('isInstructionStep', () => {
  it.each([
    'Umyte mięso pokroić w dość grubą kostkę.',
    'Na patelni rozgrzać olej.',
    'Wszystkie składniki dokładnie wymieszać.',
    'Ciasto piec 40 minut w 180°C.',
    'Gdy woda się zagotuje, wrzucić makaron.',
    'Formę posmarować masłem.',
  ])('accepts an instruction: %s', (step) => {
    expect(isInstructionStep(step)).toBe(true)
  })

  it.each([
    ...NARRATED,
    'Dodaj mąkę i wymieszaj.',
    'Kroję cebulę w kostkę.',
    'Pokroić mięso, ja dałam go więcej.',
    'Następnie gotujemy całość 20 minut.',
    'Ilość mąki zależy od jajek.',
  ])('flags a step that is not an instruction: %s', (step) => {
    expect(isInstructionStep(step)).toBe(false)
  })
})

describe('needsStepRewrite', () => {
  it('is true when any step is narrated', () => {
    expect(needsStepRewrite(['Pokroić mięso.', NARRATED[1]])).toBe(true)
  })

  it('is false when every step is an instruction', () => {
    expect(needsStepRewrite(['Pokroić mięso.', 'Dodać cebulę i zeszklić.'])).toBe(false)
  })
})

describe('acceptRewrite', () => {
  const original = ['Dodałam 2 łyżki musztardy.', 'Dusiłam 15 minut w 180°C.']

  it('returns the trimmed steps when the count and numbers match', () => {
    expect(acceptRewrite(original, { steps: [' Dodać 2 łyżki musztardy. ', 'Dusić 15 minut w 180°C.'] })).toEqual([
      'Dodać 2 łyżki musztardy.',
      'Dusić 15 minut w 180°C.',
    ])
  })

  it('treats a decimal comma and point as the same number', () => {
    expect(acceptRewrite(['Dodałam 1,5 szklanki.'], { steps: ['Dodać 1.5 szklanki.'] })).toEqual(['Dodać 1.5 szklanki.'])
  })

  it.each([
    ['a merged step', { steps: ['Dodać 2 łyżki musztardy i dusić 15 minut w 180°C.'] }],
    ['a changed number', { steps: ['Dodać 2 łyżki musztardy.', 'Dusić 20 minut w 180°C.'] }],
    ['a dropped number', { steps: ['Dodać musztardę.', 'Dusić 15 minut w 180°C.'] }],
    ['an empty step', { steps: ['Dodać 2 łyżki musztardy.', ' '] }],
    ['a non-text step', { steps: ['Dodać 2 łyżki musztardy.', 15] }],
    ['no steps key', { method: [] }],
    ['null', null],
  ])('rejects %s', (_, raw) => {
    expect(acceptRewrite(original, raw)).toBeNull()
  })
})

describe('rewriteSteps', () => {
  it('sends the steps with the rewrite prompt and returns the accepted answer', async () => {
    const fetch = mockFetch({ steps: ['Umyte mięso pokroić w dość grubą kostkę.'] })

    await expect(rewriteSteps([NARRATED[0]], { fetch, apiKey: 'k' })).resolves.toEqual([
      'Umyte mięso pokroić w dość grubą kostkę.',
    ])
    const body = JSON.parse(String(fetch.mock.calls[0][1].body))
    expect(body.messages[0].content).toBe(STEP_REWRITE_PROMPT)
    expect(JSON.parse(body.messages[1].content)).toEqual({ steps: [NARRATED[0]] })
    expect(body.temperature).toBe(0)
  })

  it('returns null when the answer drops a step', async () => {
    const fetch = mockFetch({ steps: ['Pokroić mięso i przyrumienić.'] })

    await expect(rewriteSteps(NARRATED.slice(0, 2), { fetch, apiKey: 'k' })).resolves.toBeNull()
  })
})
