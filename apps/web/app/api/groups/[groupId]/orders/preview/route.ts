import { z } from "zod";
import { parsedOrderSchema, route } from "@/lib/api";
import { previewReprocess } from "@/lib/services";
/** Before Processing: does this Order exist already? If so, what will change, and the carried-over Assignments. */
export const POST = route<{ groupId: string }>(async ({ db, actor, req, params }) =>
  previewReprocess(db, actor, params.groupId, z.object({ order: parsedOrderSchema }).parse(await req.json()).order));
