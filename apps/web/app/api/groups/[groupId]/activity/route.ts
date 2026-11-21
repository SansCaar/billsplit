import { route } from "@/lib/api";
import { listActivity } from "@/lib/services";
export const GET = route<{ groupId: string }>(async ({ db, actor, req, params }) => {
  const u = new URL(req.url);
  return listActivity(db, actor, params.groupId, { expenseId: u.searchParams.get("expenseId") ?? undefined });
});
