"use client";
export async function api<T = unknown>(path: string, method: string = "GET", body?: unknown): Promise<T> {
  const r = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
  return j as T;
}
export const toCents = (s: string) => Math.round(parseFloat(s.replace(/[^0-9.]/g, "") || "0") * 100);
