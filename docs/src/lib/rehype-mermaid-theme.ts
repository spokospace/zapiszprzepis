import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';

/**
 * `rehype-mermaid` with `strategy: 'img-svg', dark: true` emits
 * `<picture><source media="(prefers-color-scheme: dark)" srcset=…><img src=…></picture>`,
 * which follows the OS setting, not Starlight's theme toggle. This turns each
 * picture into two images that `custom.css` shows or hides by `data-theme`.
 * Should rehype-mermaid change that shape, the picture is left as it is and
 * still works, following the OS theme.
 */
export function rehypeMermaidTheme() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'picture' || !parent || index === undefined) return;
      const child = (tag: string) =>
        node.children.find((c): c is Element => c.type === 'element' && c.tagName === tag);
      const img = child('img');
      // rehype-mermaid builds this node by hand, with the raw `srcset` name.
      const dark = child('source')?.properties?.srcset;
      if (!img || typeof dark !== 'string') return;

      const variant = (className: string, src = img.properties.src): Element => ({
        ...img,
        properties: { ...img.properties, src, className: [className] },
      });
      parent.children[index] = {
        type: 'element',
        tagName: 'figure',
        // Focusable because it may scroll sideways (see custom.css).
        properties: { className: ['mermaid-figure'], tabIndex: 0, ariaLabel: 'Diagram' },
        children: [variant('mermaid-light'), variant('mermaid-dark', dark)],
      };
    });
  };
}
