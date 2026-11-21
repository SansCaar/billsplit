import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@billsplit/core", "@billsplit/assign-ui"],
  images: { remotePatterns: [{ protocol: "https", hostname: "i5.walmartimages.com" }] },
};
export default config;
