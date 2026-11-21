// Local dev: start a persistent local MongoDB (no Docker needed) unless MONGODB_URI is set, then run `next dev`.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const env = { ...process.env };
env.AUTH_SECRET ??= "dev-secret-change-me-dev-secret-change-me";
env.AUTH_TRUST_HOST ??= "true";
env.DEV_LOGIN ??= "1";
let mongo;
if (!env.MONGODB_URI) {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const dbPath = path.resolve(".data/mongo");
  fs.mkdirSync(dbPath, { recursive: true });
  mongo = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: "wiredTiger", port: Number(env.MONGO_PORT ?? 27027) } });
  env.MONGODB_URI = mongo.getUri("billsplit");
  console.log("Local MongoDB:", env.MONGODB_URI, "data in", dbPath);
}
const port = env.PORT ?? "3000";
const child = spawn("npx", ["next", "dev", "-p", port], { stdio: "inherit", env });
const stop = async () => { child.kill("SIGINT"); if (mongo) await mongo.stop({ doCleanup: false }); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", async (code) => { if (mongo) await mongo.stop({ doCleanup: false }); process.exit(code ?? 0); });
