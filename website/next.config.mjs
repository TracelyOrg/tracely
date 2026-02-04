import { createMDX } from "fumadocs-mdx/next";

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      "fumadocs-mdx:collections/server": "./.source/server.ts",
      "fumadocs-mdx:collections/browser": "./.source/browser.ts",
      "fumadocs-mdx:collections/dynamic": "./.source/dynamic.ts",
    },
  },
};

const withMDX = createMDX();

export default withMDX(config);
