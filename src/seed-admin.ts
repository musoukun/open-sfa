import { auth } from "./auth";
import { prisma } from "./db";

const email = process.env["ADMIN_EMAIL"];
const password = process.env["ADMIN_PASSWORD"];
const name = process.env["ADMIN_NAME"] ?? "管理者";

if (!email || !password) {
  console.error("ADMIN_EMAIL と ADMIN_PASSWORD を .env に設定してください");
  process.exit(1);
}

const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  console.log(`管理者 ${email} は作成済みです`);
} else {
  // リクエストの文脈なしでサーバー側から呼ぶと、ログインなしで作成できる
  await auth.api.createUser({ body: { email, password, name, role: "admin" } });
  console.log(`管理者 ${email} を作成しました`);
}
