import "./globals.css";
import "@billsplit/assign-ui/styles.css";
import Link from "next/link";
import type { Viewport } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { currentActor } from "@/lib/session";
import { getDb } from "@/lib/db";
import { listGroups } from "@/lib/services";
import { AccountMenu } from "@/components/AccountMenu";
import { SideGroups } from "@/components/SideGroups";
import { TzCookie } from "@/components/TzCookie";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata = { title: "Bill Split", description: "Split Walmart orders item by item" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f7f8f3" };

function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark">b</span>
      <span className="brand-name"><span>Bill</span><span>Split</span></span>
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  const groups = actor ? (await listGroups(await getDb(), actor)).map((g) => ({ id: g._id, name: g.name })) : [];
  return (
    <html lang="en" className={`${dmSans.variable} ${manrope.variable}`}>
      <body>
        <TzCookie />
        <div className="shell">
          {actor && (
            <aside className="side">
              <div className="side-in">
                <Brand />
                <div className="side-head"><span className="eyebrow">Your groups</span><Link href="/#new-group" aria-label="New group">+</Link></div>
                <SideGroups groups={groups} />
                <div className="side-foot"><b>Made for sharing</b>Groceries, bills, and the little things in between.</div>
              </div>
            </aside>
          )}
          <div className="main">
            <header className="topbar">
              <Brand />
              <span className="status">{process.env.NODE_ENV === "production" ? "Shared workspace" : "Local workspace"}</span>
              <span className="spacer" />
              {actor ? <AccountMenu name={actor.name} /> : <Link href="/signin" className="btn secondary sm">Sign in</Link>}
            </header>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
