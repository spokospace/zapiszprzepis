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

function render(extra: Partial<RecipeHeaderData>, actions?: Parameters<typeof RecipeHeader>[0]['actions']) {
  return renderToStaticMarkup(createElement(RecipeHeader, { recipe: { ...BASE, ...extra }, actions }))
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

  it('renders the description right under the title, before the source and times', () => {
    const html = render({ description: 'ze smalcem' })
    expect(html).toMatch(/<\/h1><p class="mb-3 text-scalable-body text-ink-soft">ze smalcem<\/p>/)
    expect(html.indexOf('ze smalcem')).toBeLessThan(html.indexOf('aniagotuje.pl'))
  })
})

describe('RecipeHeader layout (design 2026-10-28)', () => {
  const COVER = 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/c.webp'

  it('splits like the checklists below (1fr | 1.6fr), so the photo ends over „Składniki”', () => {
    expect(render({})).toMatch(/^<header class="mb-8 lg:grid lg:grid-cols-\[1fr_1\.6fr\][^"]*lg:gap-x-12[^"]*"/)
  })

  it('keeps the cover 4:3 at every width and bleeds it left from lg', () => {
    const html = render({ image_url: COVER })
    expect(html).toMatch(/class="recipe-print-cover [^"]*aspect-\[4\/3\][^"]*lg:bleed-left-page xl:row-span-2"/)
    expect(html).not.toContain('16/10')
  })

  it('puts the actions after the text: a full row below xl, under the description from xl', () => {
    const html = render({ meta_description: 'Opis przepisu.' }, createElement('div', { id: 'actions' }))
    expect(html).toMatch(
      /Opis przepisu\.<\/p><\/div><div class="lg:col-span-2 xl:col-span-1 xl:col-start-2"><div id="actions"><\/div><\/div><\/header>$/,
    )
    // From xl the photo spans both rows, so the actions sit in the text column.
    expect(html).toContain('xl:grid-rows-[auto_1fr]')
  })

  it('renders no actions wrapper when there are no actions', () => {
    expect(render({})).not.toContain('xl:col-start-2')
  })
})

describe('RecipeHeader list bar slot (A9)', () => {
  it('renders the slot first in the text column, hidden below lg', () => {
    const html = renderToStaticMarkup(
      createElement(RecipeHeader, { recipe: BASE, listBar: createElement('span', null, 'BAR') }),
    )
    expect(html).toMatch(/<div><div class="hidden print:hidden lg:mb-3 lg:block"><span>BAR<\/span><\/div><h1/)
  })

  it('renders no slot wrapper without a listBar', () => {
    expect(render({})).not.toContain('lg:mb-3 lg:block')
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
    expect(withPhoto).toContain('absolute bottom-0 left-px')
    expect(render({})).not.toContain('absolute bottom-0 left-px')
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
