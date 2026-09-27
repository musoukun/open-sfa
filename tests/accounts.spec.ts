import { expect, test } from "@playwright/test";
import { ADMIN, login, shot } from "./helpers";

test("管理者がアカウントを作り、本人がパスワードを変え、管理者が利用停止にする", async ({ browser }) => {
  const suffix = Date.now().toString().slice(-6);
  const user = { name: `新人 花子${suffix}`, email: `hanako${suffix}@sfa.test`, initial: `init-${suffix}-pw`, next: `mine-${suffix}-pw` };

  const admin = await (await browser.newContext()).newPage();
  await login(admin, ADMIN.email, ADMIN.password);
  await admin.getByRole("link", { name: "アカウント管理" }).click();
  await admin.getByRole("button", { name: "アカウントを作成" }).click();
  await admin.getByLabel("名前").fill(user.name);
  await admin.getByLabel("メールアドレス").fill(user.email);
  await admin.getByLabel("初期パスワード（8文字以上）").fill(user.initial);
  await admin.getByRole("button", { name: "作成", exact: true }).click();
  const row = admin.getByRole("row", { name: new RegExp(user.email) });
  await expect(row).toContainText("一般ユーザー");
  await expect(row).toContainText("利用中");
  await shot(admin, "07-admin-accounts");

  // 一般ユーザーにはアカウント管理が見えず、URL を直接開いてもホームへ戻される
  const member = await (await browser.newContext()).newPage();
  await login(member, user.email, user.initial);
  await expect(member.getByRole("link", { name: "アカウント管理" })).toHaveCount(0);
  await member.goto("/admin/accounts");
  await expect(member).toHaveURL(/\/$/);

  // 個人設定でパスワードを変える
  await member.getByTestId("user-menu").click();
  await member.getByRole("menuitem", { name: "個人設定" }).click();
  await member.getByLabel("今のパスワード").fill(user.initial);
  await member.getByLabel("新しいパスワード（8文字以上）").fill(user.next);
  await member.getByLabel("新しいパスワード（確認）").fill(user.next);
  await member.getByRole("button", { name: "パスワードを変更" }).click();
  await expect(member.getByText("パスワードを変更しました")).toBeVisible();
  await shot(member, "08-settings");
  await member.getByTestId("user-menu").click();
  await member.getByRole("menuitem", { name: "ログアウト" }).click();
  await login(member, user.email, user.next);

  // 管理者が利用停止にすると、ログインできなくなる
  await admin.reload();
  await admin.getByRole("button", { name: `${user.name}の操作` }).click();
  await admin.getByRole("menuitem", { name: "利用停止にする" }).click();
  await expect(row).toContainText("利用停止");

  const banned = await (await browser.newContext()).newPage();
  await banned.goto("/login");
  await banned.getByLabel("メールアドレス").fill(user.email);
  await banned.getByLabel("パスワード").fill(user.next);
  await banned.getByRole("button", { name: "ログイン" }).click();
  await expect(banned.getByRole("alert")).toContainText("利用停止中");
});
