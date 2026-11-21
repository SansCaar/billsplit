import { z } from "zod";
import { assignmentsSchema, route, rulesSchema, splitSchema } from "@/lib/api";
import { getExpense, setExpenseDeleted, updateExpense } from "@/lib/services";
type P = { expenseId: string };
export const GET = route<P>(async ({ db, actor, params }) => getExpense(db, actor, params.expenseId));
export const PATCH = route<P>(async ({ db, actor, req, params }) => {
  const b = z.object({
    title: z.string().optional(), date: z.string().optional(), payerId: z.string().optional(), amount: z.number().int().positive().optional(),
    split: splitSchema.optional(), assignments: assignmentsSchema.optional(), rules: rulesSchema.optional(), deleted: z.boolean().optional(),
  }).parse(await req.json());
  if (typeof b.deleted === "boolean") return setExpenseDeleted(db, actor, params.expenseId, b.deleted);
  return updateExpense(db, actor, params.expenseId, b);
});
