/**
 * Binds Polish one-letter words to the next word with a non-breaking space so they
 * are never left stranded at the end of a line ("sierotki"). The orphans are the
 * single-letter prepositions and conjunctions `a, i, o, u, w, z` (any case, so a
 * sentence-initial capital counts too).
 *
 * `bindOrphans('Syropy i napary') === 'Syropy i napary'` — the line can only
 * break after "Syropy", never leaving the "i" dangling. Idempotent: a space already
 * turned into U+00A0 stays a single U+00A0.
 *
 * Presentation-only: apply at render, never in stored data. A U+00A0 baked into a
 * category label would break the LLM-category matcher (`foldCategory` does not fold
 * NBSP → space) and leak into SEO titles and markdown.
 */
export function bindOrphans(text: string): string {
  // Lookbehind keeps the preceding boundary (start or whitespace) out of the match,
  // so chained orphans ("w i z") each bind; the lookahead skips a trailing letter.
  return text.replace(/(?<=^|\s)([aiouwzAIOUWZ])[ \t ]+(?=\S)/g, '$1 ')
}
