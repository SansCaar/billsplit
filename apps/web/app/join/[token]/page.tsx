import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { currentActor } from "@/lib/session";
import { previewInvite, ServiceError } from "@/lib/services";
import { JoinClient } from "@/components/JoinClient";

export default async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const actor = await currentActor();
  if (!actor) redirect(`/signin?callbackUrl=/join/${token}`);
  try {
    const p = await previewInvite(await getDb(), token);
    return (
      <main className="center"><div className="auth">
        <div className="brand-mark">🏠</div>
        <h1>Join {p.name}</h1>
        <p className="mute" style={{ margin: "8px 0 22px" }}>You've been invited to split expenses together.</p>
        <div className="card" style={{ textAlign: "left" }}><JoinClient token={token} placeholders={p.placeholders} groupId={p.groupId} /></div>
      </div></main>
    );
  } catch (e) {
    if (e instanceof ServiceError) return <main className="center"><div className="auth"><div className="brand-mark">🔒</div><h1>Invite not valid</h1><p className="mute">{e.message}</p></div></main>;
    throw e;
  }
}
