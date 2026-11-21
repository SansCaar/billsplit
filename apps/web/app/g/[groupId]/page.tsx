import Link from "next/link";
import { redirect } from "next/navigation";
import { fmtMoney } from "@billsplit/core";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { groupSummary } from "@/lib/services";
import { fmtDate, plain } from "@/lib/plain";
import { ActivityList } from "@/components/ActivityList";
import { GroupSide } from "@/components/GroupSide";
import { Avatar } from "@billsplit/assign-ui";

export const dynamic = "force-dynamic";

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const actor = await currentActor();
  if (!actor) redirect(`/signin?callbackUrl=/g/${groupId}`);
  const s = plain(await groupSummary(await getDb(), actor, groupId));
  const members = s.group.members.filter((m) => !m.leftAt);
  const idx = (id: string) => s.group.members.findIndex((m) => m.id === id);
  const name = (id: string) => s.group.members.find((m) => m.id === id)?.name ?? "?";
  const feed = [
    ...s.expenses.map((e) => ({ kind: "e" as const, date: e.date, e })),
    ...s.settlements.map((x) => ({ kind: "s" as const, date: x.date, x })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <main className="page">
      <div className="row between wrap">
        <h1 data-testid="group-name">{s.group.name}</h1>
        <Link className="btn primary" href={`/g/${groupId}/new`}>+ Add expense</Link>
      </div>
      <div className="grid">
        <div>
          <section className="panel">
            <h2>Expenses</h2>
            {feed.length === 0 && <p className="mute">Nothing yet. Add an expense, or process a Walmart order from the extension.</p>}
            <ul className="list" data-testid="expenses">
              {feed.map((f) => f.kind === "e" ? (
                <li key={f.e._id} className={f.e.deleted ? "deleted" : ""}>
                  <Link href={`/e/${f.e._id}`} className="exp">
                    <span className="icon">{f.e.kind === "walmart" ? "🛒" : "🧾"}</span>
                    <span>
                      <div className="t">{f.e.title}</div>
                      <div className="mute small">{fmtDate(f.e.date)} · paid by {name(f.e.payerId)}{f.e.deleted ? " · deleted" : ""}</div>
                    </span>
                    <span className="amt">{fmtMoney(f.e.amount)}</span>
                  </Link>
                </li>
              ) : (
                <li key={f.x._id} className={f.x.deleted ? "deleted" : ""}>
                  <div className="exp">
                    <span className="icon">💸</span>
                    <span><div className="t">{name(f.x.fromId)} paid {name(f.x.toId)}</div><div className="mute small">{fmtDate(f.x.date)}{f.x.note ? ` · ${f.x.note}` : ""}</div></span>
                    <span className="amt">{fmtMoney(f.x.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2>Activity</h2>
            <ActivityList items={s.activity} linkExpenses />
          </section>
        </div>
        <div>
          <section className="panel" data-testid="balances">
            <h2>Balances</h2>
            {members.map((m) => {
              const b = s.balances[m.id] ?? 0;
              return (
                <div className="bal" key={m.id}>
                  <Avatar name={m.name} index={idx(m.id)} size={30} />
                  <span className="name">{m.name}{m.userId ? "" : <span className="badge" style={{ marginLeft: 6 }}>not joined</span>}</span>
                  <span className={`amt ${b > 0 ? "pos" : b < 0 ? "neg" : ""}`} data-testid={`balance-${m.name}`}>{b > 0 ? "gets " : b < 0 ? "owes " : ""}{fmtMoney(Math.abs(b))}</span>
                </div>
              );
            })}
          </section>
          <GroupSide summary={s} isCreator={s.group.createdBy === actor.userId} />
        </div>
      </div>
    </main>
  );
}
