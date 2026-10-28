import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecipeBreadcrumbs, RecipeHeader, authorInitial, eyebrowParts, type RecipeHeaderData } from './recipe-header'

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

type Props = Parameters<typeof RecipeHeader>[0]

function render(extra: Partial<RecipeHeaderData>, props: Partial<Omit<Props, 'recipe'>> = {}) {
  return renderToStaticMarkup(createElement(RecipeHeader, { recipe: { ...BASE, ...extra }, ...props }))
}

describe('RecipeHeader author line (E01-S23; handoff 2026-10-28)', () => {
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

  it('opens with the initial in a warm circle, hidden from screen readers', () => {
    expect(render({})).toMatch(/<span aria-hidden="true" class="flex h-8 w-8 [^"]*bg-\[#fde7d3\][^"]*">A<\/span>/)
  })

  // Owner, 2026-10-28: the badge already names the source, so the author line does not.
  it('does not repeat the source after the author', () => {
    expect(render({})).not.toContain('źródło:')
    expect(render({ image_url: 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/c.webp' })).not.toContain('źródło:')
  })
})

describe('RecipeHeader label over the title (handoff 2026-10-28)', () => {
  it('joins the category and up to two tags', () => {
    expect(eyebrowParts('pieczywo', ['drozdzowe'])[0]).toBe('Pieczywo')
    expect(eyebrowParts('zupy', ['a', 'b', 'c'])).toHaveLength(3)
    expect(eyebrowParts('zupy', null)).toEqual(['Zupy'])
  })

  it('leaves out a tag that repeats the category', () => {
    expect(eyebrowParts('zupy', ['Zupy'])).toEqual(['Zupy'])
  })

  it('renders above the title in uppercase accent text, 16 px', () => {
    expect(render({})).toMatch(/<p class="mb-2 text-\[16px\] font-bold uppercase tracking-\[0\.06em\] text-action-text">Zupy<\/p><h1/)
  })

  it('takes the first letter of the name, upper-cased', () => {
    expect(authorInitial('tola')).toBe('T')
    expect(authorInitial(' ania k.')).toBe('A')
  })
})

describe('RecipeHeader time strip (handoff 2026-10-28)', () => {
  it('shows the times and the yield at every width', () => {
    const html = render({ prep_time_minutes: 15, cook_time_minutes: 30, total_time_minutes: 45, servings: 4 })
    const strip = html.match(/<ul aria-label="Czas i porcje" class="([^"]*)">[\s\S]*?<\/ul>/)
    expect(strip?.[1]).not.toMatch(/(^|\s)hidden(\s|$)/)
    expect(strip?.[0]).toContain('<span class="block text-[16px] text-ink-soft">Przygotowanie</span><span class="block text-[20px] font-extrabold text-ink">15 min</span>')
    expect(strip?.[0]).toContain('>Gotowanie<')
    expect(strip?.[0]).toContain('>Łącznie<')
    expect(strip?.[0]).toContain('<span class="block text-[16px] text-ink-soft">Wychodzi</span><span class="block text-[20px] font-extrabold text-ink">4 porcje</span>')
  })

  it('puts each item beside an icon in a warm circle hidden from screen readers', () => {
    const strip = render({ total_time_minutes: 45 }).match(/<ul aria-label="Czas i porcje"[\s\S]*?<\/ul>/)?.[0] ?? ''
    expect(strip).toMatch(/<span aria-hidden="true" class="flex h-11 w-11 [^"]*bg-\[#fdf1e4\]"><svg/)
  })

  it('marks estimated times with "≈" read as "około", never the yield', () => {
    const html = render({ total_time_minutes: 45, times_estimated: true, servings: 2 })
    expect(html).toContain('<span class="block text-[20px] font-extrabold text-ink"><span aria-hidden="true">≈ </span><span class="sr-only">około </span>45 min</span>')
    expect(html).toContain('<span class="block text-[20px] font-extrabold text-ink">2 porcje</span>')
  })

  it('renders no strip when neither a time nor the servings are known', () => {
    expect(render({ total_time_minutes: null })).not.toContain('Czas i porcje')
  })

  it('shows the yield alone when no time is known', () => {
    const html = render({ total_time_minutes: null, servings: 1 })
    expect(html).toContain('>1 porcja<')
    expect(html).not.toContain('>Łącznie<')
  })
})

describe('RecipeHeader order and layout (handoff 2026-10-28)', () => {
  const COVER = 'https://x.supabase.co/storage/v1/object/public/recipe-images/1/c.webp'

  it('is two equal columns from lg, one below', () => {
    expect(render({})).toMatch(/^<header class="mb-10 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10">/)
  })

  it('keeps the cover 4:3, bleeding only below lg, square from lg', () => {
    const html = render({ image_url: COVER })
    expect(html).toMatch(/class="recipe-print-cover [^"]*-mx-4[^"]*lg:mx-0 lg:mt-0[^"]*"/)
    expect(html).not.toContain('bleed-left-page')
    expect(html).not.toContain('rounded-r-tile')
    expect(html).toContain('class="relative aspect-[4/3]"')
  })

  it('reads: label, title, subtitle, author, description, times, actions, versions', () => {
    const html = render(
      { description: 'ze smalcem', meta_description: 'Opis przepisu.', total_time_minutes: 45 },
      { actions: createElement('div', { id: 'actions' }), versionsBar: createElement('div', { id: 'versions' }) },
    )
    const order = ['>Zupy</p><h1', '</h1>', 'ze smalcem', 'Dodane przez', 'Opis przepisu.', 'Czas i porcje', 'id="actions"', 'id="versions"']
    const positions = order.map((s) => html.indexOf(s))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('sets the subtitle at 22 px from lg', () => {
    expect(render({ description: 'ze smalcem' })).toMatch(/<\/h1><p class="mb-3 text-scalable-body text-ink-soft lg:text-\[22px\]">ze smalcem<\/p>/)
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

describe('RecipeHeader title (C3; handoff 2026-10-28)', () => {
  it('sets the 32 px title at line-height 1.15, 48 px extra-bold from lg', () => {
    expect(render({})).toMatch(/<h1 class="[^"]*text-\[32px\] leading-\[1\.15\] font-bold[^"]*lg:text-\[48px\] lg:leading-\[1\.05\] lg:font-extrabold/)
  })
})

// The breadcrumbs are no longer inside the header: the page renders them in the row above it.
describe('RecipeHeader breadcrumbs', () => {
  it('has none inside the header', () => {
    expect(render({})).not.toContain('aria-label="Okruszki"')
  })

  it('ends with the recipe itself, not a link, when given a title', () => {
    const html = renderToStaticMarkup(createElement(RecipeBreadcrumbs, { category: 'pieczywo', title: 'Bułki pszenne' }))
    expect(html).toContain('>Przepisy</a>')
    expect(html).toContain('>Pieczywo</a>')
    expect(html).toMatch(/<li aria-current="page"[^>]*>Bułki pszenne<\/li>/)
  })
})
