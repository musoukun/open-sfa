import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { validate } from "../lib/validate";
import { RuleViolation, VersionConflict, type AppEnv } from "../lib/session";

const text = z.string().trim().max(10_000, "10000文字までにしてください").default("");
const idParam = z.object({ id: z.coerce.number().int() });

const meetingFields = z.object({
  meetingDate: z.iso.date("商談日は YYYY-MM-DD で入力してください"),
  title: z.string().trim().min(1, "商談名は必須です"),
  attendees: text,
  content: text,
  nextPreparations: text,
});

const withDeal = { deal: { include: { customer: true, salesRep: true } } } as const;

export const meetingsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const meetings = await prisma.meeting.findMany({ include: withDeal, orderBy: [{ meetingDate: "desc" }, { id: "desc" }] });
    return c.json(meetings);
  })
  .get("/:id", validate("param", idParam), async (c) => {
    const meeting = await prisma.meeting.findUnique({ where: { id: c.req.valid("param").id }, include: withDeal });
    return meeting ? c.json(meeting) : c.json({ error: "商談が見つかりません" }, 404);
  })
  .post("/", validate("json", meetingFields.extend({ dealId: z.number().int() })), async (c) => {
    const input = c.req.valid("json");
    if (!(await prisma.deal.findUnique({ where: { id: input.dealId } }))) throw new RuleViolation("案件が見つかりません");
    const user = c.get("user");
    const meeting = await prisma.meeting.create({ data: { ...input, authorId: user.id, authorName: user.name } });
    return c.json(meeting, 201);
  })
  .patch("/:id", validate("param", idParam), validate("json", meetingFields.extend({ version: z.number().int() })), async (c) => {
    const { id } = c.req.valid("param");
    const { version, ...input } = c.req.valid("json");
    const result = await prisma.meeting.updateMany({ where: { id, version }, data: { ...input, version: { increment: 1 } } });
    if (result.count !== 1) throw new VersionConflict();
    return c.json({ ok: true });
  });
