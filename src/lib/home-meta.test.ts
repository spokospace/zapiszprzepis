import { describe, expect, it } from 'vitest'
import { HOME_DESCRIPTION, HOME_TITLE, homeMetadata, homeWebSiteJsonLd } from './home-meta'

const SITE_URL = 'https://zapiszprzepis.pl'

describe('homeMetadata', () => {
  const meta = homeMetadata(SITE_URL)

  it('exposes an Open Graph card with an absolute website URL', () => {
    const og = meta.openGraph
    expect(og).toBeDefined()
    expect(og?.title).toBe(HOME_TITLE)
    expect(og?.description).toBe(HOME_DESCRIPTION)
    // `type: 'website'` is narrowed away from the base Metadata type.
    expect((og as { type?: string })?.type).toBe('website')
    expect(og?.url).toBe(SITE_URL)
    expect(og?.siteName).toBe('Zapisz Przepis')
    expect(og?.locale).toBe('pl_PL')
  })

  it('uses an absolute 1200×630 og:image under the given origin', () => {
    const images = meta.openGraph?.images as Array<{ url: string; width?: number; height?: number }>
    expect(images).toHaveLength(1)
    const [image] = images
    expect(image.url).toBe(`${SITE_URL}/og/home.jpg`)
    expect(image.url).toMatch(/^https:\/\//)
    expect(image.width).toBe(1200)
    expect(image.height).toBe(630)
  })

  it('exposes a summary_large_image Twitter card with the same absolute image', () => {
    const twitter = meta.twitter
    expect((twitter as { card?: string })?.card).toBe('summary_large_image')
    expect(twitter?.title).toBe(HOME_TITLE)
    expect(twitter?.description).toBe(HOME_DESCRIPTION)
    const images = twitter?.images as string[]
    expect(images[0]).toBe(`${SITE_URL}/og/home.jpg`)
    expect(images[0]).toMatch(/^https:\/\//)
  })
})

describe('homeWebSiteJsonLd', () => {
  it('names the site for Google, with no retired search box', () => {
    expect(homeWebSiteJsonLd(SITE_URL)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Zapisz Przepis',
      url: 'https://zapiszprzepis.pl/',
      description: HOME_DESCRIPTION,
      inLanguage: 'pl-PL',
    })
  })
})
