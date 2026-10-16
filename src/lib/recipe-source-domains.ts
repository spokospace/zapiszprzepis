import recipeBlogDomains from './recipe-blog-domains.json'

// Large Polish recipe portals. aDupaRośnie aggregates independent blogs only,
// so these are picked by hand.
const RECIPE_PORTAL_DOMAINS = [
  'aniagotuje.pl',
  'beszamel.se.pl',
  'doradcasmaku.pl',
  'gotujmy.pl',
  'jadlonomia.com',
  'krokpokroku.pl',
  'kuchnia.wp.pl',
  'kulinarnapolska.org',
  'kwestiasmaku.com',
  'mojegotowanie.pl',
  'mojewypieki.com',
  'poprostupycha.com.pl',
  'przepisy.lidl.pl',
  'przepisy.pl',
  'smaker.pl',
  'wielkiezarcie.com',
  'winiary.pl',
  'wszystkiegoslodkiego.pl',
]

// Recipe authors who publish on a personal Facebook profile rather than a
// blog. Exa matches includeDomains entries as a URL prefix, so the profile id
// path keeps the rest of facebook.com out. Exa indexes their posts as
// /<id>/posts/… and /<id>/videos/…, which the Facebook import handles.
const RECIPE_FACEBOOK_PROFILES = [
  'facebook.com/100069645633702', // Kulinarna Wiola
]

// Recipe web search only returns pages from these sites, so a query like
// "sernik" lands on recipe blogs rather than government nutrition pages or
// fitness portals. Blogs come from scripts/update-recipe-blog-domains.ts.
export const TRUSTED_RECIPE_DOMAINS: readonly string[] = [
  ...new Set([...RECIPE_PORTAL_DOMAINS, ...RECIPE_FACEBOOK_PROFILES, ...recipeBlogDomains]),
]
