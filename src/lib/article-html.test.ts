import { describe, it, expect } from 'vitest'
import { articleHtml } from '@/lib/article-html'

describe('articleHtml', () => {
  it('keeps the title and JSON-LD from <head> and drops its meta tags', () => {
    const html =
      '<html><head><title>White Pizza Dip</title><meta property="og:description" content="1 pint grape tomatoes 4 […]">' +
      '<script type="application/ld+json">{"@type":"Recipe","name":"Dip"}</script></head><body><p>Body</p></body></html>'
    const out = articleHtml(html)
    expect(out).toContain('<title>White Pizza Dip</title>')
    expect(out).toContain('{"@type":"Recipe","name":"Dip"}')
    expect(out).not.toContain('og:description')
    expect(out).toContain('<p>Body</p>')
  })

  it('drops the site menu, footer and sidebar but keeps a post header with its title', () => {
    const html =
      '<header class="site-header"><nav><a href="/recipes/">Recipes</a></nav></header>' +
      '<article><header class="entry-header"><h1>Pizza Pasta</h1></header><p>2 cups pasta</p></article>' +
      '<aside>Popular posts</aside><footer>Order my book</footer>'
    const out = articleHtml(html)
    expect(out).not.toContain('/recipes/')
    expect(out).not.toContain('Popular posts')
    expect(out).not.toContain('Order my book')
    expect(out).toContain('<h1>Pizza Pasta</h1>')
    expect(out).toContain('<p>2 cups pasta</p>')
  })

  it('keeps a recipe card inside an <aside>, without its buttons', () => {
    const html =
      '<p>Intro</p><aside class="wprm-recipe-container"><h2>Sernik</h2><button>Print</button>' +
      '<ul class="wprm-recipe-ingredients"><li>1 kg twarogu</li></ul></aside>' +
      '<aside class="sidebar">Popular posts</aside>'
    expect(articleHtml(html)).toBe('<p>Intro</p><aside><h2>Sernik</h2><ul><li>1 kg twarogu</li></ul></aside>')
  })

  it.each([
    ['schema.org microdata', '<div itemscope itemtype="https://schema.org/Recipe"><p>3 jajka</p></div>'],
    ['an ingredients list', '<ul class="recipe-ingredients"><li>3 jajka</li></ul>'],
    ['Tasty Recipes', '<div class="tasty-recipes"><p>3 jajka</p></div>'],
  ])('keeps a <form> holding %s', (_, card) => {
    expect(articleHtml(`<form action="/servings">${card}</form>`)).toContain('3 jajka')
  })

  it('drops a newsletter form', () => {
    const html = '<p>Body</p><form action="/subscribe"><input name="email"><p>Get new recipes by email</p></form>'
    expect(articleHtml(html)).toBe('<p>Body</p>')
  })

  it('keeps image URLs, links and alt text, and drops every other attribute', () => {
    const html =
      '<div class="wp-block-image size-large" style="x" data-id="9"><img class="lazy" src="https://e.com/a.jpg" data-src="https://e.com/b.jpg" alt="Step 1" srcset="https://e.com/a-300.jpg 300w" /></div>' +
      '<a class="btn" href="https://e.com/next">Next</a>'
    expect(articleHtml(html)).toBe(
      '<div><img src="https://e.com/a.jpg" data-src="https://e.com/b.jpg" alt="Step 1"></div><a href="https://e.com/next">Next</a>',
    )
  })

  it('handles a > inside a quoted attribute', () => {
    expect(articleHtml('<a title="a > b" href="/x">x</a>')).toBe('<a href="/x">x</a>')
  })
})
