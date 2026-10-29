/** The site's name: the title suffix, og:site_name and the WebSite JSON-LD. */
export const SITE_NAME = 'Zapisz Przepis'

/**
 * The Open Graph fields every page's card shares. Spread into each openGraph
 * block: Next replaces a layout's openGraph wholesale when a page sets its own.
 */
export const OG_SITE = { siteName: SITE_NAME, locale: 'pl_PL' } as const
