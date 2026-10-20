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

describe('RecipeHeader desktop column (A9)', () => {
  it('shows the times row from lg only, and the "Kategoria · czas" line below lg only', () => {
    const html = render({ prep_time_minutes: 15, cook_time_minutes: 30, total_time_minutes: 45 })
    expect(html).toMatch(/<dl class="[^"]*hidden[^"]*lg:flex"/)
    expect(html).toContain('<dt class="text-[16px] text-ink-soft">Przygotowanie</dt><dd class="text-[20px] font-bold text-ink">15 min</dd>')
    expect(html).toContain('<dt class="text-[16px] text-ink-soft">Łącznie</dt>')
    expect(html).toMatch(/<p class="[^"]*lg:hidden">Zupy · 45 min<\/p>/)
  })

  it('marks estimated times with "≈" read as "około"', () => {
    const html = render({ total_time_minutes: 45, times_estimated: true })
    expect(html).toContain('<dd class="text-[20px] font-bold text-ink"><span aria-hidden="true">≈ </span><span class="sr-only">około </span>45 min</dd>')
  })

  it('renders no times row when no time is known', () => {
    expect(render({ total_time_minutes: null })).not.toContain('<dl')
  })

  it('puts the actions last in the text column', () => {
    const html = renderToStaticMarkup(
      createElement(RecipeHeader, {
        recipe: { ...BASE, description: 'Krem z dyni.' },
        actions: createElement('div', { id: 'actions' }),
      }),
    )
    expect(html).toMatch(/<div id="actions"><\/div><\/div><\/header>$/)
  })

  it('renders the description right under the title, before the source and times', () => {
    const html = render({ description: 'ze smalcem' })
    expect(html).toMatch(/<\/h1><p class="mb-3 text-scalable-body text-ink-soft">ze smalcem<\/p>/)
    expect(html.indexOf('ze smalcem')).toBeLessThan(html.indexOf('aniagotuje.pl'))
  })
})

describe('RecipeHeader source badge (E01-S31 §3)', () => {
  it('links to the original in a new tab, with no "Źródło:" line', () => {
    const html = render({})
    expect(html).toMatch(/<a href="https:\/\/aniagotuje\.pl\/przepis\/zupa" target="_blank" rel="noopener"/)
    expect(html).toContain('aria-label="Otwórz oryginał: aniagotuje.pl (nowa karta)"')
    expect(html).not.toContain('Źródło:')
  })

  it('sits on the photo when there is one, inline when there is not', () => {
    const withPhoto = render({ image_url: 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/c.webp' })
    expect(withPhoto).toContain('absolute bottom-3 left-3')
    expect(render({})).not.toContain('absolute bottom-3 left-3')
  })

  it('a page-less recipe (no URL) gets a plain, link-less badge', () => {
    const html = render({ source_type: 'other', source_url: null })
    expect(html).not.toContain('target="_blank"')
    expect(html).toContain('Inny')
  })
})

describe('RecipeHeader title (C3)', () => {
  it('sets the 32 px title at line-height 1.15', () => {
    expect(render({})).toMatch(/<h1 class="[^"]*text-\[32px\] leading-\[1\.15\] font-bold/)
  })
})

// C3: the phone header leads back to the list; no „Przepisy › {Kategoria}” over the title.
describe('RecipeHeader breadcrumbs', () => {
  it('has no breadcrumbs (they live in the page’s A9 row from lg)', () => {
    const html = render({})
    expect(html).not.toContain('aria-label="Okruszki"')
    expect(html).not.toContain('>Przepisy</a>')
  })
})
