import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { validate } from "../lib/validate";
import { RuleViolation, VersionConflict, type AppEnv } from "../lib/session";
import { CONTRACT_TYPES, DEAL_STATUSES, canAddContract, canTransition, type DealStatus } from "./rules";

const idParam = z.object({ id: z.coerce.number().int() });
const dateString = z.iso.date("日付は YYYY-MM-DD で入力してください");

const createDealSchema = z.object({
  customerId: z.number().int(),
  name: z.string().trim().min(1, "案件名は必須です"),
  salesRepId: z.number({ error: "営業担当を選んでください" }).int(),
});

const updateDealSchema = createDealSchema.omit({ customerId: true }).extend({ version: z.number().int() });

const statusSchema = z.object({ to: z.enum(DEAL_STATUSES), version: z.number().int() });

const contractSchema = z
  .object({
    contractType: z.enum(CONTRACT_TYPES, { error: "契約形態を選んでください" }),
    startDate: dateString,
    endDate: dateString,
    amount: z.number().int().nonnegative("金額は0以上で入力してください"),
    sourceQuoteId: z.number().int().optional(),
  })
  .refine((v) => v.startDate <= v.endDate, { message: "終了日は開始日以降にしてください" });

const noteSchema = z.object({
  meetingDate: dateString,
  content: z.string().trim().min(1, "内容は必須です"),
});

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
    validate("query", z.object({ salesRepId: z.coerce.number().int().optional(), status: z.enum(DEAL_STATUSES).optional() })),
    async (c) => {
      const { salesRepId, status } = c.req.valid("query");
      const deals = await prisma.deal.findMany({
        where: { salesRepId, status },
        include: { customer: true, salesRep: true },
        orderBy: { updatedAt: "desc" },
      });
      return c.json(deals);
    },
  )
  .post("/", validate("json", createDealSchema), async (c) => {
    const input = c.req.valid("json");
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new RuleViolation("顧客が見つかりません");
    if (customer.archivedAt) throw new RuleViolation("アーカイブ済みの顧客には案件を作れません");
    await assertActiveMember(input.salesRepId);
    const deal = await prisma.deal.create({ data: input });
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
    const { to, version } = c.req.valid("json");
    const deal = await findDeal(id);
    if (!canTransition(deal.status as DealStatus, to)) throw new RuleViolation("この状態には変更できません");
    const result = await prisma.deal.updateMany({
      where: { id, version },
      data: {
        status: to,
        wonAt: to === "won" ? new Date() : undefined,
        lostAt: to === "lost" ? new Date() : undefined,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new VersionConflict();
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
  })
  .post("/:id/notes", validate("param", idParam), validate("json", noteSchema), async (c) => {
    const { id } = c.req.valid("param");
    await findDeal(id);
    const user = c.get("user");
    const note = await prisma.meetingNote.create({
      data: { ...c.req.valid("json"), dealId: id, authorId: user.id, authorName: user.name },
    });
    return c.json(note, 201);
  });
