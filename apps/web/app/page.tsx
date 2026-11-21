import Link from "next/link";
import { redirect } from "next/navigation";
import { fmtMoney } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { groupSummary, listGroups } from "@/lib/services";
import { CreateGroupForm } from "@/components/CreateGroupForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actor = await currentActor();
  if (!actor) redirect("/signin");
  const db = await getDb();
  const groups = await listGroups(db, actor);
  const summaries = await Promise.all(groups.map((g) => groupSummary(db, actor, g._id)));
  const total = summaries.reduce((a, s) => a + (s.balances[s.me.id] ?? 0), 0);
  return (
    <main className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Hi, {actor.name.split(" ")[0]}</span>
          <h1 style={{ marginTop: 8 }}>Your groups</h1>
          <p className="sub">{groups.length ? <>Overall {total > 0 ? <>you're owed <b className="pos">{fmtMoney(total)}</b></> : total < 0 ? <>you owe <b className="neg">{fmtMoney(-total)}</b></> : "you're settled up"} across {groups.length} group{groups.length === 1 ? "" : "s"}.</> : "Create a group for your household to get started."}</p>
        </div>
      </header>
      {groups.length > 0 && (
        <section className="card list-card">
          <ul className="list">
            {summaries.map((s) => {
              const b = s.balances[s.me.id] ?? 0;
              const members = s.group.members.filter((m) => !m.leftAt);
              return (
                <li key={s.group._id}>
                  <Link href={`/g/${s.group._id}`} className="li">
                    <span className="tile">{s.group.name.trim()[0]?.toUpperCase()}</span>
                    <div className="grow">
                      <div className="li-title ellipsis">{s.group.name}</div>
                      <div className="li-sub row" style={{ gap: 8 }}><span className="avatars">{members.slice(0, 4).map((m) => <Avatar key={m.id} name={m.name} index={s.group.members.indexOf(m)} size={20} />)}</span>{members.length} housemates · {s.expenses.filter((e) => !e.deleted).length} expenses</div>
                    </div>
                    <div className="li-right">
                      {b === 0 ? <div className="cap">settled up</div> : <><div className={`amt ${b > 0 ? "pos" : "neg"}`}>{fmtMoney(Math.abs(b))}</div><div className="cap">{b > 0 ? "you're owed" : "you owe"}</div></>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section className="card" id="new-group" style={{ maxWidth: 560 }}>
        <div className="card-head"><h2>Start a new group</h2></div>
        <CreateGroupForm />
      </section>
    </main>
  );
}
