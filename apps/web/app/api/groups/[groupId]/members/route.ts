import { z } from "zod";
import { route } from "@/lib/api";
import { addPlaceholderMember } from "@/lib/services";
export const POST = route<{ groupId: string }>(async ({ db, actor, req, params }) =>
  addPlaceholderMember(db, actor, params.groupId, z.object({ name: z.string() }).parse(await req.json()).name));
