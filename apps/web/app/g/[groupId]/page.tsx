import Link from "next/link";
import { redirect } from "next/navigation";
import { fmtMoney } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { getDb } from "@/lib/db";
import type { Actor, GroupDoc } from "@/lib/model";
import { currentActor } from "@/lib/session";
import { groupSummary, listActivity } from "@/lib/services";
import { viewerTz } from "@/lib/time";
import { plain } from "@/lib/plain";
import { memberIndex, memberName } from "@/lib/format";
import { ActivityFeed, activityKind, involves, type LedgerFilter } from "@/components/ActivityFeed";
import { ExpenseList } from "@/components/ExpenseList";
import { SettleUp } from "@/components/SettleUp";
import { GroupSettings } from "@/components/GroupSettings";
import { ActiveTabIntoView } from "@/components/ActiveTabIntoView";

export const dynamic = "force-dynamic";

export default async function GroupPage({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{ tab?: string; f?: string; mine?: string }> }) {
  const { groupId } = await params;
  const sp = await searchParams;
  const tab = sp.tab ?? "balances";
  const actor = await currentActor();
  if (!actor) redirect(`/signin?callbackUrl=/g/${groupId}`);
  const db = await getDb();
  const s = plain(await groupSummary(db, actor, groupId));
  const g = s.group;
  const members = g.members.filter((m) => !m.leftAt);
  const live = s.expenses.filter((e) => !e.deleted);
  const myBal = s.balances[s.me.id] ?? 0;
  const mine = s.suggestions.filter((x) => x.fromId === s.me.id || x.toId === s.me.id);
  const allSettled = members.every((m) => (s.balances[m.id] ?? 0) === 0);
  const tabs = [
    ["balances", "Balances", null],
    ["settle", "Settle up", mine.length || null],
    ["expenses", "Expenses", live.length || null],
    ["activity", "Activity", null],
    ["settings", "Settings", null],
  ] as const;

  return (
    <main className="page">
      <div className="crumb"><Link href="/">Your groups</Link><span>/</span></div>
      <header className="page-head">
        <div>
          <h1 data-testid="group-name">{g.name}</h1>
          <p className="sub">{members.length} housemate{members.length === 1 ? "" : "s"} · {live.length} expense{live.length === 1 ? "" : "s"}</p>
        </div>
        <div className="actions">
          <Link className="btn secondary" href={`/g/${groupId}?tab=settle`}>Settle up</Link>
          <Link className="btn primary" href={`/g/${groupId}/new`}>Add expense</Link>
        </div>
      </header>

      <section className="me-card" data-testid="my-summary">
        <div>
          <span className="eyebrow">Your balance</span>
          <div className={`figure ${myBal > 0 ? "pos" : myBal < 0 ? "neg" : ""}`} data-testid="my-balance">{myBal === 0 ? "Settled up" : fmtMoney(Math.abs(myBal))}</div>
          <div className="line">
            {myBal > 0 ? "is owed to you" : myBal < 0 ? "you owe the group" : "Nothing to pay or collect right now."}
            {mine.length > 0 && <> · {mine.map((x) => (x.fromId === s.me.id ? `you → ${memberName(g, x.toId)} ${fmtMoney(x.amount)}` : `${memberName(g, x.fromId)} → you ${fmtMoney(x.amount)}`)).join(" · ")}</>}
          </div>
        </div>
      </section>

      <nav className="tabs" aria-label="Group sections">
        {tabs.map(([k, label, n]) => (
          <Link key={k} href={`/g/${groupId}?tab=${k}`} className={tab === k ? "on" : ""} aria-current={tab === k ? "page" : undefined} scroll={false}>
            {label}{n ? <span className="count">{n}</span> : null}
          </Link>
        ))}
      </nav>
      <ActiveTabIntoView tab={tab} />

      {tab === "balances" && (
        <>
          <div className="section-head">
            <div><span className="eyebrow">{allSettled ? "All settled, all visible" : "Who owes whom"}</span><h2>Group balances</h2></div>
            <span className="aside">Positive amounts are owed to that person.</span>
          </div>
          <div className="bal-grid" data-testid="balances">
            {members.map((m) => {
              const b = s.balances[m.id] ?? 0;
              return (
                <div key={m.id} className={`bal-card ${m.id === s.me.id ? "me" : ""}`}>
                  <div className="who"><Avatar name={m.name} index={memberIndex(g, m.id)} size={36} /><span className="ellipsis">{m.name}</span></div>
                  <div className={`figure ${b > 0 ? "pos" : b < 0 ? "neg" : ""}`} data-testid={`balance-${m.name}`}>{fmtMoney(Math.abs(b))}</div>
                  <div className="cap">{b > 0 ? "is owed" : b < 0 ? "owes the group" : "settled up"}{m.id === s.me.id ? " · you" : m.userId ? "" : " · hasn't joined"}</div>
                </div>
              );
            })}
          </div>
          <div className="bal-cta">
            <div><h3>{s.suggestions.length ? `${s.suggestions.length} payment${s.suggestions.length === 1 ? "" : "s"} would settle everyone` : "Everyone is settled up"}</h3><p className="note" style={{ margin: "2px 0 0" }}>Record payments made outside the app to keep balances right.</p></div>
            <Link className="btn primary" href={`/g/${groupId}?tab=settle`}>Settle up</Link>
          </div>
        </>
      )}

      {tab === "settle" && (
        <SettleUp groupId={groupId} members={members.map((m) => ({ id: m.id, name: m.name, colorIndex: memberIndex(g, m.id) }))} suggestions={s.suggestions} meId={s.me.id}
          settlements={s.settlements.map((x) => ({ id: x._id, fromId: x.fromId, toId: x.toId, amount: x.amount, date: String(x.date), note: x.note, deleted: x.deleted }))} />
      )}

      {tab === "expenses" && <ExpenseList group={g} meId={s.me.id} expenses={s.expenses} settlements={s.settlements} />}

      {tab === "activity" && <ActivityTab groupId={groupId} actor={actor} group={g} meId={s.me.id} f={sp.f} mine={sp.mine === "1"} />}

      {tab === "settings" && <GroupSettings group={g} isCreator={g.createdBy === actor.userId} meId={s.me.id} />}
    </main>
  );
}

async function ActivityTab({ groupId, actor, group, meId, f: rawF, mine }: { groupId: string; actor: Actor; group: GroupDoc; meId: string; f?: string; mine: boolean }) {
  const f = (["expenses", "payments", "people"].includes(rawF ?? "") ? rawF : "all") as LedgerFilter;
  const all = plain(await listActivity(await getDb(), actor, groupId, { limit: 300 }));
  const shown = all.filter((a) => (f === "all" || activityKind(a) === f) && (!mine || involves(a, meId, actor.userId)));
  const href = (nf: string, nm: boolean) => `/g/${groupId}?tab=activity${nf !== "all" ? `&f=${nf}` : ""}${nm ? "&mine=1" : ""}`;
  const label = { all: "All", expenses: "Expenses", payments: "Payments", people: "People" } as const;
  return (
    <>
      <nav className="filter-bar" aria-label="Filter activity">
        {(["all", "expenses", "payments", "people"] as const).map((k) => (
          <Link key={k} href={href(k, mine)} className={f === k ? "on" : ""} scroll={false} aria-current={f === k ? "true" : undefined}>{label[k]}</Link>
        ))}
        <span className="spacer" />
        <Link href={href(f, !mine)} className={`toggle ${mine ? "on" : ""}`} scroll={false} data-testid="involving-me">{mine ? "✓ " : ""}Involving me</Link>
      </nav>
      <section className="card list-card"><ActivityFeed items={shown} group={group} meId={meId} meUserId={actor.userId} tz={await viewerTz()} linkExpenses /></section>
    </>
  );
}
