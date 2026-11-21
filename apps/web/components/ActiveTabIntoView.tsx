"use client";
import { useEffect } from "react";
/** Keeps the selected tab visible in the horizontally scrolling tab bar on phones. */
export function ActiveTabIntoView({ tab }: { tab: string }) {
  useEffect(() => {
    document.querySelector<HTMLElement>(".tabs a.on")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [tab]);
  return null;
}
