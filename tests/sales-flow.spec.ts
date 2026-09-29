import { expect, test } from "@playwright/test";
import { ADMIN, choose, confirm, login, shot } from "./helpers";

const toFullWidthDigits = (s: string) => s.replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0));

test("ログインから見積の承諾・契約概要の登録まで", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const memberName = `営業 太郎${suffix}`;
  const company = `株式会社テスト${suffix}`;
  const dealName = `基幹システム刷新${suffix}`;

  // 未ログインならログイン画面へ回される
  await page.goto("/deals");
  await expect(page).toHaveURL(/\/login$/);
  await shot(page, "01-login");
  await login(page, ADMIN.email, ADMIN.password);

  // メンバー
  await page.goto("/members");
  await page.getByRole("button", { name: "メンバーを追加" }).click();
  await page.getByLabel("氏名").fill(memberName);
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(page.getByRole("cell", { name: memberName })).toBeVisible();

  // 顧客と重複チェック（全角数字と前後の空白だけが違う名前は弾く）
  await page.goto("/customers");
  await page.getByRole("button", { name: "新しい顧客" }).click();
  await page.getByLabel("会社名").fill(company);
  await page.getByLabel("部署").fill("開発部");
  await page.getByRole("button", { name: "登録" }).click();
  await expect(page).toHaveURL(/\/customers\/\d+$/);

  await page.goto("/customers");
  await page.getByRole("button", { name: "新しい顧客" }).click();
  await page.getByLabel("会社名").fill(` ${toFullWidthDigits(company)} `);
  await page.getByLabel("部署").fill("開発部");
  await page.getByRole("button", { name: "登録" }).click();
  await expect(page.getByText("同じ会社名・部署の顧客が既にあります")).toBeVisible();
  await page.keyboard.press("Escape");
  await shot(page, "02-customers");

  // 顧客の画面から案件を作る
  await page.getByRole("cell", { name: company }).click();
  await page.getByRole("button", { name: "新しい案件" }).click();
  await page.getByLabel("案件名").fill(dealName);
  await choose(page, "営業担当", memberName);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page).toHaveURL(/\/deals\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("計画");

  // フェーズの矢印を押すと、営業パイプライン上の位置が変わる
  await page.getByTestId("stage-stepper").getByRole("button", { name: "訪問" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("訪問");
  await page.getByLabel("見込み金額（税抜・円）").fill("5000000");
  await page.getByLabel("受注予定月").fill("2026-12");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("案件を保存しました")).toBeVisible();

  // 商談を記録すると、商談の専用ページに移る
  await page.getByRole("button", { name: "商談を記録する" }).click();
  await page.getByLabel("商談名").fill("初回ヒアリング");
  await page.getByLabel("出席した人").fill("先方 事務長／当社 営業");
  await page.getByLabel("話したこと・分かったこと").fill("要件ヒアリング。予算は2,000万円前後。");
  await page.getByLabel("次の打ち合わせまでに用意するもの").fill("概算見積");
  await page.getByRole("button", { name: "記録する" }).click();
  await expect(page).toHaveURL(/\/meetings\/\d+$/);
  await expect(page.getByTestId("meeting-next")).toHaveText("概算見積");

  // 上司が訪問の記録を読んで、アドバイスを残す
  await page.getByLabel("フィードバックを書く").fill("同じ業種の受注事例を先に渡しておくと進みやすい");
  await page.getByRole("button", { name: "フィードバックを残す" }).click();
  await expect(page.getByTestId("meeting-feedback")).toContainText("同じ業種の受注事例を先に渡しておくと進みやすい");
  await shot(page, "11-meeting");

  // 案件概要を書くと、協力度と無理の度合いから難易度が決まる
  await page.getByRole("link", { name: "案件概要を見る" }).click();
  await page.getByRole("button", { name: "編集する" }).click();
  await page.getByLabel("お客さんが今、困っていること").fill("見積の転記ミスが多い");
  await page.getByLabel("受注に対してブロッカーになるもの").fill("先方の部長の承認が必要");
  await choose(page, "お客さんの協力度", "協力的");
  await choose(page, "予算・期間の無理", "少し心配");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("難易度 中");
  await expect(page.getByTestId("overview-progress")).toContainText("2 / 18");
  await shot(page, "12-overview");

  // 案件の画面に、概要の要約と前回の宿題が出る
  await page.getByRole("link", { name: new RegExp(dealName) }).click();
  await expect(page.getByText("先方の部長の承認が必要")).toBeVisible();
  await expect(page.getByText("次の打ち合わせまでに用意するもの（")).toBeVisible();

  // 見積（0.5人月を含む2行）。入力中に合計がその場で出る
  await page.getByRole("button", { name: "見積を作る" }).click();
  await page.getByLabel("1行目の作業内容").fill("要件定義");
  await page.getByLabel("1行目の数量").fill("0.5");
  await page.getByLabel("1行目の単価").fill("800000");
  await choose(page, "1行目の作業担当", memberName);
  await page.getByRole("button", { name: "行を追加" }).click();
  await page.getByLabel("2行目の作業内容").fill("設計・開発");
  await page.getByLabel("2行目の数量").fill("2");
  await page.getByLabel("2行目の単価").fill("650000");
  await expect(page.getByTestId("editor-total")).toHaveText("¥1,870,000");
  await shot(page, "03-quote-editor");
  await page.getByRole("button", { name: "作成する" }).click();
  await expect(page).toHaveURL(/\/quotes\/\d+$/);
  await expect(page.getByTestId("quote-total")).toHaveText("¥1,870,000");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Q-\d{6}/);

  // 提出 → 承諾（承諾すると案件が受注になる）
  await confirm(page, "提出する");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("提出済み");
  await confirm(page, "承諾にする");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("承諾");
  await expect(page.getByTestId("quote-history").locator("li")).toHaveCount(3);
  await shot(page, "04-quote-detail");

  await page.getByRole("link", { name: new RegExp(dealName) }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("受注");

  // 契約概要（承諾した見積の税抜金額が初期値に入る）
  await choose(page, "契約形態", "準委任");
  await page.getByLabel("開始日").fill("2026-10-01");
  await page.getByLabel("終了日").fill("2027-03-31");
  await expect(page.getByLabel("金額（税抜）")).toHaveValue("1700000");
  await page.getByRole("button", { name: "契約概要を登録" }).click();
  await expect(page.getByTestId("contract-summary")).toContainText("準委任");
  await expect(page.getByTestId("contract-summary")).toContainText("¥1,700,000");
  await shot(page, "05-deal-detail");

  await page.goto("/");
  await expect(page.getByText(dealName).first()).toBeVisible();
  await shot(page, "06-dashboard");
});
