import { expect, test } from "@playwright/test";

const toFullWidthDigits = (s: string) => s.replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0));

test("ログインから見積の承諾・契約概要の登録まで", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const memberName = `営業 太郎${suffix}`;
  const company = `株式会社テスト${suffix}`;
  const dealName = `基幹システム刷新${suffix}`;
  page.on("dialog", (d) => d.accept());

  // 未ログインならログイン画面へ回される
  await page.goto("/deals");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("メールアドレス").fill(process.env["ADMIN_EMAIL"]!);
  await page.getByLabel("パスワード").fill(process.env["ADMIN_PASSWORD"]!);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByRole("heading", { name: "案件", exact: true })).toBeVisible();

  // メンバー
  await page.goto("/members");
  const memberForm = page.locator('form[data-api="/api/members"]');
  await memberForm.getByLabel("氏名").fill(memberName);
  await memberForm.getByRole("button", { name: "登録" }).click();
  await expect(page.getByRole("cell", { name: memberName })).toBeVisible();

  // 顧客と重複チェック（全角数字と前後の空白だけが違う名前は弾く）
  await page.goto("/customers");
  const customerForm = page.locator('form[data-api="/api/customers"]');
  await customerForm.getByLabel("会社名（必須）").fill(company);
  await customerForm.getByLabel("部署").fill("開発部");
  await customerForm.getByRole("button", { name: "登録" }).click();
  await expect(page).toHaveURL(/\/customers\/\d+$/);

  await page.goto("/customers");
  await customerForm.getByLabel("会社名（必須）").fill(` ${toFullWidthDigits(company)} `);
  await customerForm.getByLabel("部署").fill("開発部");
  await customerForm.getByRole("button", { name: "登録" }).click();
  await expect(customerForm.locator(".form-error")).toContainText("同じ会社名・部署");

  // 案件
  await page.getByRole("link", { name: company }).click();
  await page.getByRole("link", { name: "この顧客の案件を作る" }).click();
  const dealForm = page.locator('form[data-api="/api/deals"]');
  await dealForm.getByLabel("案件名").fill(dealName);
  await dealForm.getByLabel("営業担当").selectOption({ label: memberName });
  await dealForm.getByRole("button", { name: "作成" }).click();
  await expect(page).toHaveURL(/\/deals\/\d+$/);
  await expect(page.getByRole("heading", { name: new RegExp(dealName) })).toContainText("進行中");

  // 商談メモ
  const noteForm = page.locator('form[data-api$="/notes"]');
  await noteForm.getByLabel("内容").fill("要件ヒアリング。予算は2,000万円前後。");
  await noteForm.getByRole("button", { name: "メモを残す" }).click();
  await expect(page.getByText("要件ヒアリング。予算は2,000万円前後。")).toBeVisible();

  // 見積（0.5人月を含む2行）
  await page.getByRole("link", { name: "見積を作る" }).click();
  const quoteForm = page.locator("form[data-lines]");
  const rows = quoteForm.locator("tr[data-line]");
  await rows.nth(0).locator('[data-field="description"]').fill("要件定義");
  await rows.nth(0).locator('[data-field="quantity"]').fill("0.5");
  await rows.nth(0).locator('[data-field="unitPrice"]').fill("800000");
  await rows.nth(0).locator('[data-field="assigneeId"]').selectOption({ label: memberName });
  await quoteForm.getByRole("button", { name: "行を追加" }).click();
  await rows.nth(1).locator('[data-field="description"]').fill("設計・開発");
  await rows.nth(1).locator('[data-field="quantity"]').fill("2");
  await rows.nth(1).locator('[data-field="unitPrice"]').fill("650000");
  await quoteForm.getByRole("button", { name: "作成" }).click();
  await expect(page).toHaveURL(/\/quotes\/\d+$/);
  await expect(page.getByTestId("quote-total")).toHaveText("¥1,870,000");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Q-\d{6}/);

  // 提出 → 承諾（承諾すると案件が受注になる）
  await page.getByRole("button", { name: "提出する" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("提出済み");
  await page.getByRole("button", { name: "承諾にする" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("承諾");
  await expect(page.locator("table").last().locator("tbody tr")).toHaveCount(3);

  await page.getByRole("link", { name: dealName }).click();
  await expect(page.getByRole("heading", { name: new RegExp(dealName) })).toContainText("受注");

  // 契約概要
  const contractForm = page.locator('form[data-api$="/contract"]');
  await contractForm.getByLabel("契約形態").selectOption({ label: "準委任" });
  await contractForm.getByLabel("開始日").fill("2026-10-01");
  await contractForm.getByLabel("終了日").fill("2027-03-31");
  await expect(contractForm.getByLabel("金額（税抜）")).toHaveValue("1700000");
  await contractForm.getByRole("button", { name: "契約概要を登録" }).click();
  await expect(page.getByText("準委任 / 2026-10-01 〜 2027-03-31 / ¥1,700,000")).toBeVisible();
});
