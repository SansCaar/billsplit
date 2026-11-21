import Link from "next/link";
import { redirect } from "next/navigation";
import { fmtMoney } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { groupSummary } from "@/lib/services";
import { plain } from "@/lib/plain";
import { balanceText, memberIndex, memberName } from "@/lib/format";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ExpenseList } from "@/components/ExpenseList";
import { SettleUp } from "@/components/SettleUp";
import { GroupSettings } from "@/components/GroupSettings";

export const dynamic = "force-dynamic";
const TABS = [["expenses", "Expenses"], ["balances", "Balances"], ["activity", "Activity"], ["group", "Group"]] as const;

export default async function GroupPage({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { groupId } = await params;
  const tab = (await searchParams).tab ?? "expenses";
  const actor = await currentActor();
  if (!actor) redirect(`/signin?callbackUrl=/g/${groupId}`);
  const s = plain(await groupSummary(await getDb(), actor, groupId));
  const g = s.group;
  const members = g.members.filter((m) => !m.leftAt);
  const myBal = s.balances[s.me.id] ?? 0;
  const mine = s.suggestions.filter((x) => x.fromId === s.me.id || x.toId === s.me.id);

  return (
    <main className="page">
      <Link href="/" className="back">← Groups</Link>
      <section className="card hero" data-testid="hero">
        <div className="row between">
          <h1 data-testid="group-name" style={{ fontSize: 20 }}>{g.name}</h1>
          <span className="avatars">{members.slice(0, 5).map((m) => <Avatar key={m.id} name={m.name} index={memberIndex(g, m.id)} size={26} />)}</span>
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="label">{myBal > 0 ? "You're owed" : myBal < 0 ? "You owe" : "You're all settled up"}</div>
          {myBal !== 0 && <div className="big" data-testid="my-balance">{fmtMoney(Math.abs(myBal))}</div>}
          <div className="sub">
            {mine.length ? mine.map((x) => (x.fromId === s.me.id ? `you → ${memberName(g, x.toId)} ${fmtMoney(x.amount)}` : `${memberName(g, x.fromId)} → you ${fmtMoney(x.amount)}`)).join(" · ") : `${members.length} members · ${s.expenses.filter((e) => !e.deleted).length} expenses`}
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <Link className="btn white" href={`/g/${groupId}/new`}>+ Add expense</Link>
          <Link className="btn" href={`/g/${groupId}?tab=balances`}>Settle up</Link>
        </div>
      </section>

      <nav className="tabs" aria-label="Group sections">
        {TABS.map(([k, label]) => <Link key={k} href={`/g/${groupId}?tab=${k}`} className={tab === k ? "on" : ""} aria-current={tab === k ? "page" : undefined} scroll={false}>{label}</Link>)}
      </nav>

      {tab === "expenses" && <ExpenseList group={g} meId={s.me.id} expenses={s.expenses} settlements={s.settlements} />}

      {tab === "balances" && (
        <>
          <section className="card flush" data-testid="balances">
            <h2>Balances</h2>
            <ul className="list">
              {members.map((m) => {
                const b = s.balances[m.id] ?? 0;
                const t = balanceText(b);
                return (
                  <li key={m.id} className="bal-row">
                    <Avatar name={m.name} index={memberIndex(g, m.id)} size={36} />
                    <div className="grow">
                      <div className="row-title">{m.id === s.me.id ? `${m.name} (you)` : m.name}</div>
                      {!m.userId && <div className="row-sub">hasn't joined yet</div>}
                    </div>
                    <div>
                      <div className={`k ${t.cls}`}>{t.label}</div>
                      {b !== 0 && <div className={`amt ${t.cls}`} data-testid={`balance-${m.name}`}>{fmtMoney(Math.abs(b))}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          <SettleUp groupId={groupId} members={members.map((m) => ({ id: m.id, name: m.name, index: memberIndex(g, m.id) }))} suggestions={s.suggestions} meId={s.me.id} />
        </>
      )}

      {tab === "activity" && <section className="card flush"><h2>Activity</h2><ActivityFeed items={s.activity} group={g} linkExpenses /></section>}

      {tab === "group" && <GroupSettings group={g} isCreator={g.createdBy === actor.userId} meId={s.me.id} />}

      {tab === "expenses" && <Link href={`/g/${groupId}/new`} className="fab" aria-label="Add expense">＋ Expense</Link>}
    </main>
  );
}
