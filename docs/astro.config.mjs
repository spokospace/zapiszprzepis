// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import rehypeMermaid from 'rehype-mermaid';
import { DOC_SOURCES, REPO_BRANCH, REPO_URL } from './src/lib/sources';
import { remarkRepoDocs } from './src/lib/remark-repo-docs';
import { rehypeMermaidTheme } from './src/lib/rehype-mermaid-theme';
import { mermaidOptions } from './src/lib/mermaid-options';

export default defineConfig({
  // Cloudflare Pages project `zapiszprzepis-docs` (README.md). Gives the
  // sitemap and canonical links their host.
  site: 'https://zapiszprzepis-docs.pages.dev',
  integrations: [
    starlight({
      title: 'ZapiszPrzepis docs',
      description: 'Foundation docs, specs and change plans of zapiszprzepis, rendered from the repository.',
      social: [{ icon: 'github', label: 'GitHub', href: REPO_URL }],
      // Used by the site's own pages only; the repository docs carry their
      // own `editUrl` to the real file (repo-docs-loader.ts).
      editLink: { baseUrl: `${REPO_URL}/edit/${REPO_BRANCH}/docs/` },
      // One group per source folder, pages sorted by file name (Starlight's
      // autogenerate order), so dated specs read oldest to newest.
      sidebar: DOC_SOURCES.map(({ label, prefix }) => ({
        label,
        collapsed: prefix !== 'foundation',
        items: [{ autogenerate: { directory: prefix } }],
      })),
      customCss: ['./src/styles/custom.css'],
      pagefind: true,
      lastUpdated: false,
    }),
  ],
  markdown: {
    // Astro 7 defaults to the Sätteri processor, which runs no remark/rehype
    // plugins; the unified one does.
    processor: unified({
      remarkPlugins: [remarkRepoDocs],
      rehypePlugins: [[rehypeMermaid, mermaidOptions], rehypeMermaidTheme],
    }),
  },
});
