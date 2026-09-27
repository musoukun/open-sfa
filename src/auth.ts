import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  // 利用者の自己登録はさせず、管理者がアカウントを作る
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [admin()],
});

export type SessionUser = typeof auth.$Infer.Session.user;
