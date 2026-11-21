import { redirect } from "next/navigation";
import { currentActor } from "@/lib/session";
import { AuthShell, HeroIntro } from "@/components/AuthShell";

export const metadata = { title: "Connected · Bill Split" };

/** Where the extension sends people to sign in. The extension closes this tab itself once it sees the sign-in. */
export default async function Connected() {
  const actor = await currentActor();
  if (!actor) redirect("/signin?callbackUrl=/connected");
  return (
    <AuthShell hero={<HeroIntro />}>
      <div className="auth-check" aria-hidden="true">✓</div>
      <h2>You're signed in, {actor.name.split(" ")[0]}</h2>
      <p className="auth-card-sub">Go back to the Walmart order tab. Bill Split will pick up where you left off.</p>
      <a href="/" className="btn secondary block">Open your groups instead</a>
    </AuthShell>
  );
}
