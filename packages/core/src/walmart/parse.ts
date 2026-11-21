import type { Cents, Fee, Fulfillment, FulfillmentKind, Item, ItemStatus, ParsedOrder, PaymentCard } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export const toCents = (dollars: number | null | undefined): Cents => Math.round((dollars ?? 0) * 100);
const val = (x: Json): number | null => (x && typeof x === "object" ? (typeof x.value === "number" ? x.value : null) : typeof x === "number" ? x : null);

/** Pull the Walmart order object out of a full order-details HTML page. */
export function extractOrderJsonFromHtml(html: string): Json {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find order data on the page (no __NEXT_DATA__). Are you signed in to Walmart?");
  const next = JSON.parse(m[1]!);
  const order = next?.props?.pageProps?.initialData?.data?.order;
  if (!order) throw new Error("The page does not contain an order. Open a single order's details page.");
  return order;
}

function fulfillmentKind(g: Json): FulfillmentKind {
  const t = `${g.fulfillmentType ?? ""} ${g.detailedGroupType ?? ""}`.toUpperCase();
  if (t.includes("PICKUP")) return "pickup";
  if (t.startsWith("SC_") || t.includes("DFS")) return "delivery"; // delivery from store
  if (t.startsWith("FC_") || t.includes("PARCEL") || t.includes("SHIP")) return "shipping";
  return "other";
}

function fulfillmentLabel(g: Json, kind: FulfillmentKind): string {
  const msg = typeof g.deliveryMessage === "string" ? g.deliveryMessage : null;
  const seller = g.seller?.name && g.seller.name !== "Walmart.com" ? g.seller.name : null;
  if (kind === "shipping") return seller ? `Shipped by ${seller}` : msg ?? "Shipping";
  if (kind === "pickup") return msg ?? "Pickup";
  if (kind === "delivery") return msg ?? "Delivery from store";
  return msg ?? g.fulfillmentType ?? "Fulfillment";
}

const ZERO_CATEGORIES: Record<string, ItemStatus> = {
  UNAVAILABLE: "unavailable",
  CANCELED: "unavailable",
  CANCELLED: "unavailable",
  RETURNED: "refunded",
};

function itemName(i: Json): string {
  return String(i?.productInfo?.name ?? i?.productInfo?.shortDescription ?? "Unknown item").trim();
}

/** Parse a Walmart order JSON object (data.order) into our ParsedOrder. */
export function parseWalmartOrder(order: Json, sourceUrl = ""): ParsedOrder {
  const warnings: string[] = [];
  const pd = order.priceDetails ?? {};
  const groups: Json[] = order.groups_2101 ?? order.groups ?? [];
  const fulfillments: Fulfillment[] = [];
  const items: Item[] = [];
  const seenKeys = new Set<string>();
  let refundedItemsCents = 0;

  groups.forEach((g, gi) => {
    const kind = fulfillmentKind(g);
    const fid = `${gi}:${g.purchaseOrderId ?? g.id ?? gi}`;
    fulfillments.push({ id: fid, label: fulfillmentLabel(g, kind), kind });

    // Prefer categories (they carry status). Fall back to the flat list.
    const cats: Json[] = g.categories?.length ? g.categories : [{ type: "REGULAR", items: g.items ?? [] }];
    const catItemCount = cats.reduce((s, c) => s + (c.items?.length ?? 0), 0);
    if (g.items && catItemCount !== g.items.length) {
      warnings.push(`${fulfillmentLabel(g, kind)}: ${g.items.length} items listed but ${catItemCount} in sections`);
    }
    for (const c of cats) {
      const type = String(c.type ?? "REGULAR").toUpperCase();
      const zeroStatus = ZERO_CATEGORIES[type];
      const originals: Json[] = c.substitutions ?? [];
      (c.items ?? []).forEach((i: Json, idx: number) => {
        const line = val(i.priceInfo?.linePrice);
        if (line === null) warnings.push(`No price for "${itemName(i)}"`);
        const full = toCents(line);
        let status: ItemStatus = zeroStatus ?? (type === "SUBSTITUTED" ? "substituted" : "ok");
        if (!zeroStatus && String(i.statusCode ?? "").startsWith("9000")) status = "unavailable";
        const amount = status === "unavailable" || status === "refunded" ? 0 : full;
        if (status === "refunded") refundedItemsCents += full;
        let key = `${fid}:${i.id ?? idx}:${i.productInfo?.usItemId ?? ""}`;
        if (seenKeys.has(key)) key = `${key}:${type}`;
        seenKeys.add(key);
        const item: Item = {
          key,
          name: itemName(i),
          quantity: typeof i.quantity === "number" ? i.quantity : Number(i.quantity ?? 1),
          amount,
          fulfillmentId: fid,
          status,
        };
        const img = i.productInfo?.imageInfo?.thumbnailUrl;
        if (img) item.imageUrl = img;
        if (status === "substituted") {
          const orig = originals[idx] ?? originals[0];
          if (orig) item.substitutedFor = itemName(orig);
        }
        items.push(item);
      });
    }
  });

  // Fees
  const fees: Fee[] = [];
  const findGroup = (pred: (f: Fulfillment) => boolean): string | null => {
    const m = fulfillments.filter(pred);
    return m.length === 1 ? m[0]!.id : null;
  };
  (pd.fees ?? []).forEach((f: Json, i: number) => {
    const amount = toCents(val(f));
    if (!amount) return;
    const label = String(f.label ?? "Fee");
    const l = label.toLowerCase();
    let fulfillmentId: string | null = null;
    let kind: Fee["kind"] = "other";
    if (/ship/.test(l)) {
      kind = "shipping";
      fulfillmentId = findGroup((x) => x.kind === "shipping");
    } else if (/deliver|hour|express|store/.test(l)) {
      kind = "delivery";
      fulfillmentId = findGroup((x) => x.kind === "delivery");
    } else if (/bag/.test(l)) {
      kind = "bag";
      fulfillmentId = findGroup((x) => x.kind === "delivery" || x.kind === "pickup");
    }
    fees.push({ key: `fee:${i}:${label}`, label, kind, amount, fulfillmentId });
  });
  for (const extra of [pd.belowMinimumFee]) {
    const amount = toCents(val(extra));
    if (amount) fees.push({ key: `fee:min:${extra.label}`, label: extra.label ?? "Below minimum fee", kind: "other", amount, fulfillmentId: findGroup((x) => x.kind === "delivery") });
  }
  const tip = toCents(val(pd.driverTip));
  if (tip) {
    const tippableId = order.tippableGroup?.id;
    const gi = tippableId ? groups.findIndex((g) => g.id === tippableId) : -1;
    const fid = gi >= 0 ? fulfillments[gi]!.id : findGroup((x) => x.kind === "delivery");
    fees.push({ key: "tip", label: pd.driverTip.label ?? "Driver tip", kind: "tip", amount: tip, fulfillmentId: fid });
  }
  // Some promo discounts are already baked into Item line prices; only add them as a Fee when they are not.
  const itemsCents = items.reduce((s, i) => s + i.amount, 0) + refundedItemsCents;
  const discountCents = (pd.discounts ?? []).reduce((s: number, d: Json) => s + Math.abs(toCents(val(d))), 0);
  const subtotalCents = val(pd.subTotal) === null ? null : toCents(val(pd.subTotal));
  const discountsInLines = discountCents > 0 && subtotalCents !== null && itemsCents === subtotalCents - discountCents;
  (pd.discounts ?? []).forEach((d: Json, i: number) => {
    const amount = toCents(val(d));
    if (!amount || discountsInLines) return;
    fees.push({ key: `discount:${i}:${d.label}`, label: String(d.label ?? "Discount"), kind: "discount", amount: -Math.abs(amount), fulfillmentId: null });
  });

  // Tax: subtract the tax part of any refund (refund = refunded items + their tax).
  let tax = toCents(val(pd.taxTotal));
  const refunds: Json[] = Array.isArray(pd.refund) ? pd.refund : pd.refund ? [pd.refund] : [];
  const refundCents = refunds.reduce((s, r) => s + Math.abs(toCents(val(r))), 0);
  if (refundCents) {
    const taxRefund = refundCents - refundedItemsCents;
    if (taxRefund >= 0 && taxRefund <= tax) tax -= taxRefund;
    else warnings.push(`Refund of ${refundCents}¢ does not match returned items (${refundedItemsCents}¢); check tax manually`);
  }

  const paymentCards: PaymentCard[] = (order.paymentMethods ?? []).map((p: Json) => ({
    brand: String(p.title ?? p.cardType ?? p.paymentType ?? "Card"),
    last4: String(p.description ?? "").match(/(\d{4})\s*$/)?.[1] ?? "",
  }));

  const total = val(pd.grandTotalWithTips) ?? val(pd.grandTotal);
  const parsed: ParsedOrder = {
    orderNumber: String(order.id ?? ""),
    placedAt: order.orderDate ?? null,
    sourceUrl,
    fulfillments,
    items,
    fees,
    subtotal: val(pd.subTotal) === null ? null : toCents(val(pd.subTotal)),
    tax,
    total: total === null ? null : toCents(total),
    paymentCards,
    warnings,
  };
  const check = reconcile(parsed);
  if (check !== 0) warnings.push(`Parsed amounts differ from Walmart's total by ${check}¢`);
  return parsed;
}

/** items + tax + fees − Walmart total. 0 means the parse accounts for every cent. */
export function reconcile(o: ParsedOrder): Cents {
  if (o.total === null) return 0;
  const sum = o.items.reduce((s, i) => s + i.amount, 0) + o.tax + o.fees.reduce((s, f) => s + f.amount, 0);
  return sum - o.total;
}
