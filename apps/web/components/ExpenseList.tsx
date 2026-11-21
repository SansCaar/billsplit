import Link from "next/link";
import { fmtMoney } from "@billsplit/core";
import type { ExpenseDoc, GroupDoc, SettlementDoc } from "@/lib/model";
import { dayLabel, displayTitle, expenseSubtitle, involvement, memberName, monthLabel } from "@/lib/format";

type Row = { kind: "e"; date: string; e: ExpenseDoc } | { kind: "s"; date: string; s: SettlementDoc };

export function ExpenseList({ group, meId, expenses, settlements }: { group: GroupDoc; meId: string; expenses: ExpenseDoc[]; settlements: SettlementDoc[] }) {
  const rows: Row[] = [
    ...expenses.map((e) => ({ kind: "e" as const, date: String(e.date), e })),
    ...settlements.map((s) => ({ kind: "s" as const, date: String(s.date), s })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  if (!rows.length)
    return (
      <section className="card empty">
        <div className="big">🛒</div>
        <p><b>No expenses yet</b></p>
        <p className="small">Add one with the + button, or open a Walmart order and click “Split this order”.</p>
      </section>
    );
  const months: [string, Row[]][] = [];
  for (const r of rows) {
    const m = monthLabel(r.date);
    const last = months[months.length - 1];
    if (last && last[0] === m) last[1].push(r);
    else months.push([m, [r]]);
  }
  const name = (id: string) => (id === meId ? "You" : memberName(group, id));
  return (
    <section className="card flush" data-testid="expenses">
      {months.map(([m, list]) => (
        <div key={m}>
          <div className="month">{m}</div>
          <ul className="list">
            {list.map((r) => {
              if (r.kind === "s") {
                const s = r.s;
                return (
                  <li key={s._id} className={s.deleted ? "deleted" : ""}>
                    <div className="item-row">
                      <span className="icon-tile pay">💸</span>
                      <div className="grow">
                        <div className="row-title ellipsis">{name(s.fromId)} paid {s.toId === meId ? "you" : memberName(group, s.toId)}</div>
                        <div className="row-sub">{dayLabel(s.date)} · settlement{s.note ? ` · ${s.note}` : ""}</div>
                      </div>
                      <div className="row-right"><div className="amt">{fmtMoney(s.amount)}</div></div>
                    </div>
                  </li>
                );
              }
              const e = r.e;
              const inv = involvement(e, meId);
              return (
                <li key={e._id} className={e.deleted ? "deleted" : ""}>
                  <Link href={`/e/${e._id}`} className="item-row">
                    <span className={`icon-tile ${e.kind === "walmart" ? "walmart" : ""}`}>{e.kind === "walmart" ? "🛒" : "🧾"}</span>
                    <div className="grow">
                      <div className="row-title ellipsis">{displayTitle(e)}</div>
                      <div className="row-sub ellipsis">{dayLabel(e.date)} · {expenseSubtitle(e, name(e.payerId))}{e.deleted ? " · deleted" : ""}</div>
                    </div>
                    <div className="row-right">
                      {inv.kind === "lent" && <><div className="k pos">you lent</div><div className="amt pos">{fmtMoney(inv.amount)}</div></>}
                      {inv.kind === "owe" && <><div className="k neg">you owe</div><div className="amt neg">{fmtMoney(inv.amount)}</div></>}
                      {inv.kind === "none" && <div className="k faint">not involved</div>}
                      {inv.kind === "even" && <div className="k faint">just you</div>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
