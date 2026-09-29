import { FISCAL_YEAR_START_MONTH } from "../config/sales";
import { DEAL_STAGES, type DealStage, type DealStatus } from "../deals/rules";

const JST_OFFSET_MS = 9 * 3_600_000;

// 年度は開始月の年で呼ぶ（4月始まりなら 2026年4月〜2027年3月 が 2026年度）
export function fiscalYearOf(date: Date): number {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const month = jst.getUTCMonth() + 1;
  return month >= FISCAL_YEAR_START_MONTH ? jst.getUTCFullYear() : jst.getUTCFullYear() - 1;
}

export function fiscalYearRange(fiscalYear: number): { from: Date; to: Date } {
  const from = new Date(Date.UTC(fiscalYear, FISCAL_YEAR_START_MONTH - 1, 1) - JST_OFFSET_MS);
  const to = new Date(Date.UTC(fiscalYear + 1, FISCAL_YEAR_START_MONTH - 1, 1) - JST_OFFSET_MS);
  return { from, to };
}

export type OutcomeDeal = {
  key: string;
  status: DealStatus;
  stage: DealStage;
  amount: number | null;
};

export type OutcomeRow = { key: string; total: number; open: number; won: number; lost: number; wonAmount: number; winRate: number | null };

// 業種別・きっかけ別などの成績。受注率は「決着した案件（受注＋失注）のうち受注した割合」
export function summarizeOutcomes(deals: OutcomeDeal[], keys: readonly string[]): OutcomeRow[] {
  const rows = new Map(keys.map((k) => [k, { key: k, total: 0, open: 0, won: 0, lost: 0, wonAmount: 0, winRate: null as number | null }]));
  for (const d of deals) {
    const row = rows.get(d.key) ?? rows.get("")!;
    row.total++;
    row[d.status]++;
    if (d.status === "won") row.wonAmount += d.amount ?? 0;
  }
  for (const row of rows.values()) {
    const decided = row.won + row.lost;
    row.winRate = decided === 0 ? null : row.won / decided;
  }
  return [...rows.values()].filter((r) => r.total > 0);
}

// どのフェーズで失注（消滅）しているか
export function lostByStage(deals: Pick<OutcomeDeal, "status" | "stage">[]): { stage: DealStage; count: number }[] {
  return DEAL_STAGES.map((stage) => ({ stage, count: deals.filter((d) => d.status === "lost" && d.stage === stage).length }));
}
