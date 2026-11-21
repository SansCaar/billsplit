import { z } from "zod";
import { assignmentsSchema, parsedOrderSchema, route, rulesSchema } from "@/lib/api";
import { processOrder } from "@/lib/services";
export const POST = route<{ groupId: string }>(async ({ db, actor, req, params }) => {
  const b = z.object({ order: parsedOrderSchema, assignments: assignmentsSchema, rules: rulesSchema, payerId: z.string(), title: z.string().optional() }).parse(await req.json());
  const r = await processOrder(db, actor, params.groupId, b);
  return { expenseId: r.expense._id, created: r.created, url: `/e/${r.expense._id}` };
});
