import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { requireGroup } from "@/lib/services";
import { orNotFound } from "@/lib/notFound";
import { ManualExpenseForm } from "@/components/ManualExpenseForm";
import { ExtensionCard } from "@/components/ExtensionCard";

export default async function NewExpense({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const actor = await currentActor();
  if (!actor) redirect("/signin");
  const { group, me } = await orNotFound(requireGroup(await getDb(), actor, groupId));
  const all = group.members.map((m, i) => ({ id: m.id, name: m.name, colorIndex: i }));
  const members = all.filter((m) => !group.members.find((x) => x.id === m.id)!.leftAt);
  return (
    <main className="page">
      <nav className="crumb" aria-label="Breadcrumb"><Link href="/">Your groups</Link><span aria-hidden>/</span><Link href={`/g/${groupId}`}>{group.name}</Link></nav>
      <header className="page-head">
        <div><h1>Add an expense</h1></div>
      </header>
      <ManualExpenseForm groupId={groupId} members={members} allMembers={all} meId={me.id} />
      <div style={{ marginTop: 18 }}><ExtensionCard compact /></div>
    </main>
  );
}
