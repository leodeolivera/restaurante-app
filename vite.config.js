import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/restaurante-app/",

  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true },
      manifest: {
        // ...
      },
    }),
  ],

  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
});