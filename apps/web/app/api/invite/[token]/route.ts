import { z } from "zod";
import { route } from "@/lib/api";
import { joinGroup } from "@/lib/services";
export const POST = route<{ token: string }>(async ({ db, actor, req, params }) => {
  const b = z.object({ claimMemberId: z.string().optional() }).parse(await req.json().catch(() => ({})));
  const g = await joinGroup(db, actor, params.token, b.claimMemberId);
  return { groupId: g._id };
});
