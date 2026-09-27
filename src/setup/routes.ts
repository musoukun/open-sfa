import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../auth";
import { prisma } from "../db";
import { validate } from "../lib/validate";

const setupSchema = z.object({
  name: z.string().trim().min(1, "名前は必須です"),
  email: z.email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上にしてください"),
});

// ユーザーが1人もいない間だけ、最初の管理者をログインなしで作れる
export const setupRoutes = new Hono()
  .get("/", async (c) => c.json({ needsSetup: (await prisma.user.count()) === 0 }))
  .post("/", validate("json", setupSchema), async (c) => {
    if ((await prisma.user.count()) > 0) return c.json({ error: "初回セットアップは完了しています" }, 403);
    await auth.api.createUser({ body: { ...c.req.valid("json"), role: "admin" } });
    return c.json({ ok: true }, 201);
  });
