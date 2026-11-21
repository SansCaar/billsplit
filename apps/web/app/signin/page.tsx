import { devLoginEnabled } from "@/auth";
import { SignInClient } from "@/components/SignInClient";
export default async function SignIn({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  return (
    <main className="center">
      <div className="panel card-narrow">
        <h1>Sign in</h1>
        <SignInClient google={!!process.env.AUTH_GOOGLE_ID} dev={devLoginEnabled} callbackUrl={callbackUrl ?? "/"} />
      </div>
    </main>
  );
}
