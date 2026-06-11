const POLISH_TO_ASCII: Record<string, string> = {
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l',
  'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => POLISH_TO_ASCII[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100)
}
