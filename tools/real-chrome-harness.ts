// Bundled to an IIFE and injected into the user's real Chrome via AppleScript.
// Uses the exact same parsing/expansion code as the extension's content script.
import { crossCheck, expandAllSections, orderIdFromPath, parseOrderHtml, visibleItemNames } from "../apps/extension/src/walmartPage";
import { reconcile } from "@billsplit/core/walmart";

(window as any).__billsplit = {
  /** Fetch + parse an order (sync XHR so AppleScript can read the result). */
  parse(id: string) {
    const x = new XMLHttpRequest();
    x.open("GET", `/orders/${id}`, false);
    x.send();
    const order = parseOrderHtml(x.responseText, `https://www.walmart.com/orders/${id}`);
    return JSON.stringify({ order, reconcile: reconcile(order) });
  },
  expand() {
    return JSON.stringify({ clicked: expandAllSections(), before: document.querySelectorAll('[data-testid="productName"]').length });
  },
  check() {
    const id = orderIdFromPath(location.pathname)!;
    const x = new XMLHttpRequest();
    x.open("GET", `/orders/${id}`, false);
    x.send();
    const order = parseOrderHtml(x.responseText, location.href);
    const names = visibleItemNames();
    return JSON.stringify({ id, parsedLines: order.items.length, pageTiles: names.length, warnings: [...order.warnings, ...crossCheck(order, names)], collapsedLeft: document.querySelectorAll('main button[aria-expanded="false"]').length });
  },
};
"ok";
