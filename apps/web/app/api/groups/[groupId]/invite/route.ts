import { z } from "zod";
import { route } from "@/lib/api";
import { setInvite } from "@/lib/services";
export const POST = route<{ groupId: string }>(async ({ db, actor, req, params }) =>
  setInvite(db, actor, params.groupId, z.object({ enabled: z.boolean().optional(), regenerate: z.boolean().optional() }).parse(await req.json())));
