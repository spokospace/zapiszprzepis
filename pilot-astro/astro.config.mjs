import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

const here = (path) => fileURLToPath(new URL(path, import.meta.url))

// Throwaway pilot: writes plain files into the Next app's public/ folder, so Workers Static
// Assets serve them at /pilot/{slug}/ without running the Worker. The recipe's real React
// components are hydrated as islands; only the Next-specific modules are replaced.
export default defineConfig({
  output: 'static',
  base: '/pilot',
  outDir: '../public/pilot',
  build: { assets: '_astro', inlineStylesheets: 'always' },
  integrations: [react()],
  vite: {
    server: { fs: { allow: ['..'] } },
    // Resolved from the repo root, so bundle it or it brings a second copy of React.
    ssr: { noExternal: ['lucide-react'] },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: [
        // The pilot's own copy: the repo root's would bring a second React.
        { find: 'lucide-react', replacement: here('./node_modules/lucide-react') },
        { find: 'next/image', replacement: here('./src/shims/next-image.tsx') },
        { find: 'next/link', replacement: here('./src/shims/next-link.tsx') },
        { find: 'next/navigation', replacement: here('./src/shims/next-navigation.ts') },
        { find: '@/app/favorites/actions', replacement: here('./src/shims/favorites-actions.ts') },
        { find: '@/app/(actions)/sign-out', replacement: here('./src/shims/sign-out.ts') },
        { find: '@/app/szukaj/actions', replacement: here('./src/shims/search-actions.ts') },
        { find: /^@\//, replacement: `${here('../src/')}` },
      ],
    },
  },
})
