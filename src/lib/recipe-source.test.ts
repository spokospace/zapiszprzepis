import { describe, it, expect } from 'vitest'
import { formatSource, originalLinkLabel, sourceKind, sourceLabel } from '@/lib/recipe-source'
import { publicFacebookAuthor } from '@/lib/facebook-authors'

describe('publicFacebookAuthor', () => {
  const groupPost = 'https://www.facebook.com/groups/1539133879740780/posts/3620673438253470/'

  it("cuts a private person's full name to the first name and an initial", () => {
    expect(publicFacebookAuthor('Elżbieta Kacperek', groupPost)).toBe('Elżbieta K.')
    expect(publicFacebookAuthor('Anna Maria Nowak-Kowalska', groupPost)).toBe('Anna N.')
    expect(publicFacebookAuthor('RenataiPaweł Karyta', groupPost)).toBe('RenataiPaweł K.')
    // A numeric profile is a person too, unless it is a known author.
    expect(publicFacebookAuthor('Jan Kowalski', 'https://www.facebook.com/123456/posts/789/')).toBe('Jan K.')
  })

  it('keeps the full name of a known author and of a named Page', () => {
    expect(
      publicFacebookAuthor('Kulinarna Wiola', 'https://www.facebook.com/100069645633702/posts/pfbid02xHAq47/'),
    ).toBe('Kulinarna Wiola')
    expect(
      publicFacebookAuthor('Savory Daily Recipes', 'https://www.facebook.com/SavoryDailyRecipes/posts/pfbid031sm6/'),
    ).toBe('Savory Daily Recipes')
  })

  it('keeps names that are not a first and last name', () => {
    for (const name of ['BeHealthy', 'Proste przepisy', 'Alex & Cris P', 'Margie', 'MojeGotowanie.pl']) {
      expect(publicFacebookAuthor(name, groupPost)).toBe(name)
    }
  })

  it('shortens a person-shaped name when the post page is not a named Page', () => {
    // watch?v= says nothing about who posted, so it shortens to be safe.
    expect(publicFacebookAuthor('Savory Daily Recipes', 'https://www.facebook.com/watch?v=1381816580229910')).toBe(
      'Savory R.',
    )
  })
})

describe('sourceLabel', () => {
  it('names the platform for Facebook and YouTube', () => {
    expect(sourceLabel('facebook_text', 'https://www.facebook.com/groups/1/posts/2/')).toBe('Facebook')
    expect(sourceLabel('facebook_reel', null)).toBe('Facebook')
    expect(sourceLabel('youtube', 'https://youtu.be/abc')).toBe('YouTube')
  })

  it('names a known Facebook author before the platform, whatever the link shape', () => {
    const wiola = 'Facebook · Kulinarna Wiola'
    expect(sourceLabel('facebook_text', 'https://www.facebook.com/100069645633702/posts/pfbid0289YMoX2fdF/')).toBe(wiola)
    expect(sourceLabel('facebook_reel', 'https://www.facebook.com/100069645633702/videos/sernik/1784278505620096/')).toBe(wiola)
    expect(
      sourceLabel('facebook_text', 'https://www.facebook.com/permalink.php?story_fbid=pfbid0289YMoX2fdF&id=100069645633702'),
    ).toBe(wiola)
  })

  it('names the author stored at import, ahead of the known-profile map', () => {
    expect(sourceLabel('facebook_text', 'https://www.facebook.com/groups/1/posts/2/', 'Fefe Deni')).toBe('Facebook · Fefe Deni')
    expect(sourceLabel('youtube', 'https://youtu.be/abc', 'PALCE LIZAĆ')).toBe('YouTube · PALCE LIZAĆ')
    expect(sourceLabel('web_blog', 'https://www.polskiekulinaria.pl/tiramisu', 'Ania')).toBe('polskiekulinaria.pl')
  })

  it('keeps the bare platform for unknown profiles, groups and reels', () => {
    expect(sourceLabel('facebook_text', 'https://www.facebook.com/123456/posts/789/')).toBe('Facebook')
    expect(sourceLabel('facebook_text', 'https://www.facebook.com/groups/100069645633702/posts/2/')).toBe('Facebook')
    expect(sourceLabel('facebook_reel', 'https://www.facebook.com/reel/100069645633702')).toBe('Facebook')
    expect(sourceLabel('web_blog', 'https://example.com/100069645633702/')).toBe('example.com')
  })

  it("names a blog by its domain, without www", () => {
    expect(sourceLabel('web_blog', 'https://www.polskiekulinaria.pl/tiramisu')).toBe('polskiekulinaria.pl')
  })

  it('falls back to a generic label without a usable URL', () => {
    expect(sourceLabel('web_blog', null)).toBe('Blog')
    expect(sourceLabel('other', 'not a url')).toBe('Inny')
  })
})

describe('originalLinkLabel', () => {
  it('names the platform in the locative', () => {
    expect(originalLinkLabel('youtube', 'https://www.youtube.com/watch?v=abc')).toBe('Otwórz oryginał na YouTube')
    expect(originalLinkLabel('facebook_reel', 'https://www.facebook.com/reel/1')).toBe('Otwórz oryginał na Facebooku')
  })

  it('names a site by its domain, without www', () => {
    expect(originalLinkLabel('web_blog', 'https://www.aniagotuje.pl/przepis/zupa')).toBe('Otwórz oryginał na aniagotuje.pl')
  })

  it('falls back to a plain label for an unparseable URL', () => {
    expect(originalLinkLabel('web_blog', 'not a url')).toBe('Otwórz oryginał')
  })
})

describe('sourceKind', () => {
  it('maps the enum to a badge icon kind', () => {
    expect(sourceKind('youtube')).toBe('youtube')
    expect(sourceKind('facebook_text')).toBe('facebook')
    expect(sourceKind('facebook_reel')).toBe('facebook')
    expect(sourceKind('web_blog')).toBe('website')
    expect(sourceKind('other')).toBe('website')
  })
})

describe('formatSource', () => {
  it('pairs the icon kind with the reader-facing text', () => {
    expect(formatSource('web_blog', 'https://www.aniagotuje.pl/zupa')).toEqual({
      kind: 'website',
      text: 'aniagotuje.pl',
    })
    expect(formatSource('youtube', 'https://youtu.be/abc', 'Kuchnia Ani')).toEqual({
      kind: 'youtube',
      text: 'YouTube · Kuchnia Ani',
    })
    expect(formatSource('facebook_text', 'https://www.facebook.com/groups/1/posts/2/')).toEqual({
      kind: 'facebook',
      text: 'Facebook',
    })
  })
})
