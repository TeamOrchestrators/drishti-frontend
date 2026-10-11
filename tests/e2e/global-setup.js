/* global process */
import {spawnSync} from "node:child_process";
import path from "node:path";

function run(command, args, options) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `E2E database setup failed while running ${path.basename(command)}.` +
        (details ? `\n${details}` : ""),
      {cause: result.error},
    );
  }
}

export default async function globalSetup() {
  const databaseUrl = process.env.E2E_DB_URL;
  const backendDir = process.env.E2E_BACKEND_DIR;
  const parsedUrl = new URL(databaseUrl);

  if (parsedUrl.pathname !== "/drishti_test") {
    throw new Error(
      `Refusing to reset ${parsedUrl.pathname || "an unnamed database"}; E2E requires drishti_test.`,
    );
  }

  run(process.env.E2E_GOOSE_BIN || "goose", ["-dir", "sql/migrations", "up"], {
    cwd: backendDir,
    env: {
      ...process.env,
      GOOSE_DRIVER: "postgres",
      GOOSE_DBSTRING: databaseUrl,
    },
  });

  run(
    process.env.E2E_PSQL_BIN || "psql",
    [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", "sql/seeds/002_full_demo_reset.sql"],
    {cwd: backendDir, env: process.env},
  );
}
