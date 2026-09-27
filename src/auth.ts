import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./db";
import { sendActionMail } from "./lib/mail";

export const PENDING_APPROVAL_MESSAGE = "管理者の承認待ちです。承認されるとログインできます";

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] ?? "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] ?? "";
// .env に Google の OAuth クライアントを書いたときだけ、Google 連携（議事録の取り込み）を使える
export const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          // Google はログイン済みの人が後から連携するためだけに使う。Google から新しく登録はさせない
          disableSignUp: true,
          // 会議のあとで文字起こしを取りに行けるよう、更新用のトークンを毎回もらう
          accessType: "offline",
          prompt: "select_account consent",
        },
      }
    : {},
  account: {
    // Google のトークンは暗号化して DB に置く
    encryptOAuthTokens: true,
    // 会社の Google アカウントと、このアプリのメールアドレスが違っても連携できるようにする
    accountLinking: { allowDifferentEmails: true },
  },
  emailAndPassword: {
    enabled: true,
    // 登録は招待リンク（/api/signup）からだけにし、Better Auth の自己登録は使わない
    disableSignUp: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // 送信を待たずに返し、登録の有無が応答時間から分からないようにする
      void sendActionMail(
        user.email,
        "【open-sfa】パスワードの再設定",
        [`${user.name} さん`, "パスワードの再設定を受け付けました。1時間以内に下のボタンから新しいパスワードを設定してください。", "心当たりがない場合は、このメールを無視してください。"],
        { label: "パスワードを再設定する", url },
      ).catch((e) => console.error("パスワード再設定メールの送信に失敗しました", e));
    },
  },
  user: {
    additionalFields: {
      approved: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { approved: true } });
          if (user && !user.approved) throw new APIError("FORBIDDEN", { message: PENDING_APPROVAL_MESSAGE });
        },
      },
    },
  },
  plugins: [admin()],
});

export type SessionUser = typeof auth.$Infer.Session.user;
