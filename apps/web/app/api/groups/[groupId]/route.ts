import { z } from "zod";
import { route, rulesSchema } from "@/lib/api";
import { groupSummary, updateGroupDefaults } from "@/lib/services";
type P = { groupId: string };
export const GET = route<P>(async ({ db, actor, params }) => groupSummary(db, actor, params.groupId));
export const PATCH = route<P>(async ({ db, actor, req, params }) => {
  const b = z.object({ splitRules: rulesSchema }).parse(await req.json());
  await updateGroupDefaults(db, actor, params.groupId, b.splitRules);
});
