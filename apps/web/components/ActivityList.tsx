import Link from "next/link";
import type { ActivityDoc } from "@/lib/model";
import { fmtWhen } from "@/lib/plain";
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
export function ActivityList({ items, linkExpenses = false }: { items: ActivityDoc[]; linkExpenses?: boolean }) {
  if (!items.length) return <p className="mute small">No activity yet.</p>;
  return (
    <ul className="list" data-testid="activity">
      {items.map((a) => (
        <li key={a._id} className="act">
          <div>{linkExpenses && a.expenseId ? <Link href={`/e/${a.expenseId}`}>{a.summary}</Link> : a.summary}</div>
          <div className="when">{fmtWhen(a.at)}</div>
          {a.changes.length > 0 && (
            <ul className="changes">
              {a.changes.slice(0, 30).map((c, i) => (
                <li key={i}>{c.before === null && c.label === "Walmart" ? <>{show(c.after)}</> : <><b>{c.label}</b>: {show(c.before)} → {show(c.after)}</>}</li>
              ))}
              {a.changes.length > 30 && <li>…and {a.changes.length - 30} more</li>}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
