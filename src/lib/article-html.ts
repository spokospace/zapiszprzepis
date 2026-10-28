// The page HTML as the extraction LLM reads it. The prompt caps the HTML at
// 20,000 characters, which a whole page spends on <head> meta, the site menu and
// class attributes before the article starts (howsweeteats.com: recipe ~62,000
// characters in; ~16,500 once trimmed). Only the LLM's view: photo scans and
// step-image validation keep the full HTML.

import { readableHtml } from './jina-reader'
import { LD_JSON_RE } from './recipe-image-archive'

// Attributes the model needs: image URLs for step photos, links, alt text.
const KEPT_ATTRIBUTE = /\s(?:src|data-src|data-lazy-src|alt|href)=(?:"[^"]*"|'[^']*')/gi

// Recipe-card plugins (WP Recipe Maker, Tasty Recipes, Mediavine Create),
// schema.org Recipe microdata, or an ingredients list.
const RECIPE_MARKUP =
  /\bwprm-|\btasty-recipes?\b|\bmv-create-|itemtype=["'][^"']*schema\.org\/Recipe\b|(?:class|id|itemprop)=["'][^"']*(?:ingredient|skladnik)/i

export function articleHtml(html: string): string {
  return (
    readableHtml(html)
      // <head>: keep the title and any schema.org JSON-LD (often the whole
      // recipe), drop the meta tags — og:description is a truncated teaser.
      .replace(/<head\b[^>]*>([\s\S]*?)<\/head>/i, (_, head: string) =>
        [head.match(/<title\b[^>]*>[\s\S]*?<\/title>/i)?.[0] ?? '', ...[...head.matchAll(LD_JSON_RE)].map((m) => m[0])].join(''),
      )
      // Site chrome. A <header> goes only when it holds the site menu: a post's
      // own <header class="entry-header"> carries its title.
      .replace(/<header\b[^>]*>(?:(?!<\/header>)[\s\S])*?<nav\b[\s\S]*?<\/header>/gi, '')
      .replace(/<(nav|footer|button|select)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      // Sidebars and newsletter boxes, unless the recipe card itself sits in one.
      .replace(/<(aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi, (block) => (RECIPE_MARKUP.test(block) ? block : ''))
      .replace(/<(\w[\w-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (_, tag: string, attrs: string) =>
        `<${tag}${(attrs.match(KEPT_ATTRIBUTE) ?? []).join('')}>`,
      )
      .replace(/\s{2,}/g, ' ')
  )
}
