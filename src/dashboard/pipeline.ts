import { DEAL_STAGES, expectedDealAmount, type DealStage } from "../deals/rules";

export const PIPELINE_MONTHS_AHEAD = 6;

export type PipelineDeal = {
  stage: DealStage;
  expectedAmount: number | null;
  expectedCloseMonth: string | null;
  quotes: { status: string; subtotal: number }[];
};

type Cell = { count: number; amount: number };
const emptyCell = (): Cell => ({ count: 0, amount: 0 });
const emptyStages = () => Object.fromEntries(DEAL_STAGES.map((s) => [s, emptyCell()])) as Record<DealStage, Cell>;

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// 受注予定月の列: 期限切れ・今月から6か月・それより先・未定
export function monthBuckets(currentMonth: string) {
  const months = Array.from({ length: PIPELINE_MONTHS_AHEAD }, (_, i) => addMonths(currentMonth, i));
  return [
    { key: "overdue", label: "予定を過ぎた" },
    ...months.map((m) => ({ key: m, label: `${Number(m.slice(5))}月` })),
    { key: "later", label: "それより先" },
    { key: "none", label: "未定" },
  ];
}

function bucketOf(expectedCloseMonth: string | null, currentMonth: string): string {
  if (!expectedCloseMonth) return "none";
  if (expectedCloseMonth < currentMonth) return "overdue";
  if (expectedCloseMonth > addMonths(currentMonth, PIPELINE_MONTHS_AHEAD - 1)) return "later";
  return expectedCloseMonth;
}

export function buildPipeline(deals: PipelineDeal[], currentMonth: string) {
  const stages = emptyStages();
  const unpriced = Object.fromEntries(DEAL_STAGES.map((s) => [s, 0])) as Record<DealStage, number>;
  const buckets = monthBuckets(currentMonth).map((b) => ({ ...b, stages: emptyStages() }));
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const deal of deals) {
    const amount = expectedDealAmount(deal.expectedAmount, deal.quotes);
    if (amount === null) unpriced[deal.stage]++;
    for (const cell of [stages[deal.stage], byKey.get(bucketOf(deal.expectedCloseMonth, currentMonth))!.stages[deal.stage]]) {
      cell.count++;
      cell.amount += amount ?? 0;
    }
  }

  return {
    stages: DEAL_STAGES.map((stage) => ({ stage, ...stages[stage], unpriced: unpriced[stage] })),
    months: buckets.map((b) => ({ key: b.key, label: b.label, stages: DEAL_STAGES.map((stage) => ({ stage, ...b.stages[stage] })) })),
  };
}
