import { devLoginEnabled } from "@/auth";
import { SignInClient } from "@/components/SignInClient";
export default async function SignIn({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  return (
    <main className="center">
      <div className="auth">
        <div className="brand-mark">🧾</div>
        <h1>Split bills, item by item</h1>
        <p className="mute" style={{ margin: "8px 0 22px" }}>Walmart orders and everyday expenses for your household.</p>
        <div className="card" style={{ textAlign: "left" }}>
          <SignInClient google={!!process.env.AUTH_GOOGLE_ID} dev={devLoginEnabled} callbackUrl={callbackUrl ?? "/"} />
        </div>
      </div>
    </main>
  );
}
