import path from 'node:path';
import type { Root, Code, Image, Link } from 'mdast';
import type { VFile } from 'vfile';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';
import { githubUrlForFile, routeForFile, virtualPathForFile } from './sources';
import { nonEmpty, stripInlineMarkdown } from './markdown-text';

type AstroVFile = VFile & {
  data: { astro?: { frontmatter?: Record<string, unknown> } };
};

/**
 * Three small adjustments that let the repository's Markdown render under
 * Starlight without touching the files:
 *
 * - The leading `# Heading` is dropped when it is what the page title came
 *   from (Starlight prints the title as the page's `<h1>` itself).
 * - ```mermaid fences become `<pre class="mermaid">` before Expressive Code
 *   sees them, so `rehype-mermaid` can render them at build time instead of
 *   Expressive Code painting them as a code frame.
 * - Relative links to other Markdown files resolve to the page that renders
 *   them, or to the file on GitHub when the site does not render it.
 * - Relative images keep working although the entry is stored under a
 *   virtual path.
 */
export function remarkRepoDocs() {
  return (tree: Root, file: AstroVFile) => {
    dropTitleHeading(tree, file);
    visit(tree, 'code', (node: Code) => {
      if (node.lang !== 'mermaid') return;
      // A real `<pre class="mermaid">` element (not raw HTML, which rehype
      // plugins cannot see), with no `<code>` inside for Expressive Code to claim.
      node.data = {
        hName: 'pre',
        hProperties: { className: ['mermaid'] },
        hChildren: [{ type: 'text', value: node.value }],
      };
    });
    if (!file.path) return;
    const dir = path.dirname(file.path);
    visit(tree, 'link', (node: Link) => {
      node.url = resolveDocLink(node.url, dir);
    });
    // Astro resolves a relative image against the entry's stored filePath,
    // which for repository docs is virtual (repo-docs-loader.ts). Point each
    // one at the real file from there.
    const virtualPath = virtualPathForFile(file.path);
    if (!virtualPath) return;
    visit(tree, 'image', (node: Image) => {
      const match = RELATIVE.exec(node.url);
      if (!match) return;
      const target = path.resolve(dir, decodeURI(match[1]));
      node.url = path.relative(path.dirname(virtualPath), target).split(path.sep).join('/');
    });
  };
}

function dropTitleHeading(tree: Root, file: AstroVFile): void {
  const index = tree.children.findIndex((node) => node.type !== 'yaml');
  const first = tree.children[index];
  if (first?.type !== 'heading' || first.depth !== 1) return;
  const title = nonEmpty(file.data.astro?.frontmatter?.title);
  // A title that differs from the H1 came from frontmatter, so the H1 is content.
  if (title && title !== stripInlineMarkdown(toString(first))) return;
  tree.children.splice(index, 1);
}

/** A relative path (no scheme, not root-absolute, not a bare `#anchor`). */
const RELATIVE = /^(?![a-z][a-z0-9+.-]*:)(?!\/)(?!#)([^#?]+)([?#].*)?$/i;

/**
 * `other.md#x` -> `/foundation/other/#x` when the site renders that file;
 * any other repository file (`../../src/lib/x.ts`) -> its GitHub page, since
 * the relative path means nothing under the site's routes.
 */
function resolveDocLink(url: string, fromDir: string): string {
  const match = RELATIVE.exec(url);
  if (!match) return url;
  const [, target, suffix = ''] = match;
  let absolute: string;
  try {
    absolute = path.resolve(fromDir, decodeURI(target));
  } catch {
    return url;
  }
  const route = routeForFile(absolute);
  if (route) return route + (suffix.startsWith('#') ? suffix : '');
  const github = githubUrlForFile(absolute);
  return github ? github + suffix : url;
}
