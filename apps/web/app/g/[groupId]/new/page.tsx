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
  const all = group.members.map((m) => ({ id: m.id, name: m.name }));
  const members = group.members.filter((m) => !m.leftAt).map((m) => ({ id: m.id, name: m.name }));
  return (
    <main className="page">
      <Link href={`/g/${groupId}`} className="back">← {group.name}</Link>
      <h1 style={{ margin: "4px 4px 14px" }}>Add expense</h1>
      <ManualExpenseForm groupId={groupId} members={members} allMembers={all} meId={me.id} />
      <p className="note" style={{ textAlign: "center" }}>Walmart order? Open it on walmart.com and click “Split this order”.</p>
    </main>
  );
}
