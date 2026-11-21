import { cookies } from "next/headers";

const DEFAULT_TZ = "America/Chicago";
const valid = (tz: string) => { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } };

/** The viewer's timezone (set by the browser in a cookie), so server-rendered times match their clock. */
export async function viewerTz(): Promise<string> {
  const tz = (await cookies()).get("tz")?.value;
  return tz && valid(tz) ? tz : DEFAULT_TZ;
}

export function dayKey(d: Date | string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}
export function dayHeading(d: Date | string, tz: string, now = new Date()) {
  const k = dayKey(d, tz);
  if (k === dayKey(now, tz)) return "Today";
  if (k === dayKey(new Date(now.getTime() - 86_400_000), tz)) return "Yesterday";
  const sameYear = k.slice(0, 4) === dayKey(now, tz).slice(0, 4);
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(new Date(d));
}
export const timeOfDay = (d: Date | string, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(d));
