import { describe, it, expect } from 'vitest'
import { splitLlmSteps, buildStepImageSources } from './step-image-extract'

describe('splitLlmSteps', () => {
  it('splits {text, image} entries into index-aligned texts and images', () => {
    expect(
      splitLlmSteps([
        { text: 'Wymieszaj', image: 'https://cdn/a.jpg' },
        { text: 'Piecz', image: null },
      ]),
    ).toEqual({ steps: ['Wymieszaj', 'Piecz'], images: ['https://cdn/a.jpg', null] })
  })

  it('accepts the old plain-string shape (no image)', () => {
    expect(splitLlmSteps(['Wymieszaj', 'Piecz'])).toEqual({
      steps: ['Wymieszaj', 'Piecz'],
      images: [null, null],
    })
  })

  it('trims the image, drops entries without text, and never throws', () => {
    expect(splitLlmSteps([{ text: 'A', image: '  https://cdn/a.jpg ' }, { image: 'x' }, 5, null])).toEqual({
      steps: ['A'],
      images: ['https://cdn/a.jpg'],
    })
    expect(splitLlmSteps(null)).toEqual({ steps: [], images: [] })
    expect(splitLlmSteps('nope')).toEqual({ steps: [], images: [] })
  })
})

describe('buildStepImageSources', () => {
  const html = '<img src="/wp/step1.jpg"><img src="https://cdn/step3.jpg">'

  it('keeps an LLM pick only when the exact URL is in the page, resolved to absolute', () => {
    expect(
      buildStepImageSources({
        steps: ['a', 'b', 'c'],
        llmImages: ['/wp/step1.jpg', 'https://invented/x.jpg', 'https://cdn/step3.jpg'],
        howToImages: [],
        html,
        pageUrl: 'https://blog.pl/przepis',
      }),
    ).toEqual(['https://blog.pl/wp/step1.jpg', null, 'https://cdn/step3.jpg'])
  })

  it('fills gaps from schema.org HowToStep images when the counts line up', () => {
    expect(
      buildStepImageSources({
        steps: ['a', 'b'],
        llmImages: [null, null],
        howToImages: ['https://cdn/h1.jpg', 'https://cdn/h2.jpg'],
        html: '',
        pageUrl: 'https://blog.pl/x',
      }),
    ).toEqual(['https://cdn/h1.jpg', 'https://cdn/h2.jpg'])
  })

  it('ignores HowToStep images when the step counts differ (no safe alignment)', () => {
    expect(
      buildStepImageSources({
        steps: ['a', 'b', 'c'],
        llmImages: [null, null, null],
        howToImages: ['https://cdn/h1.jpg'],
        html: '',
      }),
    ).toEqual([null, null, null])
  })

  it('never uses the cover photo, even if the LLM picked it', () => {
    expect(
      buildStepImageSources({
        steps: ['a'],
        llmImages: ['https://cdn/cover.jpg'],
        howToImages: [],
        html: '<img src="https://cdn/cover.jpg">',
        pageUrl: 'https://blog.pl/x',
        coverUrl: 'https://cdn/cover.jpg',
      }),
    ).toEqual([null])
  })
})
