import { route } from "@/lib/api";
import { sendTestNotification } from "@/lib/services";
export const POST = route(async ({ db, actor }) => sendTestNotification(db, actor));
