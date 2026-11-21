import Link from "next/link";
import { redirect } from "next/navigation";
import { fmtMoney } from "@billsplit/core";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { getExpense, listActivity, listSnapshots } from "@/lib/services";
import { fmtDate, plain } from "@/lib/plain";
import { ActivityList } from "@/components/ActivityList";
import { ExpenseClient } from "@/components/ExpenseClient";
import { Avatar } from "@billsplit/assign-ui";

export const dynamic = "force-dynamic";

export default async function ExpensePage({ params }: { params: Promise<{ expenseId: string }> }) {
  const { expenseId } = await params;
  const actor = await currentActor();
  if (!actor) redirect(`/signin?callbackUrl=/e/${expenseId}`);
  const db = await getDb();
  const { expense: e, group } = plain(await getExpense(db, actor, expenseId));
  const [activity, snapshots] = plain(await Promise.all([listActivity(db, actor, group._id, { expenseId }), listSnapshots(db, actor, expenseId)]));
  const idx = (id: string) => group.members.findIndex((m) => m.id === id);
  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "?";
  const me = group.members.find((m) => m.userId === actor.userId)!;

  return (
    <main className="page">
      <Link href={`/g/${group._id}`} className="small">← {group.name}</Link>
      <div className="row between wrap">
        <h1 className={e.deleted ? "deleted" : ""} data-testid="expense-title">{e.kind === "walmart" ? "🛒 " : "🧾 "}{e.title}</h1>
        <span className="amt" style={{ fontSize: 24 }} data-testid="expense-amount">{fmtMoney(e.amount)}</span>
      </div>
      <p className="mute">
        {fmtDate(e.date)} · paid by <b>{name(e.payerId)}</b>
        {e.walmart?.card?.last4 ? ` · ${e.walmart.card.brand} •••• ${e.walmart.card.last4}` : ""}
        {e.walmart ? ` · order #${e.walmart.orderNumber}` : ""}
        {e.walmart ? ` · processed ${snapshots.length}×` : ""}
        {e.deleted ? " · DELETED" : ""}
      </p>
      <div className="grid">
        <div>
          <section className="panel">
            <h2>Who owes what</h2>
            <ul className="list" data-testid="shares">
              {Object.entries(e.shares).sort((a, b) => b[1] - a[1]).map(([mid, c]) => (
                <li key={mid} className="row">
                  <Avatar name={name(mid)} index={idx(mid)} size={28} />
                  <span style={{ flex: 1 }}>{name(mid)}</span>
                  <span className="amt" data-testid={`share-${name(mid)}`}>{fmtMoney(c)}</span>
                </li>
              ))}
            </ul>
            {e.unassignedRemainder !== 0 && <p className="mute small">{fmtMoney(e.unassignedRemainder)} left over from rounding — not added to anyone.</p>}
          </section>
          <ExpenseClient expense={e} group={group} meId={me.id} />
        </div>
        <section className="panel">
          <h2>Activity</h2>
          <ActivityList items={activity} />
        </section>
      </div>
    </main>
  );
}
