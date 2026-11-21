import { z } from "zod";
import { route, splitSchema } from "@/lib/api";
import { createManualExpense } from "@/lib/services";
export const POST = route<{ groupId: string }>(async ({ db, actor, req, params }) => {
  const b = z.object({ title: z.string(), date: z.string().optional(), amount: z.number().int().positive(), payerId: z.string(), split: splitSchema }).parse(await req.json());
  return createManualExpense(db, actor, params.groupId, b);
});
