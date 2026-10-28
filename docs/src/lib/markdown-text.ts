/** Plain-text helpers shared by the loader and the remark plugin. */

/** Index of the `\n---` that closes a leading frontmatter block, or -1 when there is none. */
export function frontmatterEnd(text: string): number {
  return text.startsWith('---') ? text.indexOf('\n---', 3) : -1;
}

/** The text after a leading frontmatter block (the whole text when there is none). */
export function stripFrontmatter(text: string): string {
  const end = frontmatterEnd(text);
  return end === -1 ? text : text.slice(text.indexOf('\n', end + 1) + 1);
}

/**
 * `**Bold** [link](url) \`code\`` -> `Bold link code`. The loader turns a
 * heading into a title with it and the remark plugin compares headings to that
 * title, so both must produce the same string.
 */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

/** A string with something in it, trimmed; otherwise `undefined`. */
export function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
