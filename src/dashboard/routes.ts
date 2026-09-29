import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { validate } from "../lib/validate";
import type { AppEnv } from "../lib/session";
import { expectedDealAmount, movementOf, type DealEventKind, type DealStage } from "../deals/rules";
import { RECENT_MOVEMENT_DAYS } from "../config/sales";
import { fiscalYearOf, fiscalYearRange } from "../insights/rules";
import { buildPipeline } from "./pipeline";

const JST_OFFSET_MS = 9 * 3_600_000;

function startOfMonthJst(now = new Date()): Date {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - JST_OFFSET_MS);
}

const currentMonthJst = (now = new Date()) => new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 7);

const quotesForAmount = { select: { status: true, subtotal: true }, orderBy: { id: "desc" } } as const;

export const dashboardRoutes = new Hono<AppEnv>().get(
  "/",
  validate("query", z.object({ salesRepId: z.coerce.number().int().optional() })),
  async (c) => {
    const { salesRepId } = c.req.valid("query");
    const fiscalYear = fiscalYearOf(new Date());
    const fiscalRange = fiscalYearRange(fiscalYear);
    const wonSelect = { expectedAmount: true, contract: { select: { amount: true } }, quotes: quotesForAmount } as const;
    const [openDeals, submitted, wonDeals, recentMeetings, recentDeals, fiscalWonDeals, events] = await Promise.all([
      prisma.deal.findMany({
        where: { status: "open", salesRepId },
        select: { stage: true, expectedAmount: true, expectedCloseMonth: true, quotes: quotesForAmount },
      }),
      prisma.quote.aggregate({ where: { status: "submitted", deal: { salesRepId } }, _count: true, _sum: { total: true } }),
      prisma.deal.findMany({
        where: { status: "won", salesRepId, wonAt: { gte: startOfMonthJst() } },
        select: wonSelect,
      }),
      prisma.meeting.findMany({ where: { deal: { salesRepId } }, include: { deal: true }, orderBy: { id: "desc" }, take: 5 }),
      prisma.deal.findMany({ where: { salesRepId }, include: { customer: true, salesRep: true }, orderBy: { updatedAt: "desc" }, take: 5 }),
      prisma.deal.findMany({ where: { status: "won", salesRepId, wonAt: { gte: fiscalRange.from, lt: fiscalRange.to } }, select: wonSelect }),
      prisma.dealEvent.findMany({
        where: { createdAt: { gte: new Date(Date.now() - RECENT_MOVEMENT_DAYS * 86_400_000) }, deal: { salesRepId } },
        include: { deal: { select: { id: true, name: true, customer: { select: { companyName: true } } } } },
        orderBy: { id: "desc" },
      }),
    ]);

    // 受注した案件の金額は、契約概要があればその金額を使う
    const wonAmountOf = (list: typeof wonDeals) =>
      list.reduce(
        (sum, d) => sum + (d.contract?.amount ?? expectedDealAmount(d.expectedAmount, d.quotes.filter((q) => q.status === "accepted")) ?? 0),
        0,
      );
    const movements = events.map((e) => ({
      id: e.id,
      movement: movementOf(e.kind as DealEventKind, e.fromStage as DealStage | null, e.toStage as DealStage | null),
      fromStage: e.fromStage,
      toStage: e.toStage,
      changedByName: e.changedByName,
      createdAt: e.createdAt,
      deal: e.deal,
    }));

    return c.json({
      openDeals: openDeals.length,
      submittedQuotes: { count: submitted._count, total: submitted._sum.total ?? 0 },
      wonThisMonth: { count: wonDeals.length, amount: wonAmountOf(wonDeals) },
      wonThisFiscalYear: { fiscalYear, count: fiscalWonDeals.length, amount: wonAmountOf(fiscalWonDeals) },
      recentMovements: { days: RECENT_MOVEMENT_DAYS, items: movements },
      pipeline: {
        currentMonth: currentMonthJst(),
        ...buildPipeline(
          openDeals.map((d) => ({ ...d, stage: d.stage as DealStage })),
          currentMonthJst(),
        ),
      },
      recentMeetings,
      recentDeals,
    });
  },
);
