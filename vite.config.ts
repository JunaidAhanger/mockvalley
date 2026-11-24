import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "offline.html"],
      manifest: {
        name: "MockValley — JKSSB GK & Current Affairs",
        short_name: "MockValley",
        description:
          "Mobile-first JKSSB practice app for J&K General Knowledge and Current Affairs.",
        theme_color: "#0f766e",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/offline\.html/],
        runtimeCaching: [
          {
            // Serve offline.html if a page request fails while offline
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages-cache",
              networkTimeoutSeconds: 4,
              plugins: [
                {
                  handlerDidError: async () => {
                    return (await caches.match("/offline.html")) || Response.error();
                  },
                },
              ],
            },
          },
        ],
      },
    }),
  ],
});