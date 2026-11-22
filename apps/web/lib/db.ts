import { MongoClient, type Db } from "mongodb";
import { after } from "next/server";
import { ensureIndexes, notifier } from "./services";
import { deliverPush } from "./push";

const g = globalThis as unknown as { _bsMongo?: Promise<Db> };

// Notifications go out after the response is sent, so a slow or failing push never holds up a save.
notifier.deliver = deliverPush;
notifier.defer = (task) => {
  try {
    after(task);
  } catch {
    void task(); // outside a request (scripts)
  }
};

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
