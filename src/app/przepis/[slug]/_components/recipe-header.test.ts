import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecipeHeader, type RecipeHeaderData } from './recipe-header'

const BASE: RecipeHeaderData = {
  title: 'Zupa krem z dyni',
  description: null,
  meta_description: null,
  image_url: null,
  category: 'zupy',
  prep_time_minutes: null,
  cook_time_minutes: null,
  total_time_minutes: 45,
  times_estimated: false,
  source_type: 'web_blog',
  source_url: 'https://aniagotuje.pl/przepis/zupa',
  source_author: null,
  author_name: 'Ania K.',
  author_username: 'ania',
}

function render(extra: Partial<RecipeHeaderData>) {
  return renderToStaticMarkup(createElement(RecipeHeader, { recipe: { ...BASE, ...extra } }))
}

describe('RecipeHeader author line (E01-S23)', () => {
  it('"Dodała" for the feminine form, linking to the profile', () => {
    const html = render({ author_gender_form: 'f' })
    expect(html).toMatch(/Dodała <a[^>]*href="\/u\/ania"[^>]*>Ania K\.<\/a>/)
    expect(html).not.toContain('Dodane przez')
  })

  it('"Dodał" for the masculine form', () => {
    expect(render({ author_gender_form: 'm' })).toMatch(/Dodał <a[^>]*href="\/u\/ania"/)
  })

  it.each([undefined, null, 'female', 'x'])('neutral "Dodane przez" for %p (column missing or unknown)', (form) => {
    const html = render({ author_gender_form: form })
    expect(html).toContain('Dodane przez <a')
    expect(html).not.toMatch(/Dodała|Dodał /)
  })
})
