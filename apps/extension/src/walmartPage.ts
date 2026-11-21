// Runs inside walmart.com pages. Shared by the content script and the real-Chrome test harness.
import { extractOrderJsonFromHtml, parseWalmartOrder } from "@billsplit/core/walmart";
import type { ParsedOrder } from "@billsplit/core";

export const orderIdFromPath = (path: string): string | null => path.match(/^\/orders\/(\d{10,})(?:[/?#]|$)/)?.[1] ?? null;

/** Parse the order from a freshly fetched copy of its details page (never the possibly-stale SPA state). */
export function parseOrderHtml(html: string, url: string): ParsedOrder {
  return parseWalmartOrder(extractOrderJsonFromHtml(html), url);
}

const SAFE_TOGGLE = (b: HTMLElement) => {
  if (b.closest("header, nav, footer, [role=dialog]")) return false;
  const t = (b.innerText || b.getAttribute("aria-label") || "").toLowerCase();
  return !/cancel|return|reorder|add to cart|buy|remove|delete|tip|review|track|help|contact|sign/.test(t);
};

/** Expand every collapsed section on the order page so all items are visible. Only clicks disclosure toggles. */
export function expandAllSections(root: ParentNode = document): number {
  const main = (root as Document).querySelector?.("main") ?? root;
  const toggles = [...main.querySelectorAll<HTMLElement>('button[aria-expanded="false"], [role=button][aria-expanded="false"]')].filter(SAFE_TOGGLE);
  toggles.forEach((b) => b.click());
  return toggles.length;
}

/** Item names visible on the page (after expanding). */
export function visibleItemNames(root: ParentNode = document): string[] {
  return [...root.querySelectorAll<HTMLElement>('[data-testid="productName"]')].map((e) => e.innerText.trim()).filter(Boolean);
}

/** Cross-check: anything visible on the page that the parser did not capture becomes a warning. */
export function crossCheck(order: ParsedOrder, pageNames: string[]): string[] {
  if (!pageNames.length) return [];
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const parsed = new Set(order.items.flatMap((i) => [norm(i.name), ...(i.substitutedFor ? [norm(i.substitutedFor)] : [])]));
  const missing = [...new Set(pageNames.map(norm))].filter((n) => ![...parsed].some((p) => p.startsWith(n.slice(0, 40)) || n.startsWith(p.slice(0, 40))));
  return missing.map((n) => `Item on the page was not captured: "${n}"`);
}
