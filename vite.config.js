import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // In dev, Vite serves the UI on :5173 and forwards /api to the
    // Express backend on :3001 so you never hardcode the key in the browser.
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
