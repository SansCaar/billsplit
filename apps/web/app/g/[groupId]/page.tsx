import Link from "next/link";
import { redirect } from "next/navigation";
import { fmtMoney } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { getDb } from "@/lib/db";
import type { Actor, GroupDoc } from "@/lib/model";
import { currentActor } from "@/lib/session";
import { groupSummary, listActivity } from "@/lib/services";
import { orNotFound } from "@/lib/notFound";
import { viewerTz } from "@/lib/time";
import { plain } from "@/lib/plain";
import { memberIndex, memberName } from "@/lib/format";
import { ActivityFeed, activityKind, involves, type LedgerFilter } from "@/components/ActivityFeed";
import { ExpenseList } from "@/components/ExpenseList";
import { SettleUp } from "@/components/SettleUp";
import { GroupSettings } from "@/components/GroupSettings";
import { ActiveTabIntoView } from "@/components/ActiveTabIntoView";
import { InviteBox } from "@/components/InviteBox";
import { ExtensionCard } from "@/components/ExtensionCard";
import { QuickSettle } from "@/components/QuickSettle";
import { AddedBanner } from "@/components/AddedBanner";

export const dynamic = "force-dynamic";

export default async function GroupPage({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{ tab?: string; f?: string; mine?: string; added?: string; joined?: string }> }) {
  const { groupId } = await params;
  const sp = await searchParams;
  // "settings" is the old name of the Members tab; keep old links working.
  const tab = sp.tab === "settings" ? "members" : sp.tab ?? "balances";
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
  const waiting = members.filter((m) => !m.userId);
  // A group is "set up" once someone else has joined and there's at least one expense.
  const othersJoined = members.some((m) => m.userId && m.id !== s.me.id);
  const settingUp = live.length === 0;
  const added = sp.added ? live.find((e) => e._id === sp.added) : undefined;
  const tabs = [
    ["balances", "Balances", null],
    ["settle", "Settle up", mine.length || null],
    ["expenses", "Expenses", live.length || null],
    ["activity", "Activity", null],
    ["members", "Members", waiting.length && g.invite.enabled ? waiting.length : null],
  ] as const;

  return (
    <main className="page">
      <nav className="crumb" aria-label="Breadcrumb"><Link href="/">← Your groups</Link></nav>
      <header className="page-head">
        <div>
          <h1 data-testid="group-name">{g.name}</h1>
          <p className="sub">{members.length} {members.length === 1 ? "person" : "people"} · {live.length} expense{live.length === 1 ? "" : "s"}</p>
        </div>
        <div className={`actions ${live.length ? "" : "single"}`}>
          {live.length > 0 && <Link className="btn secondary" href={`/g/${groupId}?tab=settle`}>Settle up</Link>}
          <Link className="btn primary" href={`/g/${groupId}/new`}>Add expense</Link>
        </div>
      </header>

      <nav className="tabs" aria-label="Group sections">
        {tabs.map(([k, label, n]) => (
          <Link key={k} href={`/g/${groupId}?tab=${k}`} className={`${tab === k ? "on" : ""} tab-${k}`} aria-label={label} aria-current={tab === k ? "page" : undefined} scroll={false}>
            {label}{n ? <span className="count" aria-label={k === "members" ? `${n} not joined yet` : undefined}>{n}</span> : null}
          </Link>
        ))}
      </nav>
      <ActiveTabIntoView tab={tab} />
      {sp.joined === "1" && (
        <div className="ok added" role="status" data-testid="joined-banner">
          <span className="grow">You&apos;re in <b>{g.name}</b>. {myBal > 0 ? <>You get back <b>{fmtMoney(myBal)}</b> so far.</> : myBal < 0 ? <>You owe <b>{fmtMoney(-myBal)}</b> from expenses already added.</> : live.length ? "You're settled up." : "No expenses yet."}</span>
          <Link className="link small" href={`/g/${groupId}`}>Dismiss</Link>
        </div>
      )}
      {added && <AddedBanner groupId={groupId} expenseId={added._id} title={added.title} amount={added.amount} />}

      {tab === "balances" && settingUp && (
        <section className="card setup" data-testid="setup">
          <div className="card-head"><div><span className="eyebrow">Get {g.name} going</span><h2 style={{ marginTop: 6 }}>Finish setting up</h2></div><span className="note">{othersJoined ? 2 : 1} of 3 done</span></div>
          <ol className="setup-steps">
            <li className="done"><span className="setup-mark" aria-hidden="true">✓</span><div><b>Create the group</b></div></li>
            <li className={othersJoined ? "done" : "now"}>
              <span className="setup-mark" aria-hidden="true">{othersJoined ? "✓" : "2"}</span>
              <div className="grow">
                <b>Invite your housemates</b>
                {othersJoined ? <p className="note" style={{ margin: "2px 0 0" }}>{waiting.length ? <>Still waiting for {waiting.map((m) => m.name).join(", ")}. The link is in <Link className="link small" href={`/g/${groupId}?tab=members`}>Members</Link>.</> : "Everyone's here."}</p> : <>
                <p className="note" style={{ margin: "2px 0 10px" }}>{waiting.length ? <>Send this link to {waiting.map((m) => m.name).join(", ")}. They sign in with Google and pick their name.</> : "Send this link to everyone who shares costs."}</p>
                {g.invite.enabled ? <InviteBox token={g.invite.token} groupName={g.name} /> : <p className="note">The invite link is off. Turn it on in <Link className="link small" href={`/g/${groupId}?tab=members`}>Members</Link>.</p>}
                </>}
              </div>
            </li>
            <li className={live.length ? "done" : "now"}>
              <span className="setup-mark" aria-hidden="true">{live.length ? "✓" : "3"}</span>
              <div className="grow">
                <b>Add your first expense</b>
                <p className="note" style={{ margin: "2px 0 10px" }}>Rent, internet, a grocery run. Split it equally, by parts or by exact amounts.</p>
                {!live.length && <Link className="btn primary sm" href={`/g/${groupId}/new`} data-testid="first-expense">Add an expense</Link>}
              </div>
            </li>
          </ol>
        </section>
      )}
      {tab === "balances" && live.length === 0 && <ExtensionCard />}

      {tab === "balances" && live.length > 0 && (
        <>
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
                  return (
                    <li key={i}>
                      <Avatar name={memberName(g, other)} index={memberIndex(g, other)} size={24} />
                      <span className="grow">{x.fromId === s.me.id ? <>You owe <b>{memberName(g, other)}</b></> : <><b>{memberName(g, other)}</b> owes you</>}</span>
                      <span className={`amt ${x.fromId === s.me.id ? "neg" : "pos"}`}>{fmtMoney(x.amount)}</span>
                      <QuickSettle groupId={groupId} fromId={x.fromId} toId={x.toId} amount={x.amount} iPay={x.fromId === s.me.id} otherName={memberName(g, other)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <div className="section-head">
            <div><span className="eyebrow">{allSettled ? "All settled, all visible" : "Who owes whom"}</span><h2>Group balances</h2></div>
            <span className="aside">+ means they get money back, − means they owe.</span>
          </div>
          <div className="bal-grid" data-testid="balances">
            {members.map((m) => {
              const b = s.balances[m.id] ?? 0;
              return (
                <div key={m.id} className={`bal-card ${m.id === s.me.id ? "me" : ""}`}>
                  <div className="who"><Avatar name={m.name} index={memberIndex(g, m.id)} size={36} /><span className="ellipsis">{m.name}</span></div>
                  <div className={`figure ${b > 0 ? "pos" : b < 0 ? "neg" : ""}`} data-testid={`balance-${m.name}`}>{b > 0 ? "+" : b < 0 ? "−" : ""}{fmtMoney(Math.abs(b))}</div>
                  <div className="cap">{b > 0 ? "is owed" : b < 0 ? "owes the group" : "settled up"}{m.id === s.me.id ? " · you" : m.userId ? "" : " · hasn't joined"}</div>
                </div>
              );
            })}
          </div>
          {!othersJoined && g.invite.enabled && (
            <section className="card invite-nudge" data-testid="invite-nudge">
              <div className="card-head"><h2>Nobody else has joined yet</h2></div>
              <p className="note" style={{ marginTop: -6 }}>Send the invite so {waiting.length ? waiting.map((m) => m.name).join(", ") : "your housemates"} can see what they owe and add expenses too.</p>
              <InviteBox token={g.invite.token} groupName={g.name} />
            </section>
          )}
          <p className="note bal-foot">{s.suggestions.length ? <>{s.suggestions.length} payment{s.suggestions.length === 1 ? "" : "s"} would settle everyone. <Link className="link small" href={`/g/${groupId}?tab=settle`}>See all payments</Link></> : "Everyone is settled up."}</p>
        </>
      )}

      {tab === "settle" && (
        <SettleUp groupId={groupId} members={members.map((m) => ({ id: m.id, name: m.name, colorIndex: memberIndex(g, m.id) }))} suggestions={s.suggestions} meId={s.me.id}
          settlements={s.settlements.map((x) => ({ id: x._id, fromId: x.fromId, toId: x.toId, amount: x.amount, date: String(x.date), note: x.note, deleted: x.deleted }))} />
      )}

      {tab === "expenses" && <ExpenseList group={g} meId={s.me.id} expenses={s.expenses} settlements={s.settlements} />}

      {tab === "activity" && <ActivityTab groupId={groupId} actor={actor} group={g} meId={s.me.id} f={sp.f} mine={sp.mine === "1"} />}

      {tab === "members" && <GroupSettings group={g} isCreator={g.createdBy === actor.userId} meId={s.me.id} balances={s.balances} />}
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
