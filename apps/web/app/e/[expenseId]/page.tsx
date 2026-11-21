import Link from "next/link";
import { redirect } from "next/navigation";
import { fmtMoney } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { getExpense, listActivity, listSnapshots } from "@/lib/services";
import { orNotFound } from "@/lib/notFound";
import { plain } from "@/lib/plain";
import { viewerTz } from "@/lib/time";
import { dayLabel, displayTitle, memberIndex, memberName, shortOrder } from "@/lib/format";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ExpenseClient } from "@/components/ExpenseClient";

export const dynamic = "force-dynamic";

export default async function ExpensePage({ params, searchParams }: { params: Promise<{ expenseId: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { expenseId } = await params;
  const { edit } = await searchParams;
  const actor = await currentActor();
  if (!actor) redirect(`/signin?callbackUrl=/e/${expenseId}`);
  const db = await getDb();
  const { expense: e, group: g } = plain(await orNotFound(getExpense(db, actor, expenseId)));
  const [activity, snapshots] = plain(await Promise.all([listActivity(db, actor, g._id, { expenseId }), listSnapshots(db, actor, expenseId)]));
  const me = g.members.find((m) => m.userId === actor.userId)!;
  const name = (id: string) => (id === me.id ? "You" : memberName(g, id));
  const myShare = e.shares[me.id] ?? 0;
  const shares = Object.entries(e.shares).sort((a, b) => b[1] - a[1]);

  return (
    <main className="page">
      <nav className="crumb" aria-label="Breadcrumb"><Link href="/">Your groups</Link><span aria-hidden>/</span><Link href={`/g/${g._id}?tab=expenses`}>{g.name}</Link></nav>
      <header className={`page-head hide-when-editing ${e.deleted ? "deleted" : ""}`}>
        <div>
          <span className="eyebrow">{e.kind === "walmart" ? "Walmart order" : "Expense"}{e.deleted ? " · deleted" : ""}</span>
          <h1 data-testid="expense-title" style={{ marginTop: 8 }}>{displayTitle(e)}</h1>
          <div className="exp-meta">
            <span>{dayLabel(e.date)}</span>
            <span>{name(e.payerId)} paid</span>
            {e.walmart && <span>Order {shortOrder(e.walmart.orderNumber)}</span>}
            {e.walmart?.card?.last4 && <span>{e.walmart.card.brand} •••• {e.walmart.card.last4}</span>}
            {e.walmart && snapshots.length > 1 && <span>Processed {snapshots.length}×</span>}
          </div>
        </div>
        <div className="exp-amount" data-testid="expense-amount">{fmtMoney(e.amount)}</div>
      </header>

      <div className="two-col hide-when-editing" style={{ marginBottom: 18 }}>
        <section className="me-card" style={{ margin: 0 }} data-testid="your-share">
          <div>
            <span className="eyebrow">Your share</span>
            <div className="figure">{fmtMoney(myShare)}</div>
            <div className="line">{myShare === 0 ? "You're not part of this one." : e.payerId === me.id ? "You paid for this." : `You owe ${memberName(g, e.payerId)} for this.`}</div>
          </div>
        </section>
        <section className="card list-card" style={{ margin: 0 }}>
          <div className="card-head"><h2>Who owes what</h2>{e.unassignedRemainder !== 0 && <span className="note">{fmtMoney(e.unassignedRemainder)} rounding left over</span>}</div>
          <ul className="list" data-testid="shares">
            {shares.map(([mid, c]) => (
              <li key={mid} className="li" style={{ minHeight: 52, padding: "10px 20px" }}>
                <Avatar name={memberName(g, mid)} index={memberIndex(g, mid)} size={30} />
                <span className="grow">{memberName(g, mid)}{mid === me.id ? " (you)" : ""}</span>
                <span className="amt" data-testid={`share-${memberName(g, mid)}`}>{fmtMoney(c)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <ExpenseClient expense={e} group={g} meId={me.id} startEditing={edit === "1" && !e.deleted} />

      <section className="card list-card hide-when-editing">
        <div className="card-head"><h2>Activity</h2><span className="note">Every change to this expense</span></div>
        <ActivityFeed items={activity} group={g} meId={me.id} meUserId={actor.userId} tz={await viewerTz()} compact />
      </section>
    </main>
  );
}
