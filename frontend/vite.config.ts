import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const API = "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": API, "/photos": API } },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
