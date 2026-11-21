import * as esbuild from "esbuild";
import fs from "node:fs";
const watch = process.argv.includes("--watch");
fs.rmSync("dist", { recursive: true, force: true });
fs.mkdirSync("dist", { recursive: true });
fs.cpSync("public", "dist", { recursive: true });
const opts = {
  entryPoints: { content: "src/content.ts", background: "src/background.ts", process: "src/process.tsx" },
  bundle: true, outdir: "dist", format: "iife", target: "chrome120", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', __APP_URL__: JSON.stringify(process.env.APP_URL || "https://bsplit.vercel.app") }, minify: false, sourcemap: false, logLevel: "info",
};
if (watch) { const ctx = await esbuild.context(opts); await ctx.watch(); } else await esbuild.build(opts);
