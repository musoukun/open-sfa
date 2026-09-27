import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db";
import { Prisma } from "../generated/prisma/client";
import { validate } from "../lib/validate";
import { CONFLICT_MESSAGE, type AppEnv } from "../lib/session";
import { buildMatchKey } from "./rules";

const optionalText = z.string().trim().optional();

const customerSchema = z.object({
  companyName: z.string().trim().min(1, "会社名は必須です"),
  department: z.string().trim().default(""),
  contactName: optionalText,
  email: z.email("メールアドレスの形式が正しくありません").optional(),
  phone: optionalText,
  memo: optionalText,
});

const versionSchema = z.object({ version: z.number().int() });
const idParam = z.object({ id: z.coerce.number().int() });

const DUPLICATE_MESSAGE = "同じ会社名・部署の顧客が既にあります（アーカイブ済みを含む）";

function isDuplicate(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function updateWithVersion(id: number, version: number, data: Prisma.CustomerUpdateManyMutationInput) {
  const result = await prisma.customer.updateMany({
    where: { id, version },
    data: { ...data, version: { increment: 1 } },
  });
  return result.count === 1;
}

export const customersRoutes = new Hono<AppEnv>()
  .get("/", validate("query", z.object({ includeArchived: z.string().optional() })), async (c) => {
    const { includeArchived } = c.req.valid("query");
    const customers = await prisma.customer.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: { companyName: "asc" },
    });
    return c.json(customers);
  })
  .post("/", validate("json", customerSchema), async (c) => {
    const input = c.req.valid("json");
    try {
      const customer = await prisma.customer.create({
        data: { ...input, matchKey: buildMatchKey(input.companyName, input.department) },
      });
      return c.json(customer, 201);
    } catch (e) {
      if (isDuplicate(e)) return c.json({ error: DUPLICATE_MESSAGE }, 409);
      throw e;
    }
  })
  .patch("/:id", validate("param", idParam), validate("json", customerSchema.extend(versionSchema.shape)), async (c) => {
    const { id } = c.req.valid("param");
    const { version, ...input } = c.req.valid("json");
    try {
      const ok = await updateWithVersion(id, version, {
        ...input,
        contactName: input.contactName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        memo: input.memo ?? null,
        matchKey: buildMatchKey(input.companyName, input.department),
      });
      if (!ok) return c.json({ error: CONFLICT_MESSAGE }, 409);
      return c.json({ ok: true });
    } catch (e) {
      if (isDuplicate(e)) return c.json({ error: DUPLICATE_MESSAGE }, 409);
      throw e;
    }
  })
  .post("/:id/archive", validate("param", idParam), validate("json", versionSchema), async (c) => {
    const ok = await updateWithVersion(c.req.valid("param").id, c.req.valid("json").version, { archivedAt: new Date() });
    return ok ? c.json({ ok: true }) : c.json({ error: CONFLICT_MESSAGE }, 409);
  })
  .post("/:id/unarchive", validate("param", idParam), validate("json", versionSchema), async (c) => {
    const ok = await updateWithVersion(c.req.valid("param").id, c.req.valid("json").version, { archivedAt: null });
    return ok ? c.json({ ok: true }) : c.json({ error: CONFLICT_MESSAGE }, 409);
  });
