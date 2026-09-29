import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { choiceOrEmpty, validate } from "../lib/validate";
import { RuleViolation, VersionConflict, type AppEnv } from "../lib/session";
import { DEAL_SOURCES, LOST_REASONS } from "../config/sales";
import { CONTRACT_TYPES, DEAL_STAGES, DEAL_STATUSES, canAddContract, canChangeStage, canTransition, type DealStage, type DealStatus } from "./rules";
import { dealEvent } from "./events";

const idParam = z.object({ id: z.coerce.number().int() });
const dateString = z.iso.date("日付は YYYY-MM-DD で入力してください");

const createDealSchema = z.object({
  customerId: z.number().int(),
  name: z.string().trim().min(1, "案件名は必須です"),
  salesRepId: z.number({ error: "営業担当を選んでください" }).int(),
  source: choiceOrEmpty(DEAL_SOURCES, "きっかけの選び方が正しくありません"),
});

const updateDealSchema = createDealSchema.omit({ customerId: true }).extend({
  expectedAmount: z.number().int().nonnegative("見込み金額は0以上で入力してください").nullable().default(null),
  expectedCloseMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "受注予定月は YYYY-MM で入力してください")
    .nullable()
    .default(null),
  version: z.number().int(),
});

const stageSchema = z.object({ stage: z.enum(DEAL_STAGES), version: z.number().int() });

const statusSchema = z
  .object({
    to: z.enum(DEAL_STATUSES),
    version: z.number().int(),
    lostReason: choiceOrEmpty(LOST_REASONS, "失注の理由の選び方が正しくありません"),
    lostNote: z.string().trim().max(2000).default(""),
  })
  // 失注（消滅）は理由を残し、どこを補強すべきかを後で振り返れるようにする
  .refine((v) => v.to !== "lost" || v.lostReason !== "", { message: "失注の理由を選んでください" });

const contractSchema = z
  .object({
    contractType: z.enum(CONTRACT_TYPES, { error: "契約形態を選んでください" }),
    startDate: dateString,
    endDate: dateString,
    amount: z.number().int().nonnegative("金額は0以上で入力してください"),
    sourceQuoteId: z.number().int().optional(),
  })
  .refine((v) => v.startDate <= v.endDate, { message: "終了日は開始日以降にしてください" });

async function assertActiveMember(id: number) {
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member?.isActive) throw new RuleViolation("無効なメンバーは営業担当に選べません");
}

async function findDeal(id: number) {
  const deal = await prisma.deal.findUnique({ where: { id }, include: { contract: true } });
  if (!deal) throw new RuleViolation("案件が見つかりません");
  return deal;
}

export const dealsRoutes = new Hono<AppEnv>()
  .get(
    "/",
    validate(
      "query",
      z.object({
        salesRepId: z.coerce.number().int().optional(),
        status: z.enum(DEAL_STATUSES).optional(),
        stage: z.enum(DEAL_STAGES).optional(),
      }),
    ),
    async (c) => {
      const { salesRepId, status, stage } = c.req.valid("query");
      const deals = await prisma.deal.findMany({
        where: { salesRepId, status, stage },
        include: {
          customer: true,
          salesRep: true,
          overview: { select: { cooperationLevel: true, riskLevel: true } },
          quotes: { select: { status: true, subtotal: true }, orderBy: { id: "desc" } },
        },
        orderBy: { updatedAt: "desc" },
      });
      return c.json(deals);
    },
  )
  .get("/:id", validate("param", idParam), async (c) => {
    const deal = await prisma.deal.findUnique({
      where: { id: c.req.valid("param").id },
      include: {
        customer: true,
        salesRep: true,
        contract: true,
        quotes: { orderBy: { id: "desc" } },
        meetings: { orderBy: [{ meetingDate: "desc" }, { id: "desc" }] },
        overview: true,
        events: { orderBy: { id: "desc" } },
      },
    });
    if (!deal) return c.json({ error: "案件が見つかりません" }, 404);
    // 同じ業種・同じきっかけの過去の案件。うまくいった提案を横に広げる手がかりにする
    const similar =
      deal.customer.industry && deal.source
        ? await prisma.deal.findMany({
            where: { id: { not: deal.id }, source: deal.source, customer: { industry: deal.customer.industry } },
            select: { id: true, name: true, status: true, stage: true, lostReason: true, customer: { select: { companyName: true } }, salesRep: { select: { name: true } } },
            orderBy: { updatedAt: "desc" },
            take: 10,
          })
        : [];
    return c.json({ ...deal, similar });
  })
  .post("/", validate("json", createDealSchema), async (c) => {
    const input = c.req.valid("json");
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new RuleViolation("顧客が見つかりません");
    if (customer.archivedAt) throw new RuleViolation("アーカイブ済みの顧客には案件を作れません");
    await assertActiveMember(input.salesRepId);
    const user = c.get("user");
    const deal = await prisma.$transaction(async (tx) => {
      const created = await tx.deal.create({ data: input });
      await tx.dealEvent.create({ data: dealEvent(created.id, "created", null, created.stage as DealStage, user) });
      return created;
    });
    return c.json(deal, 201);
  })
  .patch("/:id", validate("param", idParam), validate("json", updateDealSchema), async (c) => {
    const { id } = c.req.valid("param");
    const { version, ...input } = c.req.valid("json");
    const current = await findDeal(id);
    if (current.salesRepId !== input.salesRepId) await assertActiveMember(input.salesRepId);
    const result = await prisma.deal.updateMany({
      where: { id, version },
      data: { ...input, version: { increment: 1 } },
    });
    if (result.count !== 1) throw new VersionConflict();
    return c.json({ ok: true });
  })
  .post("/:id/status", validate("param", idParam), validate("json", statusSchema), async (c) => {
    const { id } = c.req.valid("param");
    const { to, version, lostReason, lostNote } = c.req.valid("json");
    const deal = await findDeal(id);
    if (to === "open" || !canTransition(deal.status as DealStatus, to)) throw new RuleViolation("この状態には変更できません");
    const user = c.get("user");
    await prisma.$transaction(async (tx) => {
      const result = await tx.deal.updateMany({
        where: { id, version },
        data: {
          status: to,
          wonAt: to === "won" ? new Date() : undefined,
          lostAt: to === "lost" ? new Date() : undefined,
          lostReason: to === "lost" ? lostReason : undefined,
          lostNote: to === "lost" ? lostNote : undefined,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new VersionConflict();
      // 受注・失注したフェーズを残し、どこで決着したかを振り返れるようにする
      await tx.dealEvent.create({ data: dealEvent(id, to, deal.stage as DealStage, null, user) });
    });
    return c.json({ ok: true });
  })
  .post("/:id/stage", validate("param", idParam), validate("json", stageSchema), async (c) => {
    const { id } = c.req.valid("param");
    const { stage, version } = c.req.valid("json");
    const deal = await findDeal(id);
    if (!canChangeStage(deal.status as DealStatus)) throw new RuleViolation("フェーズを変えられるのは進行中の案件だけです");
    if (deal.stage === stage) return c.json({ ok: true });
    const user = c.get("user");
    await prisma.$transaction(async (tx) => {
      const result = await tx.deal.updateMany({
        where: { id, version },
        data: { stage, stageChangedAt: new Date(), version: { increment: 1 } },
      });
      if (result.count !== 1) throw new VersionConflict();
      await tx.dealEvent.create({ data: dealEvent(id, "stage", deal.stage as DealStage, stage, user) });
    });
    return c.json({ ok: true });
  })
  .post("/:id/contract", validate("param", idParam), validate("json", contractSchema), async (c) => {
    const { id } = c.req.valid("param");
    const deal = await findDeal(id);
    if (!canAddContract(deal.status as DealStatus, deal.contract !== null)) {
      throw new RuleViolation("契約概要は受注した案件に1件だけ登録できます");
    }
    const contract = await prisma.dealContract.create({ data: { ...c.req.valid("json"), dealId: id } });
    return c.json(contract, 201);
  });
