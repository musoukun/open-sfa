import { expect, test } from "@playwright/test";

// 空の DB で起動したアプリに対してだけ流す（例: SETUP_BASE_URL=http://localhost:3101）
const baseURL = process.env["SETUP_BASE_URL"];
test.skip(!baseURL, "SETUP_BASE_URL が無いときは流さない");

test("ユーザーが1人もいなければ、初回セットアップで管理者を作って始められる", async ({ page }) => {
  await page.goto(`${baseURL}/`);
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByLabel("名前").fill("最初の管理者");
  await page.getByLabel("メールアドレス").fill("first-admin@sfa.test");
  await page.getByLabel("パスワード（8文字以上）").fill("first-admin-pw");
  await page.getByRole("button", { name: "管理者を作成して始める" }).click();
  await expect(page.getByRole("heading", { name: /おかえりなさい、最初の管理者さん/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "アカウント管理" })).toBeVisible();

  // 2人目以降はセットアップ画面を使えない
  await page.goto(`${baseURL}/setup`);
  await expect(page).not.toHaveURL(/\/setup$/);
});
