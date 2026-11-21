"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function SideGroups({ groups }: { groups: { id: string; name: string }[] }) {
  const path = usePathname();
  if (!groups.length) return <p className="note" style={{ margin: "0 10px" }}>No groups yet.</p>;
  return (
    <nav className="side-groups" aria-label="Your groups">
      {groups.map((g) => (
        <Link key={g.id} href={`/g/${g.id}`} className={`side-group ${path.startsWith(`/g/${g.id}`) ? "on" : ""}`}>
          <span className="mono">{g.name.trim()[0]?.toUpperCase() ?? "G"}</span>
          <span className="ellipsis">{g.name}</span>
        </Link>
      ))}
    </nav>
  );
}
