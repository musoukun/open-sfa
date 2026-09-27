import { expect, test, type Browser } from "@playwright/test";
import { ADMIN, linkFromLatestMail, login, shot } from "./helpers";

const SIGNUP_LINK = /https?:\/\/\S+\/signup\?token=[\w-]+/;
const RESET_LINK = /https?:\/\/\S+\/api\/auth\/reset-password\/\S+/;

async function newPage(browser: Browser) {
  return (await browser.newContext()).newPage();
}

async function sendInvite(page: import("@playwright/test").Page, email: string) {
  await page.getByRole("link", { name: "招待" }).click();
  await page.getByLabel("招待する人のメールアドレス").fill(email);
  await page.getByRole("button", { name: "招待を送る" }).click();
  await expect(page.getByRole("cell", { name: email })).toBeVisible();
}

async function signupFromMail(browser: Browser, email: string, name: string, password: string) {
  const page = await newPage(browser);
  await page.goto(await linkFromLatestMail(email, SIGNUP_LINK));
  await expect(page.getByLabel("メールアドレス")).toHaveValue(email);
  await page.getByLabel("名前").fill(name);
  await page.getByLabel("パスワード（8文字以上）").fill(password);
  await page.getByLabel("パスワード（確認）").fill(password);
  await page.getByRole("button", { name: "登録する" }).click();
  return page;
}

test("招待から登録し、一般ユーザーの招待は承認制、パスワードはメールで再設定できる", async ({ browser }) => {
  const suffix = Date.now().toString().slice(-6);
  const alice = { email: `alice${suffix}@sfa.test`, name: `営業 アリス${suffix}`, password: `alice-${suffix}-pw` };
  const bob = { email: `bob${suffix}@sfa.test`, name: `営業 ボブ${suffix}`, password: `bob-${suffix}-pw` };

  // 管理者が招待した人は、登録してすぐ使える
  const admin = await newPage(browser);
  await login(admin, ADMIN.email, ADMIN.password);
  await sendInvite(admin, alice.email);
  const alicePage = await signupFromMail(browser, alice.email, alice.name, alice.password);
  await expect(alicePage.getByRole("heading", { name: new RegExp(`おかえりなさい、${alice.name}さん`) })).toBeVisible();

  // 使った招待リンクは2回目は使えない
  const reuse = await newPage(browser);
  await reuse.goto(await linkFromLatestMail(alice.email, SIGNUP_LINK));
  await expect(reuse.getByText("招待リンクが使えません")).toBeVisible();

  // 一般ユーザーが招待した人は、管理者が承認するまでログインできない
  await sendInvite(alicePage, bob.email);
  await shot(alicePage, "09-invitations");
  const bobPage = await signupFromMail(browser, bob.email, bob.name, bob.password);
  await expect(bobPage.getByText("登録を受け付けました")).toBeVisible();
  await bobPage.goto("/login");
  await bobPage.getByLabel("メールアドレス").fill(bob.email);
  await bobPage.getByLabel("パスワード").fill(bob.password);
  await bobPage.getByRole("button", { name: "ログイン" }).click();
  await expect(bobPage.getByRole("alert")).toContainText("承認待ち");

  await admin.getByRole("link", { name: "アカウント管理" }).click();
  await expect(admin.getByRole("status")).toContainText("承認待ちのアカウント");
  await shot(admin, "10-approval");
  await admin.getByRole("row", { name: new RegExp(bob.email) }).getByRole("button", { name: "承認" }).click();
  await expect(admin.getByRole("row", { name: new RegExp(bob.email) })).toContainText("利用中");
  await login(bobPage, bob.email, bob.password);

  // パスワードを忘れたら、メールのリンクから再設定する
  const forgot = await newPage(browser);
  await forgot.goto("/login");
  await forgot.getByRole("link", { name: "パスワードを忘れた場合" }).click();
  await forgot.getByLabel("メールアドレス").fill(bob.email);
  await forgot.getByRole("button", { name: "再設定のメールを送る" }).click();
  await expect(forgot.getByRole("status")).toContainText("再設定のメールを送りました");
  await forgot.goto(await linkFromLatestMail(bob.email, RESET_LINK));
  await expect(forgot).toHaveURL(/\/reset-password\?token=/);
  const newPassword = `bob-new-${suffix}`;
  await forgot.getByLabel("新しいパスワード（8文字以上）").fill(newPassword);
  await forgot.getByLabel("新しいパスワード（確認）").fill(newPassword);
  await forgot.getByRole("button", { name: "パスワードを再設定する" }).click();
  await expect(forgot).toHaveURL(/\/login$/);
  await login(forgot, bob.email, newPassword);
});
