import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { previewInvite, ServiceError } from "@/lib/services";
import { JoinClient } from "@/components/JoinClient";
import { AuthShell, HeroInvite, HeroIntro } from "@/components/AuthShell";

export const metadata = { title: "Join a group · Bill Split" };

export default async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const actor = await currentActor();
  if (!actor) redirect(`/signin?callbackUrl=/join/${token}`);
  try {
    const p = await previewInvite(await getDb(), token);
    return (
      <AuthShell hero={<HeroInvite groupName={p.name} members={p.memberNames} />}>
        <h2>Join {p.name}</h2>
        <p className="auth-card-sub">{p.placeholders.length ? "If someone already added you, pick your name so your past expenses carry over." : `You're signed in as ${actor.name}.`}</p>
        <JoinClient token={token} placeholders={p.placeholders} groupId={p.groupId} />
      </AuthShell>
    );
  } catch (e) {
    if (e instanceof ServiceError)
      return (
        <AuthShell hero={<HeroIntro />}>
          <h2>This invite doesn't work</h2>
          <p className="auth-card-sub">{e.message}. Ask whoever sent it for a new link.</p>
          <Link href="/" className="btn primary block">Go to your groups</Link>
        </AuthShell>
      );
    throw e;
  }
}
