import Link from "next/link";
import { redirect } from "next/navigation";
import { fmtMoney } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { groupSummary, listGroups } from "@/lib/services";
import { balanceText } from "@/lib/format";
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
      {groups.length > 0 && (
        <section className="card hero">
          <div className="label">{total > 0 ? "Overall, you're owed" : total < 0 ? "Overall, you owe" : "You're all settled up"}</div>
          {total !== 0 && <div className="big">{fmtMoney(Math.abs(total))}</div>}
          <div className="sub">across {groups.length} group{groups.length === 1 ? "" : "s"}</div>
        </section>
      )}
      <div className="section-title">Your groups</div>
      {groups.length === 0 ? (
        <section className="card empty"><div className="big">🏠</div><p><b>No groups yet</b></p><p className="small">Create one for your household below.</p></section>
      ) : (
        <section className="card flush">
          <ul className="list">
            {summaries.map((s) => {
              const b = s.balances[s.me.id] ?? 0;
              const t = balanceText(b);
              const members = s.group.members.filter((m) => !m.leftAt);
              return (
                <li key={s.group._id}>
                  <Link href={`/g/${s.group._id}`} className="item-row">
                    <span className="avatars">{members.slice(0, 3).map((m) => <Avatar key={m.id} name={m.name} index={s.group.members.indexOf(m)} size={30} />)}</span>
                    <div className="grow">
                      <div className="row-title ellipsis">{s.group.name}</div>
                      <div className="row-sub">{members.length} members · {s.expenses.filter((e) => !e.deleted).length} expenses</div>
                    </div>
                    <div className="row-right">
                      <div className={`k ${t.cls}`}>{b > 0 ? "you get" : b < 0 ? "you owe" : "settled"}</div>
                      {b !== 0 && <div className={`amt ${t.cls}`}>{fmtMoney(Math.abs(b))}</div>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="section-title">New group</div>
      <section className="card"><CreateGroupForm /></section>
    </main>
  );
}
