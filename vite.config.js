import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      // libera o PWA em dev/preview (pra aparecer "Instalar app" no celular)
      devOptions: {
        enabled: true,
      },

      manifest: {
        name: "Sistema Restaurante",
        short_name: "Restaurante",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#000000",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],

  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
});