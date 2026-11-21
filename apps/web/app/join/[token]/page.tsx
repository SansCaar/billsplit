import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { joinGroup, listGroups, previewInvite, ServiceError } from "@/lib/services";
import { JoinClient } from "@/components/JoinClient";
import { AuthShell, HeroInvite, HeroIntro } from "@/components/AuthShell";

export const metadata = { title: "Join a group · Bill Split" };
export const dynamic = "force-dynamic";

/** The placeholder whose name best matches the signed-in person's (first name, case-insensitive). */
function suggest(actorName: string, placeholders: { id: string; name: string }[]) {
  const norm = (s: string) => s.trim().toLowerCase();
  const full = norm(actorName), first = full.split(/\s+/)[0] ?? "";
  return (placeholders.find((p) => norm(p.name) === full) ?? placeholders.find((p) => norm(p.name) === first || norm(p.name).split(/\s+/)[0] === first))?.id;
}

export default async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const actor = await currentActor();
  if (!actor) redirect(`/signin?callbackUrl=/join/${token}`);
  const db = await getDb();
  let p: Awaited<ReturnType<typeof previewInvite>>;
  try {
    p = await previewInvite(db, token);
  } catch (e) {
    if (e instanceof ServiceError)
      return (
        <AuthShell hero={<HeroIntro />}>
          <h2>This invite doesn&apos;t work</h2>
          <p className="auth-card-sub">{e.message}. Ask whoever sent it for a new link.</p>
          <Link href="/" className="btn primary block">Go to your groups</Link>
        </AuthShell>
      );
    throw e;
  }
  // Already in the group (e.g. opened the link twice): go straight there.
  if ((await listGroups(db, actor)).some((g) => g._id === p.groupId)) redirect(`/g/${p.groupId}`);
  // Nothing to decide (no names waiting to be claimed): join straight away.
  if (!p.placeholders.length) {
    await joinGroup(db, actor, token);
    redirect(`/g/${p.groupId}?joined=1`);
  }
  return (
    <AuthShell hero={<HeroInvite groupName={p.name} members={p.memberNames} />}>
      <h2>Join {p.name}</h2>
      <p className="auth-card-sub">Signed in as {actor.name}. If someone already added you, pick your name so your past expenses carry over.</p>
      <JoinClient token={token} placeholders={p.placeholders} suggestedId={suggest(actor.name, p.placeholders)} />
    </AuthShell>
  );
}
