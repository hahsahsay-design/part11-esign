import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Integration tests hit the real dev server + real embedded Postgres
    // sequentially — they create/delete their own throwaway orgs, but
    // running them in parallel workers would make audit-chain sequence
    // numbers and account-lockout counters race against each other.
    fileParallelism: false,
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "server-only": path.resolve(import.meta.dirname, "./tests/stubs/server-only.ts"),
    },
  },
});
