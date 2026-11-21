import { devLoginEnabled } from "@/auth";
import { SignInClient } from "@/components/SignInClient";
export default async function SignIn({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  return (
    <main className="center">
      <div className="auth">
        <div className="brand-mark">b</div>
        <span className="eyebrow">Bill Split</span>
        <h1 style={{ marginTop: 8 }}>Split bills, item by item</h1>
        <p className="muted" style={{ margin: "10px 0 24px" }}>Walmart orders and everyday expenses for your household.</p>
        <div className="card">
          <SignInClient google={!!process.env.AUTH_GOOGLE_ID} dev={devLoginEnabled} callbackUrl={callbackUrl ?? "/"} />
        </div>
      </div>
    </main>
  );
}
