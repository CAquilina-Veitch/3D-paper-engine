import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// On GitHub Pages the app is served from /<repo>/, so the CI build sets
// BASE_PATH; local dev and other hosts default to root.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  worker: { format: "es" },
  server: { port: 5173 },
});
