"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
/** Saves the browser's timezone in a cookie so server-rendered times use it; refreshes once if it changed. */
export function TzCookie() {
  const r = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const cur = document.cookie.match(/(?:^|; )tz=([^;]*)/)?.[1];
    if (tz && decodeURIComponent(cur ?? "") !== tz) {
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      r.refresh();
    }
  }, [r]);
  return null;
}
