import { Hono } from "hono";
import { z } from "zod";
import { auth, googleEnabled } from "../auth";
import { prisma } from "../db";
import { validate } from "../lib/validate";
import { RuleViolation, type AppEnv } from "../lib/session";
import { fetchTranscript } from "./client";
import { MEET_SCOPE, parseMeetingCode } from "./rules";

const findGoogleAccount = (userId: string) => prisma.account.findFirst({ where: { userId, providerId: "google" } });

// Better Auth は許可された権限をカンマ区切りで持つ
const hasMeetScope = (scope: string | null) => (scope ?? "").split(/[\s,]+/).includes(MEET_SCOPE);

export const googleMeetRoutes = new Hono<AppEnv>()
  .get("/status", async (c) => {
    const account = googleEnabled ? await findGoogleAccount(c.get("user").id) : null;
    // accountId は連携を解除するときに Better Auth へ渡す
    return c.json({ enabled: googleEnabled, accountId: account?.id ?? null, canReadMeet: hasMeetScope(account?.scope ?? null) });
  })
  // 文字起こしを取ってきて返すだけ。保存は商談の画面で、中身を確かめてから行う
  .post("/import", validate("json", z.object({ meetingUrl: z.string() })), async (c) => {
    if (!googleEnabled) throw new RuleViolation("Google 連携が設定されていません。管理者に連絡してください");
    const meetingCode = parseMeetingCode(c.req.valid("json").meetingUrl);
    if (!meetingCode) throw new RuleViolation("Google Meet の URL（https://meet.google.com/xxx-xxxx-xxx）を貼り付けてください");

    const account = await findGoogleAccount(c.get("user").id);
    if (!account || !hasMeetScope(account.scope)) {
      throw new RuleViolation("個人設定で Google と連携し、Meet の文字起こしを読む許可をしてください");
    }
    const { accessToken } = await auth.api.getAccessToken({ body: { accountId: account.id }, headers: c.req.raw.headers });
    return c.json(await fetchTranscript(accessToken, meetingCode));
  });
