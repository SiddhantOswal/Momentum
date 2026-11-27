import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The sign-in page, served at /login, built as its own self-contained file next to index.html.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: '../public/site',
    target: 'es2022',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
    emptyOutDir: false,
    rollupOptions: { input: 'login.html' },
  },
});
