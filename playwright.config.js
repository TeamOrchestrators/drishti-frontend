/* global process */
import {defineConfig, devices} from "@playwright/test";
import dotenv from "dotenv";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(frontendDir, "../drishti-backend");

dotenv.config({path: path.join(frontendDir, ".env.e2e.local"), quiet: true});

function resolveTestDatabaseUrl() {
  let candidate = process.env.E2E_DB_URL;

  if (!candidate) {
    const backendEnvPath = path.join(backendDir, ".env");
    if (!fs.existsSync(backendEnvPath)) {
      throw new Error(
        "E2E_DB_URL is required when the sibling drishti-backend/.env file is unavailable.",
      );
    }

    const backendEnv = dotenv.parse(fs.readFileSync(backendEnvPath));
    candidate = backendEnv.DB_URL;
  }

  if (!candidate) {
    throw new Error("Set E2E_DB_URL to the dedicated drishti_test PostgreSQL database.");
  }

  const url = new URL(candidate);
  url.pathname = "/drishti_test";
  if (url.pathname !== "/drishti_test") {
    throw new Error("Playwright may only reset the drishti_test database.");
  }
  return url.toString();
}

function firstExistingPath(candidates, fallback) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || fallback;
}

const testDatabaseUrl = resolveTestDatabaseUrl();
const backendUrl = "http://127.0.0.1:18080";
const frontendUrl = "http://127.0.0.1:15173";

process.env.E2E_DB_URL = testDatabaseUrl;
process.env.E2E_BACKEND_DIR = backendDir;
process.env.E2E_PSQL_BIN = process.env.E2E_PSQL_BIN || firstExistingPath(
  process.platform === "win32"
    ? [
        "C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe",
        "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe",
        "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe",
      ]
    : [],
  "psql",
);
process.env.E2E_GOOSE_BIN = process.env.E2E_GOOSE_BIN || firstExistingPath(
  process.platform === "win32"
    ? [path.join(os.homedir(), "go", "bin", "goose.exe")]
    : [],
  "goose",
);

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.js",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", {open: "never"}]],
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    {
      name: "chromium",
      use: {...devices["Desktop Chrome"]},
    },
  ],
  webServer: [
    {
      command: "go run .",
      cwd: backendDir,
      url: `${backendUrl}/healthz`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        DB_URL: testDatabaseUrl,
        PORT: "18080",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm exec vite --host 127.0.0.1 --port 15173 --strictPort",
      cwd: frontendDir,
      url: frontendUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_API_URL: backendUrl,
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
