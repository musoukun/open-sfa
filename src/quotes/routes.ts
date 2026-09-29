import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { validate } from "../lib/validate";
import { RuleViolation, VersionConflict, type AppEnv } from "../lib/session";
import { DEFAULT_QUOTE_UNIT, TAX_RATE_PERCENT } from "../config/business";
import { canCreateQuote, type DealStage, type DealStatus } from "../deals/rules";
import { dealEvent } from "../deals/events";
import {
  QUOTE_STATUSES,
  calcTotals,
  canTransition,
  formatQuoteNumber,
  isEditable,
  lineAmount,
  type QuoteStatus,
} from "./rules";

const idParam = z.object({ id: z.coerce.number().int() });

const lineSchema = z.object({
  description: z.string().trim().min(1, "明細の作業内容は必須です"),
  quantity: z.number({ error: "数量は数値で入力してください" }).positive("数量は0より大きくしてください"),
  unit: z.string().trim().min(1).default(DEFAULT_QUOTE_UNIT),
  unitPrice: z.number({ error: "単価は数値で入力してください" }).int().nonnegative("単価は0以上で入力してください"),
  assigneeId: z.number().int().optional(),
});

const quoteBodySchema = z.object({
  title: z.string().trim().min(1, "件名は必須です"),
  validUntil: z.iso.date("有効期限は YYYY-MM-DD で入力してください").optional(),
  lines: z.array(lineSchema).min(1, "明細を1行以上入力してください"),
});

const createQuoteSchema = quoteBodySchema.extend({ dealId: z.number().int() });
const updateQuoteSchema = quoteBodySchema.extend({ version: z.number().int() });
const statusSchema = z.object({ to: z.enum(QUOTE_STATUSES), version: z.number().int() });

type LineBody = z.infer<typeof lineSchema>;

function toLineRows(lines: LineBody[]) {
  return lines.map((line, i) => ({ ...line, lineNo: i + 1, amount: lineAmount(line) }));
}

async function assertActiveAssignees(lines: LineBody[]) {
  const ids = [...new Set(lines.flatMap((l) => (l.assigneeId === undefined ? [] : [l.assigneeId])))];
  if (ids.length === 0) return;
  const active = await prisma.member.count({ where: { id: { in: ids }, isActive: true } });
  if (active !== ids.length) throw new RuleViolation("無効なメンバーは作業担当に選べません");
}

async function findQuote(id: number) {
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) throw new RuleViolation("見積が見つかりません");
  return quote;
}

export const quotesRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const quotes = await prisma.quote.findMany({
      include: { deal: { include: { customer: true } } },
      orderBy: { id: "desc" },
    });
    return c.json(quotes);
  })
  .get("/:id", validate("param", idParam), async (c) => {
    const quote = await prisma.quote.findUnique({
      where: { id: c.req.valid("param").id },
      include: {
        deal: { include: { customer: true } },
        lines: { include: { assignee: true }, orderBy: { lineNo: "asc" } },
        history: { orderBy: { id: "desc" } },
      },
    });
    return quote ? c.json(quote) : c.json({ error: "見積が見つかりません" }, 404);
  })
  .post("/", validate("json", createQuoteSchema), async (c) => {
    const { dealId, lines, ...input } = c.req.valid("json");
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new RuleViolation("案件が見つかりません");
    if (!canCreateQuote(deal.status as DealStatus)) throw new RuleViolation("見積は進行中の案件にだけ作れます");
    await assertActiveAssignees(lines);

    const taxRate = TAX_RATE_PERCENT;
    const user = c.get("user");
    const quote = await prisma.$transaction(async (tx) => {
      const created = await tx.quote.create({
        data: {
          ...input,
          dealId,
          taxRate,
          ...calcTotals(lines, taxRate),
          createdById: user.id,
          lines: { create: toLineRows(lines) },
          history: { create: { toStatus: "draft", changedById: user.id, changedByName: user.name } },
        },
      });
      return tx.quote.update({ where: { id: created.id }, data: { quoteNumber: formatQuoteNumber(created.id) } });
    });
    return c.json(quote, 201);
  })
  .put("/:id", validate("param", idParam), validate("json", updateQuoteSchema), async (c) => {
    const { id } = c.req.valid("param");
    const { version, lines, ...input } = c.req.valid("json");
    const quote = await findQuote(id);
    if (!isEditable(quote.status as QuoteStatus)) throw new RuleViolation("明細を変えられるのは作成中の見積だけです");
    await assertActiveAssignees(lines);

    await prisma.$transaction(async (tx) => {
      const result = await tx.quote.updateMany({
        where: { id, version, status: "draft" },
        data: {
          title: input.title,
          validUntil: input.validUntil ?? null,
          ...calcTotals(lines, quote.taxRate),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new VersionConflict();
      await tx.quoteLine.deleteMany({ where: { quoteId: id } });
      await tx.quoteLine.createMany({ data: toLineRows(lines).map((l) => ({ ...l, quoteId: id })) });
    });
    return c.json({ ok: true });
  })
  .post("/:id/status", validate("param", idParam), validate("json", statusSchema), async (c) => {
    const { id } = c.req.valid("param");
    const { to, version } = c.req.valid("json");
    const quote = await findQuote(id);
    const from = quote.status as QuoteStatus;
    if (!canTransition(from, to)) throw new RuleViolation("この状態には変更できません");

    const user = c.get("user");
    await prisma.$transaction(async (tx) => {
      const result = await tx.quote.updateMany({
        where: { id, version },
        data: { status: to, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new VersionConflict();
      await tx.quoteStatusHistory.create({
        data: { quoteId: id, fromStatus: from, toStatus: to, changedById: user.id, changedByName: user.name },
      });
      // 見積が承諾されたら、案件を受注にする
      if (to === "accepted") {
        const deal = await tx.deal.findUniqueOrThrow({ where: { id: quote.dealId }, select: { status: true, stage: true } });
        if (deal.status === "open") {
          await tx.deal.update({ where: { id: quote.dealId }, data: { status: "won", wonAt: new Date(), version: { increment: 1 } } });
          await tx.dealEvent.create({ data: dealEvent(quote.dealId, "won", deal.stage as DealStage, null, user) });
        }
      }
    });
    return c.json({ ok: true });
  });
