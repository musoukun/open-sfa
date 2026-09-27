import { createHash, randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../auth";
import { prisma } from "../db";
import { INVITATION_VALID_DAYS } from "../config/business";
import { sendActionMail } from "../lib/mail";
import { validate } from "../lib/validate";
import { RuleViolation, requireAdmin, type AppEnv } from "../lib/session";

const APP_URL = process.env["BETTER_AUTH_URL"] ?? "http://localhost:3100";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const idParam = z.object({ id: z.coerce.number().int() });

async function findUsableInvitation(token: string) {
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) return null;
  return invitation;
}

// ログインしている人なら誰でも招待できる。一般ユーザーが招待した人は、登録後に管理者の承認が要る
export const invitationsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const user = c.get("user");
    const invitations = await prisma.invitation.findMany({
      where: { acceptedAt: null, ...(user.role === "admin" ? {} : { invitedById: user.id }) },
      orderBy: { id: "desc" },
      select: { id: true, email: true, invitedByName: true, autoApprove: true, expiresAt: true, createdAt: true },
    });
    return c.json(invitations);
  })
  .post("/", validate("json", z.object({ email: z.email("メールアドレスの形式が正しくありません") })), async (c) => {
    const email = c.req.valid("json").email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw new RuleViolation("このメールアドレスのアカウントは既にあります");

    const inviter = c.get("user");
    const token = randomBytes(32).toString("base64url");
    const autoApprove = inviter.role === "admin";
    // 同じ宛先への古い招待は無効にして、最新のリンクだけ使えるようにする
    await prisma.$transaction([
      prisma.invitation.deleteMany({ where: { email, acceptedAt: null } }),
      prisma.invitation.create({
        data: {
          email,
          tokenHash: hashToken(token),
          invitedById: inviter.id,
          invitedByName: inviter.name,
          autoApprove,
          expiresAt: new Date(Date.now() + INVITATION_VALID_DAYS * 86_400_000),
        },
      }),
    ]);
    await sendActionMail(
      email,
      `【open-sfa】${inviter.name} さんから招待が届きました`,
      [
        `${inviter.name} さんから、営業支援システム open-sfa に招待されました。`,
        `${INVITATION_VALID_DAYS}日以内に下のボタンから名前とパスワードを登録してください。`,
        ...(autoApprove ? [] : ["登録後、管理者の承認が済むとログインできるようになります。"]),
      ],
      { label: "登録する", url: `${APP_URL}/signup?token=${token}` },
    );
    return c.json({ ok: true }, 201);
  })
  .delete("/:id", validate("param", idParam), async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const result = await prisma.invitation.deleteMany({
      where: { id, acceptedAt: null, ...(user.role === "admin" ? {} : { invitedById: user.id }) },
    });
    if (result.count !== 1) throw new RuleViolation("取り消せる招待が見つかりません");
    return c.json({ ok: true });
  });

const signupSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1, "名前は必須です"),
  password: z.string().min(8, "パスワードは8文字以上にしてください"),
});

// ログイン前に使う。招待リンクの確認と、招待からの登録
export const signupRoutes = new Hono()
  .get("/invitation", validate("query", z.object({ token: z.string().min(1) })), async (c) => {
    const invitation = await findUsableInvitation(c.req.valid("query").token);
    if (!invitation) return c.json({ error: "招待リンクが無効か、期限が切れています。招待した人にもう一度送ってもらってください" }, 404);
    return c.json({ email: invitation.email, invitedByName: invitation.invitedByName, autoApprove: invitation.autoApprove });
  })
  .post("/", validate("json", signupSchema), async (c) => {
    const { token, name, password } = c.req.valid("json");
    const invitation = await findUsableInvitation(token);
    if (!invitation) return c.json({ error: "招待リンクが無効か、期限が切れています" }, 404);

    // 同じリンクで2回登録されないよう、先に使用済みにする
    const claimed = await prisma.invitation.updateMany({ where: { id: invitation.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) return c.json({ error: "この招待リンクは使用済みです" }, 409);

    try {
      const { user } = await auth.api.createUser({ body: { email: invitation.email, password, name, role: "user" } });
      // 招待メールのリンクから来たので、メールアドレスは確認済みとみなす
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, approved: invitation.autoApprove } });
    } catch (e) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: null } });
      throw e;
    }
    return c.json({ approved: invitation.autoApprove }, 201);
  });

export const approvalRoutes = new Hono<AppEnv>().post("/:id/approve", requireAdmin, async (c) => {
  const result = await prisma.user.updateMany({ where: { id: c.req.param("id") }, data: { approved: true } });
  if (result.count !== 1) throw new RuleViolation("アカウントが見つかりません");
  return c.json({ ok: true });
});
