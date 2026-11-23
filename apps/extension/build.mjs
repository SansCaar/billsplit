import * as esbuild from "esbuild";
import fs from "node:fs";
const watch = process.argv.includes("--watch");
fs.rmSync("dist", { recursive: true, force: true });
fs.mkdirSync("dist", { recursive: true });
fs.cpSync("public", "dist", { recursive: true });

// The Store build only reaches walmart.com and the hosted app (public/manifest.json).
// A build pointed elsewhere (APP_URL) gets that origin too, and DEV_HOSTS=1 adds every
// localhost port and *.vercel.app preview so the Processing tab's address can point at them.
const APP_URL = process.env.APP_URL || "https://bsplit.vercel.app";
const manifest = JSON.parse(fs.readFileSync("dist/manifest.json", "utf8"));
const app = new URL(APP_URL);
const extraHosts = [`${app.protocol}//${app.hostname}/*`]; // match patterns cover every port
if (process.env.DEV_HOSTS) extraHosts.push("http://localhost/*", "https://*.vercel.app/*");
for (const h of extraHosts) if (!manifest.host_permissions.includes(h)) manifest.host_permissions.push(h);
fs.writeFileSync("dist/manifest.json", JSON.stringify(manifest, null, 2) + "\n");

const opts = {
  entryPoints: { content: "src/content.ts", background: "src/background.ts", process: "src/process.tsx" },
  bundle: true, outdir: "dist", format: "iife", target: "chrome120", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', __APP_URL__: JSON.stringify(APP_URL) }, minify: false, sourcemap: false, logLevel: "info",
};
if (watch) { const ctx = await esbuild.context(opts); await ctx.watch(); } else await esbuild.build(opts);
