import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const API = "http://localhost:8000";

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/, so the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": API, "/photos": API } },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
