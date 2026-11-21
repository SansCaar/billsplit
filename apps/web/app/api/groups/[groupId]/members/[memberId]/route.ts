import { route } from "@/lib/api";
import { removeMember } from "@/lib/services";
export const DELETE = route<{ groupId: string; memberId: string }>(async ({ db, actor, params }) => removeMember(db, actor, params.groupId, params.memberId));
