import { z } from "zod";
import { route } from "@/lib/api";
import { createGroup, listGroups } from "@/lib/services";
export const GET = route(async ({ db, actor }) => listGroups(db, actor));
export const POST = route(async ({ db, actor, req }) => {
  const b = z.object({ name: z.string(), placeholderNames: z.array(z.string()).optional() }).parse(await req.json());
  return createGroup(db, actor, b);
});
