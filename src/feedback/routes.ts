import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../lib/session";
import { validate } from "../lib/validate";
import { buildDiscordMessage, buildIssue, FEEDBACK_KINDS, type FeedbackKind } from "./rules";
import { createIssue, discordTarget, gitHubTarget, postToDiscord } from "./notify";

const feedbackSchema = z.object({
  kind: z.enum(Object.keys(FEEDBACK_KINDS) as [FeedbackKind, ...FeedbackKind[]], { error: "種別を選んでください" }),
  body: z.string().trim().min(1, "内容を書いてください").max(5000, "内容は5000文字までです"),
  pagePath: z.string().max(500).default("/"),
});

export const feedbackRoutes = new Hono<AppEnv>().post("/", validate("json", feedbackSchema), async (c) => {
  const github = gitHubTarget();
  if (!github) return c.json({ error: "要望の送り先（GitHub）が設定されていません。管理者に連絡してください" }, 503);

  const fb = c.req.valid("json");
  const issue = await createIssue(github, buildIssue(fb));

  // Issue ができていれば要望は届いている。Discord に知らせられなくても失敗にはしない
  const discord = discordTarget();
  let discordUrl: string | null = null;
  let notified = false;
  if (discord) {
    try {
      discordUrl = await postToDiscord(discord, buildDiscordMessage(fb, issue, c.get("user").name));
      notified = true;
    } catch (e) {
      console.error(e);
    }
  }
  return c.json({ issueNumber: issue.number, issueUrl: issue.html_url, notified, discordUrl }, 201);
});
