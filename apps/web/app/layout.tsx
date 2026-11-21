import "./globals.css";
import "@billsplit/assign-ui/styles.css";
import Link from "next/link";
import { currentActor } from "@/lib/session";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata = { title: "Bill Split", description: "Split Walmart orders item by item" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">🧾 Bill Split</Link>
          <span className="spacer" />
          {actor ? (<><span className="mute small" data-testid="whoami">{actor.name}</span><SignOutButton /></>) : <Link href="/signin">Sign in</Link>}
        </header>
        {children}
      </body>
    </html>
  );
}
