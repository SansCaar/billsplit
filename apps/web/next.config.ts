import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@billsplit/core", "@billsplit/assign-ui"],
  images: { remotePatterns: [{ protocol: "https", hostname: "i5.walmartimages.com" }] },
  // The service worker must never be served stale, or Notification fixes would take days to reach people.
  headers: async () => [
    { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
  ],
};
export default config;
