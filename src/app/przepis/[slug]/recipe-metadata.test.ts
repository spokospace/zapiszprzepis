import { describe, it, expect } from 'vitest'
import { recipeMetadata } from './recipe-metadata'
import type { RecipeForJsonLd } from '@/lib/recipe-json-ld'

const SITE = 'https://zapiszprzepis.pl'
const COVER = 'https://x.supabase.co/storage/v1/object/public/recipe-images/u/7/rogale.webp'

const base: RecipeForJsonLd = {
  slug: 'rogale-francuskie',
  title: 'Croissanty',
  description: null,
  meta_description: 'Maślane croissanty krok po kroku.',
  image_url: COVER,
  ingredients: [],
  steps: [],
  prep_time_minutes: null,
  cook_time_minutes: null,
  total_time_minutes: null,
  servings: null,
  category: 'pieczywo',
  created_at: '2026-01-02T10:00:00.000Z',
}

describe('recipeMetadata', () => {
  it('ends the <title> with the site name, like the category pages', () => {
    expect(recipeMetadata(base, SITE).title).toBe('Croissanty · Zapisz Przepis')
  })

  it('adds the variant line to the <title> so same-named dishes differ (#745)', () => {
    expect(recipeMetadata({ ...base, description: 'z białą fasolą' }, SITE).title).toBe(
      'Croissanty z białą fasolą · Zapisz Przepis',
    )
    expect(recipeMetadata({ ...base, description: ' z masłem. ' }, SITE).title).toBe('Croissanty z masłem · Zapisz Przepis')
  })

  it('leaves out a variant line too long for a title', () => {
    expect(recipeMetadata({ ...base, description: 'x'.repeat(61) }, SITE).title).toBe('Croissanty · Zapisz Przepis')
  })

  it('uses a hand-written meta_title over the variant line', () => {
    const meta = recipeMetadata({ ...base, description: 'z masłem', meta_title: ' Croissanty jak z Paryża ' }, SITE)
    expect(meta.title).toBe('Croissanty jak z Paryża · Zapisz Przepis')
    expect(meta.openGraph?.title).toBe('Croissanty')
  })

  it('keeps og:title the dish alone', () => {
    expect(recipeMetadata(base, SITE).openGraph?.title).toBe('Croissanty')
  })

  it('names the page, the site and the locale in Open Graph', () => {
    const og = recipeMetadata(base, SITE).openGraph
    expect(og?.url).toBe('https://zapiszprzepis.pl/przepis/rogale-francuskie')
    expect(og?.siteName).toBe('Zapisz Przepis')
    expect(og?.locale).toBe('pl_PL')
  })

  it('gives the cover an alt text and no made-up size', () => {
    const meta = recipeMetadata(base, SITE)
    expect(meta.openGraph?.images).toEqual([{ url: COVER, alt: 'Croissanty' }])
    expect((meta.twitter as { card?: string }).card).toBe('summary_large_image')
  })

  it('has no image and a small card when the cover is not archived', () => {
    const meta = recipeMetadata({ ...base, image_url: 'https://cdn.example.com/x.jpg' }, SITE)
    expect(meta.openGraph?.images).toBeUndefined()
    expect((meta.twitter as { card?: string }).card).toBe('summary')
  })

  it('points the canonical and the Markdown alternate at the bare recipe URL', () => {
    expect(recipeMetadata(base, SITE).alternates).toEqual({
      canonical: 'https://zapiszprzepis.pl/przepis/rogale-francuskie',
      types: { 'text/markdown': 'https://zapiszprzepis.pl/przepis/rogale-francuskie.md' },
    })
  })
})
