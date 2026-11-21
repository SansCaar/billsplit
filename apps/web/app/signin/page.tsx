import { devLoginEnabled } from "@/auth";
import { getDb } from "@/lib/db";
import { previewInvite } from "@/lib/services";
import { SignInClient } from "@/components/SignInClient";
import { AuthShell, HeroIntro, HeroInvite } from "@/components/AuthShell";

export const metadata = { title: "Sign in · Bill Split" };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; dev?: string }> }) {
  const { callbackUrl, dev } = await searchParams;
  // Arriving from an invite link: show which group they're joining.
  const token = callbackUrl?.match(/^\/join\/([^/?#]+)/)?.[1];
  const invite = token ? await previewInvite(await getDb(), token).catch(() => null) : null;
  return (
    <AuthShell hero={invite ? <HeroInvite groupName={invite.name} members={invite.memberNames} /> : <HeroIntro />}>
      <h2>{invite ? `Sign in to join ${invite.name}` : "Welcome to Bill Split"}</h2>
      <p className="auth-card-sub">{invite ? "You'll join the group as soon as you're signed in." : "Sign in to see your groups, or to start one."}</p>
      <SignInClient google={!!process.env.AUTH_GOOGLE_ID} dev={devLoginEnabled && dev === "1"} callbackUrl={callbackUrl ?? "/"} />
      <p className="auth-fine">No password needed. We only use your name and email from Google. New here? Signing in creates your account.</p>
    </AuthShell>
  );
}
