import { z } from "zod";
import { route } from "@/lib/api";
import { recordSettlement } from "@/lib/services";
export const POST = route<{ groupId: string }>(async ({ db, actor, req, params }) => {
  const b = z.object({ fromId: z.string(), toId: z.string(), amount: z.number().int().positive(), date: z.string().optional(), note: z.string().optional() }).parse(await req.json());
  return recordSettlement(db, actor, params.groupId, b);
});
