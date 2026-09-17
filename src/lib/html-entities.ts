// Decode the HTML / XML character references that scraped markup carries —
// numeric (decimal and hex) and the named ones that actually turn up in
// captions and post text. Shared by the Facebook plugin parser and the
// YouTube timedtext reader; a full named-entity table is not needed.
export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Ampersand last, so "&amp;lt;" doesn't collapse into a tag.
    .replace(/&amp;/g, '&')
}
