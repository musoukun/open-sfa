import {
  QUOTE_NUMBER_DIGITS,
  QUOTE_NUMBER_PREFIX,
  TAX_ROUNDING,
  type TaxRounding,
} from "../config/business";

export const QUOTE_STATUSES = ["draft", "submitted", "accepted", "declined", "expired"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS = {
  draft: "作成中",
  submitted: "提出済み",
  accepted: "承諾",
  declined: "辞退",
  expired: "期限切れ",
} satisfies Record<QuoteStatus, string>;

const ALLOWED_TRANSITIONS = {
  draft: ["submitted"],
  submitted: ["accepted", "declined", "expired"],
  accepted: [],
  declined: [],
  expired: [],
} satisfies Record<QuoteStatus, readonly QuoteStatus[]>;

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] as readonly QuoteStatus[]).includes(to);
}

export function nextStatuses(from: QuoteStatus): readonly QuoteStatus[] {
  return ALLOWED_TRANSITIONS[from];
}

export function isEditable(status: QuoteStatus): boolean {
  return status === "draft";
}

export type LineInput = { quantity: number; unitPrice: number };

// 数量は 0.5 人月のような小数を許すので、行金額は円未満を四捨五入する
export function lineAmount(line: LineInput): number {
  return Math.round(line.quantity * line.unitPrice);
}

function roundYen(value: number, mode: TaxRounding): number {
  switch (mode) {
    case "floor":
      return Math.floor(value);
    case "round":
      return Math.round(value);
    case "ceil":
      return Math.ceil(value);
    default:
      return assertNever(mode);
  }
}

function assertNever(value: never): never {
  throw new Error(`unexpected value: ${String(value)}`);
}

export function calcTotals(lines: LineInput[], taxRatePercent: number, rounding: TaxRounding = TAX_ROUNDING) {
  const subtotal = lines.reduce((sum, l) => sum + lineAmount(l), 0);
  const tax = roundYen((subtotal * taxRatePercent) / 100, rounding);
  return { subtotal, tax, total: subtotal + tax };
}

export function formatQuoteNumber(id: number): string {
  return QUOTE_NUMBER_PREFIX + String(id).padStart(QUOTE_NUMBER_DIGITS, "0");
}
