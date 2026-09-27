export const DEAL_STATUSES = ["open", "won", "lost"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const DEAL_STATUS_LABELS = {
  open: "進行中",
  won: "受注",
  lost: "失注",
} satisfies Record<DealStatus, string>;

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
