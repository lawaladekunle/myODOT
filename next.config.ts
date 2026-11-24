import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads the login cookie, so nothing benefits from Cache Components.
  output: "standalone",
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
