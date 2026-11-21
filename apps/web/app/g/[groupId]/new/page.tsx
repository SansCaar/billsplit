import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { requireGroup } from "@/lib/services";
import { ManualExpenseForm } from "@/components/ManualExpenseForm";

export default async function NewExpense({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const actor = await currentActor();
  if (!actor) redirect("/signin");
  const { group, me } = await requireGroup(await getDb(), actor, groupId);
  const all = group.members.map((m, i) => ({ id: m.id, name: m.name, colorIndex: i }));
  const members = all.filter((m) => !group.members.find((x) => x.id === m.id)!.leftAt);
  return (
    <main className="page">
      <div className="crumb"><Link href="/">Your groups</Link><span>/</span><Link href={`/g/${groupId}`}>{group.name}</Link><span>/</span></div>
      <header className="page-head">
        <div><h1>Add an expense</h1><p className="sub">For Walmart orders, open the order on walmart.com and choose “Split this order”.</p></div>
      </header>
      <ManualExpenseForm groupId={groupId} members={members} allMembers={all} meId={me.id} />
    </main>
  );
}
