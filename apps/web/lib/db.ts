import { MongoClient, type Db } from "mongodb";
import { ensureIndexes } from "./services";

const g = globalThis as unknown as { _bsMongo?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g._bsMongo) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    g._bsMongo = MongoClient.connect(uri).then(async (c) => {
      const db = c.db(process.env.MONGODB_DB || undefined);
      await ensureIndexes(db);
      return db;
    });
  }
  return g._bsMongo;
}
