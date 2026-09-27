import { Hono } from "hono";
import { prisma } from "../db";
import type { AppEnv } from "../lib/session";

function startOfMonthJst(now = new Date()): Date {
  const jst = new Date(now.getTime() + 9 * 3_600_000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 3_600_000);
}

export const dashboardRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const [openDeals, submitted, wonThisMonth, recentMeetings, recentDeals] = await Promise.all([
    prisma.deal.count({ where: { status: "open" } }),
    prisma.quote.aggregate({ where: { status: "submitted" }, _count: true, _sum: { total: true } }),
    prisma.deal.count({ where: { status: "won", wonAt: { gte: startOfMonthJst() } } }),
    prisma.meeting.findMany({ include: { deal: true }, orderBy: { id: "desc" }, take: 5 }),
    prisma.deal.findMany({ include: { customer: true, salesRep: true }, orderBy: { updatedAt: "desc" }, take: 5 }),
  ]);
  return c.json({
    openDeals,
    submittedQuotes: { count: submitted._count, total: submitted._sum.total ?? 0 },
    wonThisMonth,
    recentMeetings,
    recentDeals,
  });
});
