import { expect, test } from "@playwright/test";
import { ADMIN, choose, login, shot } from "./helpers";

// 本物の GitHub / Discord には送らない。画面から正しい中身が API に渡ることだけ確かめる
test("画面右下から、書き込んだスクリーンショット付きで要望を送る", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/deals");

  let sent: Record<string, unknown> = {};
  await page.route("**/api/feedback", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { issueNumber: 7, issueUrl: "https://github.com/example/repo/issues/7", notified: true, discordUrl: null } });
  });

  // ボタンを押すと、その時の画面が撮られて開く
  await page.getByRole("button", { name: "要望を送る" }).click();
  const form = page.getByRole("form", { name: "要望を送る" });
  await expect(form.getByRole("img", { name: "送るスクリーンショット" })).toBeVisible();
  await expect(form.getByRole("button", { name: "送信" })).toBeDisabled();

  // ペンで丸を描き、文字を置く
  const canvas = form.getByTestId("annotation-canvas");
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width * 0.3;
  const cy = box.y + box.height * 0.3;
  await page.mouse.move(cx + 40, cy);
  await page.mouse.down();
  for (let i = 1; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    await page.mouse.move(cx + 40 * Math.cos(a), cy + 25 * Math.sin(a));
  }
  await page.mouse.up();
  await form.getByRole("button", { name: "文字" }).click();
  await canvas.click({ position: { x: box.width * 0.3 + 50, y: box.height * 0.3 } });
  await form.getByLabel("書き込む文字").fill("ここの色を揃えたい");
  await form.getByLabel("書き込む文字").press("Enter");
  await expect(form.getByRole("button", { name: "元に戻す" })).toBeEnabled();

  // デザインの要望には、アプリ全体で統一してほしいことを書く欄が出る
  await choose(page, "種別", "デザインの要望");
  await form.getByLabel("内容", { exact: true }).fill("状態のバッジの色が画面ごとに違う");
  await form.getByLabel("アプリ全体で統一してほしいデザイン（任意）").fill("状態の色はどの画面でも同じにしてほしい");
  await expect(form.getByRole("button", { name: "送信" })).toBeEnabled();
  await shot(page, "13-feedback");
  await form.getByRole("button", { name: "送信" }).click();

  await expect(page.getByText("要望を送りました（Issue #7）")).toBeVisible();
  await expect(form).toBeHidden();
  expect(sent).toMatchObject({ kind: "design", body: "状態のバッジの色が画面ごとに違う", appWide: "状態の色はどの画面でも同じにしてほしい", pagePath: "/deals" });
  expect(String(sent["screenshot"])).toMatch(/^data:image\/jpeg;base64,/);
});

test("スクリーンショットを外して送れる。不具合にはアプリ全体の欄が出ない", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  let sent: Record<string, unknown> = {};
  await page.route("**/api/feedback", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { issueNumber: 8, issueUrl: "https://github.com/example/repo/issues/8", notified: false, discordUrl: null } });
  });

  await page.getByRole("button", { name: "要望を送る" }).click();
  const form = page.getByRole("form", { name: "要望を送る" });
  await form.getByLabel("スクリーンショットを付ける").uncheck();
  await choose(page, "種別", "不具合");
  await expect(form.getByText(/アプリ全体/)).toHaveCount(0);
  await form.getByLabel("内容", { exact: true }).fill("保存ボタンが反応しない");
  await form.getByRole("button", { name: "送信" }).click();
  await expect(page.getByText("要望を送りました（Issue #8）")).toBeVisible();
  expect(sent["screenshot"]).toBeUndefined();
  expect(sent["appWide"]).toBeUndefined();
});

test("種別が決まっていない要望は受け付けない", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  expect((await page.request.post("/api/feedback", { data: { kind: "unknown", body: "内容" } })).status()).toBe(400);
});
