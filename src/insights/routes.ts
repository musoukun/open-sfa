import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { validate } from "../lib/validate";
import type { AppEnv } from "../lib/session";
import { DEAL_SOURCES, INDUSTRIES, LOST_REASONS } from "../config/sales";
import { expectedDealAmount, type DealStage, type DealStatus } from "../deals/rules";
import { fiscalYearOf, fiscalYearRange, lostByStage, summarizeOutcomes } from "./rules";

// 振り返り: その年度に動いた案件（作成・受注・失注のどれかが年度内）を、業種・きっかけ・脱落フェーズで集計する
export const insightsRoutes = new Hono<AppEnv>().get(
  "/",
  validate("query", z.object({ fiscalYear: z.coerce.number().int().optional(), salesRepId: z.coerce.number().int().optional() })),
  async (c) => {
    const { salesRepId } = c.req.valid("query");
    const fiscalYear = c.req.valid("query").fiscalYear ?? fiscalYearOf(new Date());
    const { from, to } = fiscalYearRange(fiscalYear);
    const inYear = { gte: from, lt: to };

    const deals = await prisma.deal.findMany({
      where: { salesRepId, OR: [{ createdAt: inYear }, { wonAt: inYear }, { lostAt: inYear }] },
      select: {
        status: true,
        stage: true,
        source: true,
        lostReason: true,
        expectedAmount: true,
        customer: { select: { industry: true } },
        contract: { select: { amount: true } },
        quotes: { select: { status: true, subtotal: true }, orderBy: { id: "desc" } },
      },
    });

    const withAmount = deals.map((d) => ({
      ...d,
      status: d.status as DealStatus,
      stage: d.stage as DealStage,
      amount: d.contract?.amount ?? expectedDealAmount(d.expectedAmount, d.quotes),
    }));
    const lost = withAmount.filter((d) => d.status === "lost");

    return c.json({
      fiscalYear,
      byIndustry: summarizeOutcomes(
        withAmount.map((d) => ({ ...d, key: d.customer.industry })),
        [...Object.keys(INDUSTRIES), ""],
      ),
      bySource: summarizeOutcomes(
        withAmount.map((d) => ({ ...d, key: d.source })),
        [...Object.keys(DEAL_SOURCES), ""],
      ),
      lostByStage: lostByStage(withAmount),
      lostByReason: Object.keys(LOST_REASONS)
        .map((reason) => ({ reason, count: lost.filter((d) => d.lostReason === reason).length }))
        .filter((r) => r.count > 0),
    });
  },
);
