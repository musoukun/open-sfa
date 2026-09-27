import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { Prisma } from "../generated/prisma/client";
import { validate } from "../lib/validate";
import { requireAdmin, type AppEnv } from "../lib/session";

const memberSchema = z.object({
  name: z.string().trim().min(1, "氏名は必須です"),
  email: z.email("メールアドレスの形式が正しくありません").optional(),
});

const updateMemberSchema = memberSchema.partial().extend({ isActive: z.boolean().optional() });

const idParam = z.object({ id: z.coerce.number().int() });

function duplicateEmail(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export const membersRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const members = await prisma.member.findMany({ orderBy: { id: "asc" } });
    return c.json(members);
  })
  .post("/", requireAdmin, validate("json", memberSchema), async (c) => {
    try {
      const member = await prisma.member.create({ data: c.req.valid("json") });
      return c.json(member, 201);
    } catch (e) {
      if (duplicateEmail(e)) return c.json({ error: "このメールアドレスは登録済みです" }, 409);
      throw e;
    }
  })
  .patch("/:id", requireAdmin, validate("param", idParam), validate("json", updateMemberSchema), async (c) => {
    const { id } = c.req.valid("param");
    try {
      const member = await prisma.member.update({ where: { id }, data: c.req.valid("json") });
      return c.json(member);
    } catch (e) {
      if (duplicateEmail(e)) return c.json({ error: "このメールアドレスは登録済みです" }, 409);
      throw e;
    }
  });
