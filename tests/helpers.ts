import { expect, type Page } from "@playwright/test";

export const ADMIN = { email: process.env["ADMIN_EMAIL"]!, password: process.env["ADMIN_PASSWORD"]! };

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByRole("heading", { name: /おかえりなさい/ })).toBeVisible();
}

// shadcn の Select（Radix）はネイティブの select ではないので、開いてから選ぶ
export async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

export async function confirm(page: Page, button: string) {
  await page.getByRole("button", { name: button }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "実行する" }).click();
}

const MAILPIT = process.env["MAILPIT_URL"] ?? "http://localhost:8025";

// Mailpit に届いた、その宛先への最新メールから URL を取り出す
export async function linkFromLatestMail(to: string, pattern: RegExp): Promise<string> {
  let link = "";
  await expect
    .poll(
      async () => {
        const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json();
        const latest = list.messages?.[0];
        if (!latest) return "";
        const message = await (await fetch(`${MAILPIT}/api/v1/message/${latest.ID}`)).json();
        link = (message.Text as string).match(pattern)?.[0] ?? "";
        return link;
      },
      { timeout: 10_000 },
    )
    .not.toBe("");
  return link;
}

export const shot =(page: Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
