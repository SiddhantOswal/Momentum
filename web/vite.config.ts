import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The built app is served by the Hono backend from public/app at "/".
// In development, API calls are proxied to the local backend, or to MOMENTUM_BACKEND when set
// (read-only previews against the live service).
const backend = process.env.MOMENTUM_BACKEND ?? "http://127.0.0.1:4173";
const apiPaths = ["/api", "/health", "/impact", "/conditions", "/jobs", "/orders", "/risk", "/evidence", "/insights", "/fx", "/job-sheets", "/samples", "/lots"];

export default defineConfig({
  base: "/app/",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../public/app", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: Object.fromEntries(apiPaths.map((path) => [path, { target: backend, changeOrigin: !backend.startsWith("http://127.0.0.1") }])),
  },
});
