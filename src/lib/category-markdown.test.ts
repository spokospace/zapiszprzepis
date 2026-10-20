import { describe, it, expect } from 'vitest'
import { categoryToMarkdown } from './category-markdown'

const SITE = 'https://zapiszprzepis.pl'

describe('categoryToMarkdown', () => {
  it('renders an H1, a count summary and recipe links to each .md', () => {
    const md = categoryToMarkdown(
      'ciasta',
      [
        { slug: 'sernik', title: 'Sernik' },
        { slug: 'szarlotka', title: 'Szarlotka' },
      ],
      SITE,
    )
    expect(md.startsWith('# Przepisy: Ciasta\n')).toBe(true)
    expect(md).toContain('2 przepisów w kategorii „Ciasta”')
    expect(md).toContain('- [Sernik](https://zapiszprzepis.pl/przepis/sernik.md)')
    expect(md).toContain('- [Szarlotka](https://zapiszprzepis.pl/przepis/szarlotka.md)')
  })

  it('handles an empty category without a list', () => {
    const md = categoryToMarkdown('syropy', [], SITE)
    expect(md).toContain('Brak przepisów w kategorii „Syropy i napary”')
    expect(md).not.toContain('- [')
  })
})
