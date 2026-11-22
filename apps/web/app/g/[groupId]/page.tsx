import Link from "next/link";
import { redirect } from "next/navigation";
import { fmtMoney } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { getDb } from "@/lib/db";
import type { Actor, GroupDoc } from "@/lib/model";
import { currentActor } from "@/lib/session";
import { getNotifyPrefs, groupSummary, listActivity, nudgeKey } from "@/lib/services";
import { orNotFound } from "@/lib/notFound";
import { viewerTz } from "@/lib/time";
import { plain } from "@/lib/plain";
import { memberIndex, memberName } from "@/lib/format";
import { ActivityFeed, activityKind, involves, type LedgerFilter } from "@/components/ActivityFeed";
import { ExpenseList } from "@/components/ExpenseList";
import { SettleUp } from "@/components/SettleUp";
import { GroupSettings } from "@/components/GroupSettings";
import { ActiveTabIntoView } from "@/components/ActiveTabIntoView";
import { GroupNotifyLevel } from "@/components/GroupNotifyLevel";
import { NotifyBanner } from "@/components/NotifyBanner";
import { NudgeButton } from "@/components/NudgeButton";

export const dynamic = "force-dynamic";

export default async function GroupPage({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{ tab?: string; f?: string; mine?: string }> }) {
  const { groupId } = await params;
  const sp = await searchParams;
  const tab = sp.tab ?? "balances";
  const actor = await currentActor();
  if (!actor) redirect(`/signin?callbackUrl=/g/${groupId}`);
  const db = await getDb();
  const s = plain(await orNotFound(groupSummary(db, actor, groupId)));
  const g = s.group;
  const members = g.members.filter((m) => !m.leftAt);
  const live = s.expenses.filter((e) => !e.deleted);
  const myBal = s.balances[s.me.id] ?? 0;
  const mine = s.suggestions.filter((x) => x.fromId === s.me.id || x.toId === s.me.id);
  const allSettled = members.every((m) => (s.balances[m.id] ?? 0) === 0);
  // The notifications banner appears once this person has added an expense or recorded a payment here.
  const hasContributed = s.expenses.some((e) => e.createdBy === actor.userId) || s.settlements.some((x) => x.createdBy === actor.userId);
  const nudged = (fromId: string, toId: string) => s.nudges[nudgeKey(fromId, toId)] ?? 0;
  const tabs = [
    ["balances", "Balances", null],
    ["settle", "Settle up", mine.length || null],
    ["expenses", "Expenses", live.length || null],
    ["activity", "Activity", null],
    ["settings", "Settings", null],
  ] as const;

  return (
    <main className="page">
      <nav className="crumb" aria-label="Breadcrumb"><Link href="/">← Your groups</Link></nav>
      <header className="page-head">
        <div>
          <h1 data-testid="group-name">{g.name}</h1>
          <p className="sub">{members.length} {members.length === 1 ? "person" : "people"} · {live.length} expense{live.length === 1 ? "" : "s"}</p>
        </div>
        <div className="actions">
          <Link className="btn secondary" href={`/g/${groupId}?tab=settle`}>Settle up</Link>
          <Link className="btn primary" href={`/g/${groupId}/new`}>Add expense</Link>
        </div>
      </header>

      <nav className="tabs" aria-label="Group sections">
        {tabs.map(([k, label, n]) => (
          <Link key={k} href={`/g/${groupId}?tab=${k}`} className={`${tab === k ? "on" : ""} tab-${k}`} aria-label={label} aria-current={tab === k ? "page" : undefined} scroll={false}>
            {k === "settings" ? <><GearIcon /><span className="tab-label">{label}</span></> : label}{n ? <span className="count">{n}</span> : null}
          </Link>
        ))}
      </nav>
      <ActiveTabIntoView tab={tab} />

      {tab === "balances" && (
        <>
          {hasContributed && <NotifyBanner />}
          <section className="me-card" data-testid="my-summary">
            <div>
              <span className="eyebrow">{myBal > 0 ? "You're owed" : myBal < 0 ? "You owe" : "Your balance"}</span>
              <div className={`figure ${myBal > 0 ? "pos" : myBal < 0 ? "neg" : ""}`} data-testid="my-balance">{myBal === 0 ? "Settled up" : fmtMoney(Math.abs(myBal))}</div>
              {myBal === 0 && <div className="line">Nothing to pay or collect right now.</div>}
            </div>
            {mine.length > 0 && (
              <ul className="me-pays">
                {mine.map((x, i) => {
                  const other = x.fromId === s.me.id ? x.toId : x.fromId;
                  const iOwe = x.fromId === s.me.id;
                  // Nudges go from the person owed (x.toId) to the person who owes (x.fromId).
                  const count = nudged(x.toId, x.fromId);
                  const otherJoined = !!g.members.find((m) => m.id === other)?.userId;
                  return (
                    <li key={i}>
                      <Avatar name={memberName(g, other)} index={memberIndex(g, other)} size={24} />
                      <span className="grow">
                        {iOwe ? <>You owe <b>{memberName(g, other)}</b></> : <><b>{memberName(g, other)}</b> owes you</>}
                        {count > 0 && <span className="nudged-note">{iOwe ? `${memberName(g, other)} nudged you ${count}× today` : `Nudged ${count}× today`}</span>}
                      </span>
                      <span className={`amt ${iOwe ? "neg" : "pos"}`}>{fmtMoney(x.amount)}</span>
                      {!iOwe && otherJoined && <NudgeButton groupId={groupId} toId={other} toName={memberName(g, other)} myName={s.me.name} amount={x.amount} count={count} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
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
      {tab === "settings" && <GroupNotifySection groupId={groupId} actor={actor} />}
    </main>
  );
}

async function GroupNotifySection({ groupId, actor }: { groupId: string; actor: Actor }) {
  const prefs = await getNotifyPrefs(await getDb(), actor);
  return <GroupNotifyLevel groupId={groupId} level={prefs.groups?.[groupId] ?? null} fallback={prefs.level} />;
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

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
