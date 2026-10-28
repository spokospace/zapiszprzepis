import type { RehypeMermaidOptions } from 'rehype-mermaid';

/**
 * Diagrams are drawn at build time by the Chromium that the repository's
 * Playwright already installed (`playwright` is pinned to the app's version in
 * `package.json`, so no second browser download is needed). Each diagram is
 * drawn twice, light and dark; `rehype-mermaid-theme.ts` picks one per theme.
 */
export const mermaidOptions: RehypeMermaidOptions = {
  strategy: 'img-svg',
  dark: true,
  mermaidConfig: { fontFamily: 'ui-sans-serif, system-ui, sans-serif' },
  // A diagram with a syntax error keeps its source on the page, with the
  // parser's message above it, instead of failing the build or vanishing.
  errorFallback: (_element, diagram, error) => ({
    type: 'element',
    tagName: 'pre',
    properties: { className: ['mermaid-error'] },
    children: [{ type: 'text', value: `Mermaid could not draw this diagram: ${String(error)}\n\n${diagram}` }],
  }),
};
