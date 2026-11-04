// Local development database runner.
//
// Production deployments point DATABASE_URL at a managed Postgres instance
// (e.g. AWS RDS) — see docs/deployment.md. This script exists only so the
// app can be developed and tested on a machine with no system Postgres
// install: it boots a real, on-disk Postgres cluster using prebuilt
// `embedded-postgres` binaries, with no compiler or package manager required.
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 55432;
const USER = "part11";
const PASSWORD = "part11dev";
const DB_NAME = "part11_esign";
const DATA_DIR = path.join(__dirname, "..", ".devdb");

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
  autoRehydrateSymlinks: true,
});

const command = process.argv[2] ?? "start";

async function ensureStarted() {
  // The data directory may already hold an initialized cluster — e.g. after
  // this project folder was copied/moved. Only run initdb on a fresh dir,
  // and clear a stale postmaster.pid left behind by a copy made while
  // Postgres was running (the PID it names belongs to a different process
  // tree and would otherwise make startup think a server is already up).
  if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    await pg.initialise();
  } else {
    const stalePidFile = path.join(DATA_DIR, "postmaster.pid");
    if (existsSync(stalePidFile)) rmSync(stalePidFile);
  }
  await pg.start();
  try {
    await pg.createDatabase(DB_NAME);
  } catch {
    // already exists
  }
}

if (command === "start") {
  await ensureStarted();
  console.log(`Postgres is running on 127.0.0.1:${PORT}, database "${DB_NAME}".`);
  console.log(`DATABASE_URL="postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB_NAME}?schema=public"`);
  // Keep the process alive so this can be run as a background dev-db server.
  process.on("SIGINT", async () => {
    await pg.stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await pg.stop();
    process.exit(0);
  });
} else if (command === "stop") {
  await pg.stop();
  console.log("Postgres stopped.");
} else {
  console.error(`Unknown command: ${command}. Use "start" or "stop".`);
  process.exit(1);
}
