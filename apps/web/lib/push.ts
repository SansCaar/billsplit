/** Delivers Notifications to devices through the browsers' push services (Web Push + VAPID). */
import type { Db } from "mongodb";
import { sendNotification, setVapidDetails } from "web-push";
import type { Outgoing } from "./notify";
import { cols } from "./services";

let configured: boolean | undefined;

export function pushConfigured(): boolean {
  if (configured !== undefined) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.warn("Push notifications are off: NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set");
    return (configured = false);
  }
  setVapidDetails(process.env.VAPID_SUBJECT || "https://bsplit.vercel.app", pub, priv);
  return (configured = true);
}

/** Send each message to every device its person has turned on. Devices the push service says are gone are removed. */
export async function deliverPush(db: Db, out: Outgoing[]): Promise<number> {
  if (!out.length || !pushConfigured()) return 0;
  const devices = await cols(db).pushDevices.find({ userId: { $in: [...new Set(out.map((o) => o.userId))] } }).toArray();
  let sent = 0;
  await Promise.allSettled(
    out.flatMap((o) =>
      devices
        .filter((d) => d.userId === o.userId)
        .map(async (d) => {
          try {
            await sendNotification({ endpoint: d.endpoint, keys: d.keys }, JSON.stringify(o.message), { TTL: 60 * 60 * 24, topic: topicFor(o.message.tag) });
            sent++;
          } catch (e) {
            const err = e as { statusCode?: number; body?: string; message?: string };
            if (err.statusCode === 404 || err.statusCode === 410) {
              console.warn(`Push device gone (${err.statusCode}), removing it: ${err.body ?? ""}`.trim());
              await cols(db).pushDevices.deleteOne({ _id: d._id });
            } else console.error("Push failed", err.statusCode ?? "", err.body ?? err.message ?? e);
          }
        }),
    ),
  );
  return sent;
}

/** Push services collapse undelivered messages with the same Topic (max 32 URL-safe chars). */
function topicFor(tag: string): string {
  return tag.replace(/[^A-Za-z0-9_-]/g, "").slice(-32);
}
