import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { Prisma } from "../generated/prisma/client";
import { validate } from "../lib/validate";
import { RuleViolation, VersionConflict, type AppEnv } from "../lib/session";
import { COOPERATION_LEVELS, OVERVIEW_TEXT_KEYS, RISK_LEVELS, type OverviewTextKey } from "./rules";

const text = z.string().trim().max(10_000, "10000文字までにしてください").default("");

const overviewSchema = z.object({
  ...(Object.fromEntries(OVERVIEW_TEXT_KEYS.map((k) => [k, text])) as Record<OverviewTextKey, typeof text>),
  cooperationLevel: z.enum(COOPERATION_LEVELS).nullable().default(null),
  cooperationNote: text,
  riskLevel: z.enum(RISK_LEVELS).nullable().default(null),
  riskNote: text,
  // まだ概要が無い案件は 0 を送る
  version: z.number().int().nonnegative(),
});

const dealParam = z.object({ dealId: z.coerce.number().int() });

// /api/deals/:dealId/overview にぶら下げる
export const overviewRoutes = new Hono<AppEnv>()
  .get("/:dealId/overview", validate("param", dealParam), async (c) => {
    const overview = await prisma.dealOverview.findUnique({ where: { dealId: c.req.valid("param").dealId } });
    return c.json(overview);
  })
  .put("/:dealId/overview", validate("param", dealParam), validate("json", overviewSchema), async (c) => {
    const { dealId } = c.req.valid("param");
    const { version, ...input } = c.req.valid("json");
    const user = c.get("user");
    const author = { updatedById: user.id, updatedByName: user.name };

    if (version === 0) {
      if (!(await prisma.deal.findUnique({ where: { id: dealId } }))) throw new RuleViolation("案件が見つかりません");
      try {
        await prisma.dealOverview.create({ data: { ...input, ...author, dealId } });
      } catch (e) {
        // 同時に2人が最初の概要を書いた場合は、後の人をやり直しにする
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new VersionConflict();
        throw e;
      }
      return c.json({ ok: true }, 201);
    }

    const result = await prisma.dealOverview.updateMany({
      where: { dealId, version },
      data: { ...input, ...author, version: { increment: 1 } },
    });
    if (result.count !== 1) throw new VersionConflict();
    return c.json({ ok: true });
  });
