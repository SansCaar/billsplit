import "./globals.css";
import "@billsplit/assign-ui/styles.css";
import Link from "next/link";
import type { Viewport } from "next";
import { currentActor } from "@/lib/session";
import { AccountMenu } from "@/components/AccountMenu";

export const metadata = { title: "Bill Split", description: "Split Walmart orders item by item" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="top-in">
            <Link href="/" className="brand"><span className="brand-mark">🧾</span>Bill Split</Link>
            <span className="spacer" />
            {actor ? <AccountMenu name={actor.name} /> : <Link href="/signin" className="btn sm">Sign in</Link>}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
