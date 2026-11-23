import { z } from "zod";
import { route } from "@/lib/api";
import { removePushDevice, savePushDevice } from "@/lib/services";

const sub = z.object({ endpoint: z.string().url().max(2000), keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }) });

/** This device turned notifications on. */
export const POST = route(async ({ db, actor, req }) => {
  await savePushDevice(db, actor, sub.parse(await req.json()), req.headers.get("user-agent"));
});

/** This device turned notifications off. */
export const DELETE = route(async ({ db, actor, req }) => {
  await removePushDevice(db, actor, z.object({ endpoint: z.string() }).parse(await req.json()).endpoint);
});
