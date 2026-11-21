/** All money is integer cents. */
export type Cents = number;
export type MemberId = string;

export type SplitMethod = "equal" | "parts" | "amount";

/** One Member's participation in an Item or Expense split. */
export interface Share {
  memberId: MemberId;
  /** Used when method = "parts". Defaults to 1. */
  parts?: number;
  /** Used when method = "amount". */
  amount?: Cents;
}

export interface Split {
  method: SplitMethod;
  shares: Share[];
}

export type FulfillmentKind = "shipping" | "delivery" | "pickup" | "other";

export interface Fulfillment {
  id: string;
  label: string;
  kind: FulfillmentKind;
}

export type ItemStatus = "ok" | "refunded" | "unavailable" | "substituted";

export interface Item {
  /** Stable key used to match the same Item across Processings. */
  key: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  /** What this Item line costs after refunds (0 when refunded/unavailable). */
  amount: Cents;
  fulfillmentId: string | null;
  status: ItemStatus;
  /** For substitutions: what was originally ordered. */
  substitutedFor?: string;
}

/** "discount" Fees are negative (promo codes) and are always shared in proportion to Item totals. */
export type FeeKind = "delivery" | "shipping" | "tip" | "bag" | "discount" | "other";

export interface Fee {
  key: string;
  label: string;
  kind: FeeKind;
  amount: Cents;
  /** null = belongs to the whole Order. */
  fulfillmentId: string | null;
}

export interface PaymentCard {
  brand: string;
  last4: string;
}

/** What the parser read from a Walmart order details page. */
export interface ParsedOrder {
  orderNumber: string;
  placedAt: string | null; // ISO date
  sourceUrl: string;
  fulfillments: Fulfillment[];
  items: Item[];
  fees: Fee[];
  subtotal: Cents | null;
  tax: Cents;
  total: Cents | null;
  paymentCards: PaymentCard[];
  /** Anything the parser could not interpret, for human review. */
  warnings: string[];
}

export type TaxRule = "proportional" | "equal";
export type FeeRule = "equal" | "proportional";

export interface SplitRules {
  tax: TaxRule;
  fees: FeeRule;
}

export const DEFAULT_SPLIT_RULES: SplitRules = { tax: "proportional", fees: "equal" };

/** Item key -> Split. */
export type Assignments = Record<string, Split>;
