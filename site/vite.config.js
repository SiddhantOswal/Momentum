import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The landing page as one self-contained file in public/site, served at /. JS, CSS and fonts are inlined.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: '../public/site',
    target: 'es2022',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
  },
});
