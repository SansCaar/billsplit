import Link from "next/link";
import { fmtMoney } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { groupSummary, listGroups } from "@/lib/services";
import { CreateGroupForm } from "@/components/CreateGroupForm";
import { Landing } from "@/components/landing/Landing";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: wantNew } = await searchParams;
  const actor = await currentActor();
  if (!actor) return <Landing />;
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
        <section className="card list-card home-col">
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
                      <div className="li-sub row" style={{ gap: 8 }}><span className="avatars hide-xs">{members.slice(0, 4).map((m) => <Avatar key={m.id} name={m.name} index={s.group.members.indexOf(m)} size={20} />)}</span><span className="ellipsis">{members.length} {members.length === 1 ? "person" : "people"} · {s.expenses.filter((e) => !e.deleted).length} expense{s.expenses.filter((e) => !e.deleted).length === 1 ? "" : "s"}</span></div>
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
      {groups.length === 0 ? (
        <section className="card home-col" id="new-group">
          <div className="card-head"><h2>Start your first group</h2></div>
          <p className="note" style={{ marginTop: -6, marginBottom: 16 }}>A group is everyone who shares costs: your apartment, a trip, a team.</p>
          <CreateGroupForm />
        </section>
      ) : (
        <details className="card home-col new-group" id="new-group" open={wantNew === "1"}>
          <summary><span className="plus" aria-hidden>+</span>Start a new group</summary>
          <div className="new-group-body"><CreateGroupForm /></div>
        </details>
      )}
    </main>
  );
}
