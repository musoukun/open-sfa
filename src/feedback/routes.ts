import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../lib/session";
import { validate } from "../lib/validate";
import { buildDiscordMessage, buildIssue, FEEDBACK_KINDS, type FeedbackKind } from "./rules";
import { createIssue, discordTarget, gitHubTarget, parseScreenshot, postToDiscord } from "./notify";

const feedbackSchema = z.object({
  kind: z.enum(Object.keys(FEEDBACK_KINDS) as [FeedbackKind, ...FeedbackKind[]], { error: "種別を選んでください" }),
  body: z.string().trim().min(1, "内容を書いてください").max(5000, "内容は5000文字までです"),
  pagePath: z.string().max(500).default("/"),
  appWide: z.string().trim().max(5000, "アプリ全体への要望は5000文字までです").optional(),
  // 書き込み済みのスクリーンショット（data URL）。約6MBまで
  screenshot: z.string().max(8_000_000, "スクリーンショットが大きすぎます").optional(),
});

export const feedbackRoutes = new Hono<AppEnv>().post("/", validate("json", feedbackSchema), async (c) => {
  const github = gitHubTarget();
  if (!github) return c.json({ error: "要望の送り先（GitHub）が設定されていません。管理者に連絡してください" }, 503);

  const { screenshot: shotUrl, ...fb } = c.req.valid("json");
  const screenshot = shotUrl ? parseScreenshot(shotUrl) : null;
  if (shotUrl && !screenshot) return c.json({ error: "スクリーンショットの形式が正しくありません" }, 400);
  // スクリーンショットは Discord にだけ送る。Discord が無ければ捨てる
  const discord = discordTarget();
  const issue = await createIssue(github, buildIssue(fb, Boolean(screenshot && discord)));

  // Issue ができていれば要望は届いている。Discord に知らせられなくても失敗にはしない
  let discordUrl: string | null = null;
  let notified = false;
  if (discord) {
    try {
      discordUrl = await postToDiscord(discord, buildDiscordMessage(fb, issue, c.get("user").name, screenshot ?? undefined), screenshot);
      notified = true;
    } catch (e) {
      console.error(e);
    }
  }
  return c.json({ issueNumber: issue.number, issueUrl: issue.html_url, notified, discordUrl }, 201);
});
