import Link from "next/link";
import { redirect } from "next/navigation";
import { fmtMoney } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { getExpense, listActivity, listSnapshots } from "@/lib/services";
import { plain } from "@/lib/plain";
import { dayLabel, displayTitle, memberIndex, memberName, shortOrder } from "@/lib/format";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ExpenseClient } from "@/components/ExpenseClient";

export const dynamic = "force-dynamic";

export default async function ExpensePage({ params }: { params: Promise<{ expenseId: string }> }) {
  const { expenseId } = await params;
  const actor = await currentActor();
  if (!actor) redirect(`/signin?callbackUrl=/e/${expenseId}`);
  const db = await getDb();
  const { expense: e, group: g } = plain(await getExpense(db, actor, expenseId));
  const [activity, snapshots] = plain(await Promise.all([listActivity(db, actor, g._id, { expenseId }), listSnapshots(db, actor, expenseId)]));
  const me = g.members.find((m) => m.userId === actor.userId)!;
  const name = (id: string) => (id === me.id ? "You" : memberName(g, id));
  const myShare = e.shares[me.id] ?? 0;
  const shares = Object.entries(e.shares).sort((a, b) => b[1] - a[1]);

  return (
    <main className="page">
      <Link href={`/g/${g._id}`} className="back">← {g.name}</Link>
      <section className={`exp-head hide-when-editing ${e.deleted ? "deleted" : ""}`}>
        <div className={`icon-tile ${e.kind === "walmart" ? "walmart" : ""}`}>{e.kind === "walmart" ? "🛒" : "🧾"}</div>
        <h1 data-testid="expense-title" className="row-title" style={{ fontSize: 20 }}>{displayTitle(e)}</h1>
        <div className="amount" data-testid="expense-amount">{fmtMoney(e.amount)}</div>
        <div className="chips">
          <span className="chip">{dayLabel(e.date)}</span>
          <span className="chip">{name(e.payerId)} paid</span>
          {e.walmart && <span className="chip">order {shortOrder(e.walmart.orderNumber)}</span>}
          {e.walmart?.card?.last4 && <span className="chip">•••• {e.walmart.card.last4}</span>}
          {e.walmart && snapshots.length > 1 && <span className="chip">processed {snapshots.length}×</span>}
          {e.deleted && <span className="chip" style={{ color: "var(--neg)" }}>deleted</span>}
        </div>
      </section>

      {myShare > 0 && !e.deleted && (
        <div className="your-share hide-when-editing" data-testid="your-share">
          <div><div className="small mute">Your share</div><div className="amt">{fmtMoney(myShare)}</div></div>
          {e.payerId !== me.id ? <span className="small mute">you owe {memberName(g, e.payerId)}</span> : <span className="small mute">you paid</span>}
        </div>
      )}

      <section className="card flush hide-when-editing">
        <h2>Who owes what</h2>
        <ul className="list" data-testid="shares">
          {shares.map(([mid, c]) => (
            <li key={mid} className="bal-row">
              <Avatar name={memberName(g, mid)} index={memberIndex(g, mid)} size={32} />
              <span className="grow row-title">{memberName(g, mid)}{mid === me.id ? " (you)" : ""}</span>
              <span className="amt" data-testid={`share-${memberName(g, mid)}`}>{fmtMoney(c)}</span>
            </li>
          ))}
        </ul>
        {e.unassignedRemainder !== 0 && <p className="note" style={{ padding: "0 16px 8px" }}>{fmtMoney(e.unassignedRemainder)} left over from rounding — not added to anyone.</p>}
      </section>

      <ExpenseClient expense={e} group={g} meId={me.id} />

      <section className="card flush hide-when-editing">
        <h2>Activity</h2>
        <ActivityFeed items={activity} group={g} />
      </section>
    </main>
  );
}
