import { createMiddleware } from "hono/factory";
import { auth, type SessionUser } from "../auth";

export type AppEnv = { Variables: { user: SessionUser } };

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "ログインしてください" }, 401);
  c.set("user", session.user);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user").role !== "admin") return c.json({ error: "管理者だけが行える操作です" }, 403);
  await next();
});

export const CONFLICT_MESSAGE = "他の人が先に更新しました。画面を再読み込みしてからやり直してください";

// 版番号が合わなかったときにトランザクションを取り消すための例外
export class VersionConflict extends Error {}

export class RuleViolation extends Error {}
