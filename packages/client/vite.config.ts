import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

/** Stub for virtual:pwa-register when the real PWA plugin is skipped (e.g. Termux). */
function pwaStub(): Plugin {
  const id = "virtual:pwa-register";
  const resolved = "\0" + id;
  return {
    name: "pwa-stub",
    resolveId(source) {
      if (source === id) return resolved;
    },
    load(loadedId) {
      if (loadedId === resolved) return "export function registerSW() { return () => {}; }";
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    !process.env.SKIP_PWA
      ? VitePWA({
          injectRegister: false,
          registerType: "autoUpdate",
          devOptions: { enabled: false },
          manifest: false, // We use the static manifest.json in public/
          workbox: {
            globPatterns: ["**/*.{js,css,png,svg,ico,woff2}"],
            navigateFallbackAllowlist: [],
            runtimeCaching: [
              {
                urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/"),
                handler: "NetworkFirst",
                options: { cacheName: "api-cache", expiration: { maxEntries: 50 } },
              },
            ],
          },
        })
      : pwaStub(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.PORT ?? 7860}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  esbuild: {
    // Strip debug console.log in production; keep warn/error
    pure: process.env.NODE_ENV === "production" ? ["console.log"] : [],
  },
});
