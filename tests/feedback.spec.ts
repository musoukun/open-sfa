import { expect, test } from "@playwright/test";
import { ADMIN, choose, login, shot } from "./helpers";

// 本物の GitHub / Discord には送らない。画面から正しい中身が API に渡ることだけ確かめる
test("画面右下から要望を送る", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/deals");

  let sent: unknown;
  await page.route("**/api/feedback", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { issueNumber: 7, issueUrl: "https://github.com/example/repo/issues/7", notified: true, discordUrl: null } });
  });

  await page.getByRole("button", { name: "要望を送る" }).click();
  const form = page.getByRole("form", { name: "要望を送る" });
  await expect(form.getByRole("button", { name: "送信" })).toBeDisabled();
  await choose(page, "種別", "機能の要望");
  await form.getByLabel("内容").fill("案件一覧を受注予定月で並べ替えたい");
  await shot(page, "13-feedback");
  await form.getByRole("button", { name: "送信" }).click();

  await expect(page.getByText("要望を送りました（Issue #7）")).toBeVisible();
  await expect(page.getByText("Discord にも知らせました")).toBeVisible();
  await expect(form).toBeHidden();
  expect(sent).toEqual({ kind: "request", body: "案件一覧を受注予定月で並べ替えたい", pagePath: "/deals" });
});

test("種別が決まっていない要望は受け付けない", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  const res = await page.request.post("/api/feedback", { data: { kind: "unknown", body: "内容" } });
  expect(res.status()).toBe(400);
});
