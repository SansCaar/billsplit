import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { listGroups } from "@/lib/services";
import { CreateGroupForm } from "@/components/CreateGroupForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actor = await currentActor();
  if (!actor) redirect("/signin");
  const groups = await listGroups(await getDb(), actor);
  return (
    <main className="page">
      <h1>Your groups</h1>
      <div className="grid">
        <div className="panel">
          {groups.length === 0 ? <p className="mute">No groups yet. Create one for your household →</p> : (
            <ul className="list">
              {groups.map((g) => (
                <li key={g._id}>
                  <Link href={`/g/${g._id}`} className="row between" style={{ color: "inherit" }}>
                    <b>{g.name}</b>
                    <span className="mute small">{g.members.filter((m) => !m.leftAt).length} members</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel"><h2>New group</h2><CreateGroupForm /></div>
      </div>
    </main>
  );
}
