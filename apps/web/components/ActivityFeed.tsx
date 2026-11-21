import Link from "next/link";
import { fmtMoney, type FieldChange } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import type { ActivityDoc, GroupDoc } from "@/lib/model";
import { dayHeading, dayKey, timeOfDay } from "@/lib/time";

export type LedgerFilter = "all" | "expenses" | "payments" | "people";

export function activityKind(a: Pick<ActivityDoc, "action">): Exclude<LedgerFilter, "all"> {
  if (a.action.startsWith("settlement.")) return "payments";
  if (a.action.startsWith("expense.") || a.action.startsWith("order.")) return "expenses";
  return "people";
}

/** Does this entry involve the viewer (they made it, or their balance moved)? */
export function involves(a: ActivityDoc, meId: string, meUserId: string) {
  return a.actorUserId === meUserId || !!(a.impact && a.impact[meId]);
}

/** Long Walmart order numbers become #…1234; default Walmart titles read "Walmart order #…1234". */
const tidy = (s: string) => s.replace(/^Walmart #(\d{6,})$/, (_, n) => `Walmart order #…${n.slice(-4)}`).replace(/#(\d{6,})(\d{4})\b/g, "#…$2");

/** Older entries have no subjectTitle: recover it from the stored sentence. */
function subjectOf(a: ActivityDoc): string | null {
  if (a.subjectTitle) return tidy(a.subjectTitle);
  const q = a.summary.match(/"([^"]+)"/)?.[1];
  if (q) return tidy(q);
  const w = a.summary.match(/Walmart order #(\d+)/)?.[1];
  return w ? `Walmart order #…${w.slice(-4)}` : null;
}

const VERB: Partial<Record<ActivityDoc["action"], string>> = {
  "expense.created": "added",
  "expense.deleted": "deleted",
  "expense.restored": "restored",
  "order.processed": "split",
  "order.reprocessed": "re-processed",
};

const KIND_LABEL = { expenses: "Expense", payments: "Payment", people: "Group" } as const;

export function ActivityFeed({
  items, group, meId, meUserId, tz, linkExpenses = false, compact = false,
}: { items: ActivityDoc[]; group: GroupDoc; meId: string; meUserId: string; tz: string; linkExpenses?: boolean; compact?: boolean }) {
  if (!items.length) return <div className="empty"><h3>Nothing here yet</h3><p className="small">Changes to expenses and payments will show up here.</p></div>;
  const member = (id: string) => group.members.find((m) => m.id === id);
  const colour = (id: string) => group.members.findIndex((m) => m.id === id);
  const who = (id: string, start = false) => (id === meId ? (start ? "You" : "you") : member(id)?.name ?? "Someone");
  const byName = (name: string) => group.members.findIndex((m) => m.name === name);

  const days: [string, string, ActivityDoc[]][] = [];
  for (const a of items) {
    const k = dayKey(a.at, tz);
    const last = days[days.length - 1];
    if (last && last[0] === k) last[2].push(a);
    else days.push([k, dayHeading(a.at, tz), [a]]);
  }

  const sentence = (a: ActivityDoc) => {
    const actorIsMe = a.actorUserId === meUserId;
    const actor = <b>{actorIsMe ? "You" : a.actorName}</b>;
    const subject = subjectOf(a);
    const subj = subject ? (linkExpenses && a.expenseId ? <Link href={`/e/${a.expenseId}`} className="ledger-subject">{subject}</Link> : <b>{subject}</b>) : null;
    if (a.action.startsWith("settlement.") && a.impact) {
      const entries = Object.entries(a.impact);
      const from = (a.action === "settlement.deleted" ? entries.find(([, v]) => v < 0) : entries.find(([, v]) => v > 0))?.[0];
      const to = (a.action === "settlement.deleted" ? entries.find(([, v]) => v > 0) : entries.find(([, v]) => v < 0))?.[0];
      if (from && to) {
        const paid = <><b>{who(from, true)}</b> paid <b>{who(to)}</b> {fmtMoney(a.amount ?? 0)}</>;
        return a.action === "settlement.deleted" ? <>{actor} removed a payment: {paid}</> : <>{paid}{a.actorUserId !== member(from)?.userId ? <span className="muted"> · recorded by {actorIsMe ? "you" : a.actorName}</span> : null}</>;
      }
    }
    if (a.action === "expense.updated" && subj) {
      const onlyItems = a.changes.length > 0 && a.changes.every((c) => c.path.startsWith("items.") || c.path.startsWith("shares."));
      return <>{actor} {onlyItems ? "changed who shares items in" : "edited"} {subj}</>;
    }
    const verb = VERB[a.action];
    if (verb && subj) return <>{actor} {verb} {subj}</>;
    // Group/member events: the stored sentence starts with the actor's name.
    let rest = a.summary.startsWith(a.actorName) ? a.summary.slice(a.actorName.length) : ` · ${a.summary}`;
    if (rest === ` joined as ${a.actorName}`) rest = " joined the group";
    return <>{actor}{tidy(rest)}</>;
  };

  // Only the viewer's own balance change is shown inline; everyone's changes live in the details.
  const impactRow = (a: ActivityDoc) => {
    const v = a.impact?.[meId];
    if (!v) return null;
    return (
      <div className="impact" aria-label="Your balance change">
        <span className={`impact-chip mine ${v > 0 ? "up" : "down"}`}>Your balance <b>{v > 0 ? "+" : "−"}{fmtMoney(Math.abs(v))}</b></span>
      </div>
    );
  };
  const impactList = (a: ActivityDoc) => {
    if (!a.impact) return [];
    return Object.entries(a.impact).filter(([, v]) => v).sort(([x], [y]) => (x === meId ? -1 : y === meId ? 1 : 0));
  };

  const names = (s: unknown) => String(s ?? "").split(",").map((x) => x.trim().replace(/ (×\d+|\$[\d.,]+)$/, "")).filter((x) => x && x !== "nobody" && x !== "—");
  const stack = (s: unknown) => {
    const list = names(s);
    if (!list.length) return <span className="faint">nobody</span>;
    return <span className="avatars" title={list.join(", ")}>{list.map((n) => <Avatar key={n} name={n} index={byName(n)} size={20} />)}</span>;
  };

  const details = (a: ActivityDoc) => {
    const items = a.changes.filter((c) => c.path.startsWith("items.") && !/\.(amount|name)$/.test(c.path) && c.after !== "removed");
    const walmart = a.changes.filter((c) => c.path.startsWith("order."));
    const shares = a.impact ? [] : a.changes.filter((c) => c.path.startsWith("shares."));
    const fields = a.changes.filter((c) => !c.path.startsWith("items.") && !c.path.startsWith("order.") && !c.path.startsWith("shares.") || /^items\..*\.(amount|name)$/.test(c.path) || (c.path.startsWith("items.") && c.after === "removed"));
    if (walmart.length) for (let i = fields.length - 1; i >= 0; i--) if (/^items\./.test(fields[i]!.path)) fields.splice(i, 1);
    const bal = impactList(a);
    if (!items.length && !walmart.length && !fields.length && !shares.length && !bal.length) return null;
    const n = items.length + walmart.length + fields.length + shares.length;
    const row = (c: FieldChange, i: number) => (
      <div key={i} className="chg-row"><span className="chg-label">{c.label}</span><span className="chg-val"><s>{String(c.before ?? "—")}</s><span className="arrow">→</span>{String(c.after ?? "—")}</span></div>
    );
    return (
      <details className="ledger-details">
        <summary>{n ? `${n} change${n === 1 ? "" : "s"}` : "Balance changes"}</summary>
        <div className="ledger-detail-body">
          {bal.length > 0 && (
            <div className="chg-group">
              <div className="chg-head">Balances</div>
              {bal.map(([id, v]) => (
                <div key={id} className="chg-row"><span className="chg-label row" style={{ gap: 8 }}><Avatar name={member(id)?.name ?? "?"} index={colour(id)} size={20} />{who(id, true)}</span><span className={`chg-val amt ${v > 0 ? "pos" : "neg"}`}>{v > 0 ? "+" : "−"}{fmtMoney(Math.abs(v))}</span></div>
              ))}
            </div>
          )}
          {walmart.length > 0 && <div className="chg-group"><div className="chg-head">From Walmart</div><ul>{walmart.map((c, i) => <li key={i}>{String(c.after)}</li>)}</ul></div>}
          {items.length > 0 && (
            <div className="chg-group">
              <div className="chg-head">Who shares</div>
              {items.slice(0, 12).map((c, i) => (
                <div key={i} className="chg-row item"><span className="chg-label">{c.label}</span><span className="chg-val">{stack(c.before)}<span className="arrow">→</span>{stack(c.after)}</span></div>
              ))}
              {items.length > 12 && <div className="faint small">…and {items.length - 12} more items</div>}
            </div>
          )}
          {fields.length > 0 && <div className="chg-group"><div className="chg-head">Details</div>{fields.map(row)}</div>}
          {shares.length > 0 && <div className="chg-group"><div className="chg-head">Shares</div>{shares.map(row)}</div>}
        </div>
      </details>
    );
  };

  return (
    <div className="ledger" data-testid="activity">
      {days.map(([k, heading, list]) => (
        <section key={k} className="ledger-day">
          <h3 className="ledger-day-head">{heading}</h3>
          <ul className="list">
            {list.map((a) => {
              const kind = activityKind(a);
              const actorMember = group.members.find((m) => m.userId === a.actorUserId);
              const payer = kind === "payments" && a.impact ? Object.entries(a.impact).find(([, v]) => (a.action === "settlement.deleted" ? v < 0 : v > 0))?.[0] : undefined;
              const face = payer ? member(payer) : actorMember;
              return (
                <li key={a._id} className={`ledger-entry kind-${kind}`}>
                  <Avatar name={face?.name ?? a.actorName} index={face ? group.members.indexOf(face) : undefined} size={32} />
                  <div className="ledger-body">
                    <div className="ledger-text">{sentence(a)}</div>
                    <div className="ledger-meta">
                      <time dateTime={new Date(a.at).toISOString()}>{timeOfDay(a.at, tz)}</time>
                      <span className="dot">·</span><span>{KIND_LABEL[kind]}</span>
                      {a.amount !== undefined && kind === "expenses" && <><span className="dot">·</span><span className="amt">{fmtMoney(a.amount)}</span></>}
                    </div>
                    {impactRow(a)}
                    {details(a)}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
