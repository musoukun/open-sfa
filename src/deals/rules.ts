export const DEAL_STATUSES = ["open", "won", "lost"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const DEAL_STATUS_LABELS = {
  open: "進行中",
  won: "受注",
  lost: "失注",
} satisfies Record<DealStatus, string>;

// 進行中の案件が営業パイプラインのどこにいるか。受注・失注したらフェーズは使わない
export const DEAL_STAGES = ["plan", "visit", "proposal", "closing"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABELS = {
  plan: "計画",
  visit: "訪問",
  proposal: "提案",
  closing: "クロージング",
} satisfies Record<DealStage, string>;

export function canChangeStage(status: DealStatus): boolean {
  return status === "open";
}

// 案件の動きの記録。受注・失注もフェーズの移動と同じ並びで残す
export const DEAL_EVENT_KINDS = ["created", "stage", "won", "lost"] as const;
export type DealEventKind = (typeof DEAL_EVENT_KINDS)[number];

export type Movement = "new" | "forward" | "back" | "won" | "lost";

export const MOVEMENT_LABELS = {
  new: "新しい案件",
  forward: "前進",
  back: "後退",
  won: "受注",
  lost: "失注・消滅",
} satisfies Record<Movement, string>;

export function movementOf(kind: DealEventKind, fromStage: DealStage | null, toStage: DealStage | null): Movement {
  switch (kind) {
    case "created":
      return "new";
    case "won":
      return "won";
    case "lost":
      return "lost";
    case "stage":
      return DEAL_STAGES.indexOf(toStage!) > DEAL_STAGES.indexOf(fromStage!) ? "forward" : "back";
    default:
      return assertNever(kind);
  }
}

function assertNever(value: never): never {
  throw new Error(`unexpected value: ${String(value)}`);
}

type QuoteForAmount = { status: string; subtotal: number };

// 見込み金額（税抜）。入力が無ければ、最新の有効な見積の税抜金額を使う
export function expectedDealAmount(expectedAmount: number | null, quotesNewestFirst: QuoteForAmount[]): number | null {
  if (expectedAmount !== null) return expectedAmount;
  const quote = quotesNewestFirst.find((q) => q.status !== "declined" && q.status !== "expired");
  return quote ? quote.subtotal : null;
}

export const CONTRACT_TYPES = ["quasi_mandate", "contract_work"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_TYPE_LABELS = {
  quasi_mandate: "準委任",
  contract_work: "請負",
} satisfies Record<ContractType, string>;

// 受注・失注からは戻さない
export function canTransition(from: DealStatus, to: DealStatus): boolean {
  return from === "open" && to !== "open";
}

export function canAddContract(status: DealStatus, hasContract: boolean): boolean {
  return status === "won" && !hasContract;
}

export function canCreateQuote(status: DealStatus): boolean {
  return status === "open";
}
