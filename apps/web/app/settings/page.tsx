import { redirect } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { getNotifyPrefs } from "@/lib/services";
import { NotificationSettings } from "@/components/NotificationSettings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Bill Split" };

export default async function SettingsPage() {
  const actor = await currentActor();
  if (!actor) redirect("/signin?callbackUrl=/settings");
  const prefs = await getNotifyPrefs(await getDb(), actor);
  return (
    <main className="page">
      <nav className="crumb" aria-label="Breadcrumb"><Link href="/">← Your groups</Link></nav>
      <header className="page-head"><div><h1>Settings</h1></div></header>
      <NotificationSettings prefs={prefs} />
    </main>
  );
}
