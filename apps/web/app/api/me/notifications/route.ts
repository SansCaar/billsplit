import { z } from "zod";
import { route } from "@/lib/api";
import { getNotifyPrefs, setDefaultNotifyLevel, setGroupNotifyLevel } from "@/lib/services";

const level = z.enum(["all", "involved"]);

export const GET = route(async ({ db, actor }) => getNotifyPrefs(db, actor));

/** `{ level }` changes my default; `{ groupId, level }` sets one Group (`null` = use my default). */
export const PATCH = route(async ({ db, actor, req }) => {
  const b = z.union([z.object({ groupId: z.string(), level: level.nullable() }), z.object({ level })]).parse(await req.json());
  return "groupId" in b ? setGroupNotifyLevel(db, actor, b.groupId, b.level) : setDefaultNotifyLevel(db, actor, b.level);
});
