import { defineConfig } from "@playwright/test";

// One smoke flow against the real stack: FastAPI serving the built React app
// from a freshly seeded throwaway database. Run with `pnpm e2e`.
const PORT = 8010;
const ENV = "DATABASE_URL=sqlite:///e2e.db ADMIN_PIN=admin-1234";

export default defineConfig({
  testDir: "e2e",
  reporter: "line", // terse output: cheap for humans and AI agents to read
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome", // uses the installed Chrome: no browser download
    trace: "retain-on-failure",
  },
  webServer: {
    command: `${ENV} uv run python -m app.seed && ${ENV} uv run uvicorn app.main:app --port ${PORT}`,
    cwd: "../backend",
    url: `http://localhost:${PORT}/api/teams`,
    reuseExistingServer: false,
  },
});
