// Inlined rather than imported from ./facebook: sourceLabel runs in client
// components, and that module is the server-side scraper.
const FACEBOOK_HOST = /^(?:(?:www|m|web|mbasic|touch)\.)?facebook\.com$/

// Recipe authors who publish on a personal Facebook profile or Page rather
// than a blog, by numeric profile id. Their name is what tells their recipes
// apart from any other "Facebook" source, and recipe search looks in their
// posts too.
export const KNOWN_FACEBOOK_AUTHORS: Readonly<Record<string, string>> = {
  '100069645633702': 'Kulinarna Wiola',
  // Her earlier Page; Exa still indexes its posts under the same name.
  '553236358145414': 'Kulinarna Wiola',
}

/**
 * The numeric profile id a Facebook post link names: the first path segment
 * of /<id>/posts|videos|photos/… (the form toPostUrl stores), or the `id`
 * param of permalink.php / story.php / profile.php (recipes saved before
 * toPostUrl rewrote those links still carry them). Null for group posts,
 * reels, vanity names and anything that is not facebook.com.
 */
export function facebookProfileId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!FACEBOOK_HOST.test(parsed.hostname)) return null
    const fromPath = /^\/(\d+)(?:\/|$)/.exec(parsed.pathname)?.[1]
    if (fromPath) return fromPath
    if (!/^\/(?:permalink|story|profile)\.php$/.test(parsed.pathname)) return null
    const id = parsed.searchParams.get('id')
    return id && /^\d+$/.test(id) ? id : null
  } catch {
    return null
  }
}

/** The name of a known recipe author a Facebook link belongs to, or null. */
export function facebookAuthorName(url: string): string | null {
  const id = facebookProfileId(url)
  return id ? KNOWN_FACEBOOK_AUTHORS[id] ?? null : null
}

// First path segments that are Facebook's own routes, not a Page's name.
const FACEBOOK_ROUTES = new Set([
  'groups', 'watch', 'reel', 'reels', 'share', 'people', 'photo', 'photo.php',
  'permalink.php', 'story.php', 'profile.php', 'plugins',
])

/** True for a post on a Page with its own name in the address
 *  (facebook.com/SavoryDailyRecipes/posts/…) — a public publisher. */
function isNamedPagePost(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!FACEBOOK_HOST.test(parsed.hostname)) return false
    const segment = parsed.pathname.split('/')[1] ?? ''
    return segment !== '' && !/^\d+$/.test(segment) && !FACEBOOK_ROUTES.has(segment.toLowerCase())
  } catch {
    return false
  }
}

// Two or three capitalised words and nothing else: the shape of a person's
// first and last name ("Elżbieta Kacperek"), unlike a brand ("BeHealthy",
// "Proste przepisy", "Alex & Cris P").
const PERSON_NAME = /^(\p{Lu}[\p{L}'’-]*)(?:\s+\p{Lu}[\p{L}'’-]*)?\s+(\p{Lu})[\p{L}'’-]*$/u

/**
 * The poster's name as it may be stored and shown. A known recipe author or
 * a named Page publishes in public, so their full name stays. Anyone else —
 * a group member, a personal profile — is a private person: a full name is
 * cut to the first name and the last name's initial ("Elżbieta K."). When in
 * doubt it shortens, so a full name of a private person is never stored.
 */
export function publicFacebookAuthor(name: string, postUrl: string): string {
  if (facebookAuthorName(postUrl) || isNamedPagePost(postUrl)) return name
  const person = PERSON_NAME.exec(name.trim())
  return person ? `${person[1]} ${person[2]}.` : name
}
