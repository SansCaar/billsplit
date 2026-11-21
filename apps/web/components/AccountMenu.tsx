"use client";
import { signOut } from "next-auth/react";
import { Avatar } from "@billsplit/assign-ui";
export function AccountMenu({ name }: { name: string }) {
  return (
    <details className="menu">
      <summary aria-label="Account menu" data-testid="whoami" title={name}><Avatar name={name} index={0} size={34} /></summary>
      <div className="menu-pop">
        <div className="who"><b>{name}</b></div>
        <a href="/">Your groups</a>
        <button onClick={() => signOut({ callbackUrl: "/signin" })}>Sign out</button>
      </div>
    </details>
  );
}
