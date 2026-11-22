import { z } from "zod";
import { route } from "@/lib/api";
import { sendNudge } from "@/lib/services";
export const POST = route<{ groupId: string }>(async ({ db, actor, req, params }) =>
  sendNudge(db, actor, params.groupId, z.object({ toId: z.string(), line: z.number().int() }).parse(await req.json())),
);
