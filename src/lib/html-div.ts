/**
 * Return the substring of `html` that sits inside the div opened at
 * `openTagEnd`, by counting nested <div> tags. Regex alone can't do this —
 * post bodies contain their own nested divs, and class names on the closing
 * side (obfuscated on Facebook, template-specific on blogs) are no anchor.
 */
export function sliceBalancedDiv(html: string, openTagEnd: number): string {
  const TAG = /<(\/?)div\b/gi
  TAG.lastIndex = openTagEnd
  let depth = 1
  let match: RegExpExecArray | null
  while ((match = TAG.exec(html)) !== null) {
    depth += match[1] === '/' ? -1 : 1
    if (depth === 0) return html.slice(openTagEnd, match.index)
  }
  // Unbalanced markup — take what's left rather than dropping the content.
  return html.slice(openTagEnd)
}
