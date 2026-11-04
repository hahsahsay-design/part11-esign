import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every route in this app is session- and tenant-scoped (auth cookie +
  // per-organization DB reads), so there is nothing here that should be
  // statically cached or prerendered — disable Cache Components rather than
  // annotating every page with "use cache"/force-dynamic.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
