import { defineConfig } from 'astro/config'

// Throwaway pilot: writes plain files into the Next app's public/ folder, so Workers Static
// Assets serve them at /pilot/{slug}/ without running the Worker.
export default defineConfig({
  output: 'static',
  base: '/pilot',
  outDir: '../public/pilot',
  build: { assets: '_astro', inlineStylesheets: 'always' },
})
