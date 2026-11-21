import Link from "next/link";
import { Avatar } from "@billsplit/assign-ui";
import type { ActivityDoc, GroupDoc } from "@/lib/model";
import { fmtWhen } from "@/lib/plain";

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
/** Long Walmart order numbers become #…1234 in summaries. */
const tidy = (s: string) => s.replace(/#(\d{6,})(\d{4})\b/g, "#…$2");

export function ActivityFeed({ items, group, linkExpenses = false }: { items: ActivityDoc[]; group?: GroupDoc; linkExpenses?: boolean }) {
  if (!items.length) return <p className="empty small">No activity yet.</p>;
  const idx = (name: string) => Math.max(0, group?.members.findIndex((m) => m.name === name) ?? 0);
  return (
    <ul className="list" data-testid="activity">
      {items.map((a) => (
        <li key={a._id} className="act">
          <Avatar name={a.actorName} index={idx(a.actorName)} size={30} />
          <div className="act-body">
            <div>{linkExpenses && a.expenseId ? <Link href={`/e/${a.expenseId}`} style={{ color: "inherit" }}>{tidy(a.summary)}</Link> : tidy(a.summary)}</div>
            <div className="when">{fmtWhen(a.at)}</div>
            {a.changes.length > 0 && (
              <details>
                <summary>Show {a.changes.length} change{a.changes.length === 1 ? "" : "s"}</summary>
                <ul className="changes">
                  {a.changes.slice(0, 40).map((c, i) => (
                    <li key={i}>
                      {c.before === null && c.label === "Walmart" ? show(c.after) : <><b>{c.label}</b>: <span className="from">{show(c.before)}</span> → {show(c.after)}</>}
                    </li>
                  ))}
                  {a.changes.length > 40 && <li>…and {a.changes.length - 40} more</li>}
                </ul>
              </details>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
