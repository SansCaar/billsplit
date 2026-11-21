import { z } from "zod";
import { route } from "@/lib/api";
import { setSettlementDeleted } from "@/lib/services";
export const PATCH = route<{ settlementId: string }>(async ({ db, actor, req, params }) =>
  setSettlementDeleted(db, actor, params.settlementId, z.object({ deleted: z.boolean() }).parse(await req.json()).deleted));
