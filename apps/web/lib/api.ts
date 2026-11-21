import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "./db";
import { requireActor } from "./session";
import { ServiceError } from "./services";
import type { Actor } from "./model";
import type { Db } from "mongodb";

type Ctx<P> = { params: Promise<P> };

/** Wrap a route handler: auth, db, JSON errors. */
export function route<P = Record<string, string>>(fn: (a: { db: Db; actor: Actor; req: Request; params: P }) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const actor = await requireActor();
      const db = await getDb();
      const out = await fn({ db, actor, req, params: await ctx.params });
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request", issues: e.issues }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

const cents = z.number().int();
export const shareSchema = z.object({ memberId: z.string().min(1), parts: z.number().positive().optional(), amount: cents.nonnegative().optional() });
export const splitSchema = z.object({ method: z.enum(["equal", "parts", "amount"]), shares: z.array(shareSchema) });
export const rulesSchema = z.object({ tax: z.enum(["proportional", "equal"]), fees: z.enum(["equal", "proportional"]) });
export const assignmentsSchema = z.record(z.string(), splitSchema);
export const parsedOrderSchema = z.object({
  orderNumber: z.string().regex(/^\d{6,}$/),
  placedAt: z.string().nullable(),
  sourceUrl: z.string(),
  fulfillments: z.array(z.object({ id: z.string(), label: z.string(), kind: z.enum(["shipping", "delivery", "pickup", "other"]) })),
  items: z.array(z.object({
    key: z.string().min(1), name: z.string(), imageUrl: z.string().optional(), quantity: z.number(), amount: cents.nonnegative(),
    fulfillmentId: z.string().nullable(), status: z.enum(["ok", "refunded", "unavailable", "substituted"]), substitutedFor: z.string().optional(),
  })).max(500),
  fees: z.array(z.object({ key: z.string(), label: z.string(), kind: z.enum(["delivery", "shipping", "tip", "bag", "discount", "other"]), amount: cents, fulfillmentId: z.string().nullable() })),
  subtotal: cents.nullable(),
  tax: cents.nonnegative(),
  total: cents.nullable(),
  paymentCards: z.array(z.object({ brand: z.string(), last4: z.string() })),
  warnings: z.array(z.string()),
});
