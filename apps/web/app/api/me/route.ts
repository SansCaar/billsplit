import { route } from "@/lib/api";
import { listGroups } from "@/lib/services";
/** Used by the extension: who am I, and which Groups/Members can I process into. */
export const GET = route(async ({ db, actor }) => {
  const groups = await listGroups(db, actor);
  return {
    user: actor,
    groups: groups.map((g) => ({
      id: g._id, name: g.name, defaults: g.defaults,
      me: g.members.find((m) => m.userId === actor.userId)?.id,
      members: g.members.filter((m) => !m.leftAt).map((m) => ({ id: m.id, name: m.name })),
    })),
  };
});
