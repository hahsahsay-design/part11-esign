import "dotenv/config";

// Integration tests (tests/integration/*) talk to the real dev server over
// HTTP — start it first (npm run dev) and seed the database (npm run
// db:seed) before running `npm test`. Unit tests (tests/unit/*) need no
// server, only the env vars loaded above (MFA_ENCRYPTION_KEY,
// AUDIT_SIGNING_KEY, DOCUMENT_SIGNING_KEY, DATABASE_URL).
export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
