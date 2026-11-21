import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  timeout: 180_000,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "../proof/e2e-report", open: "never" }]],
  use: { trace: "retain-on-failure", viewport: { width: 1280, height: 860 } },
  outputDir: "../test-results",
});
