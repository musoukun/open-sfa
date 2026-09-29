// 要望を GitHub の Issue にして、Discord のチャンネルに知らせる
// https://docs.github.com/en/rest/issues/issues#create-an-issue
// https://docs.discord.com/developers/resources/message#create-message
import type { CreatedIssue, IssueDraft, Screenshot } from "./rules";

export type GitHubTarget = { token: string; repo: string };
export type DiscordTarget = { botToken: string; channelId: string; guildId: string };

const env = (name: string) => process.env[name]?.trim() ?? "";

// .env に書かれていなければ null。GitHub が無ければ要望は受け付けない、Discord が無ければ知らせないだけ
export function gitHubTarget(): GitHubTarget | null {
  const token = env("GITHUB_TOKEN");
  const repo = env("GITHUB_REPO");
  return token && repo ? { token, repo } : null;
}

export function discordTarget(): DiscordTarget | null {
  const botToken = env("DISCORD_BOT_TOKEN");
  const channelId = env("DISCORD_CHANNEL_ID");
  return botToken && channelId ? { botToken, channelId, guildId: env("DISCORD_GUILD_ID") } : null;
}

export async function createIssue(target: GitHubTarget, draft: IssueDraft): Promise<CreatedIssue> {
  const res = await fetch(`https://api.github.com/repos/${target.repo}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${target.token}`,
      "X-GitHub-Api-Version": "2026-03-10",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(draft),
  });
  if (!res.ok) throw new Error(`GitHub の Issue 作成が ${res.status} を返しました: ${await res.text()}`);
  const issue = (await res.json()) as CreatedIssue;
  return { number: issue.number, html_url: issue.html_url };
}

// 投稿したメッセージを開く URL を返す（サーバー ID が無ければ URL は作れないので null）
// スクリーンショットがあれば multipart で添付する（https://docs.discord.com/developers/reference#uploading-files）
export async function postToDiscord(target: DiscordTarget, message: unknown, screenshot?: Screenshot | null): Promise<string | null> {
  let body: BodyInit = JSON.stringify(message);
  const headers: Record<string, string> = { Authorization: `Bot ${target.botToken}` };
  if (screenshot) {
    const form = new FormData();
    form.append("payload_json", body);
    form.append("files[0]", new Blob([new Uint8Array(screenshot.bytes)], { type: screenshot.mime }), screenshot.filename);
    body = form;
  } else {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`https://discord.com/api/v10/channels/${target.channelId}/messages`, { method: "POST", headers, body });
  if (!res.ok) throw new Error(`Discord への投稿が ${res.status} を返しました: ${await res.text()}`);
  const { id } = (await res.json()) as { id: string };
  return target.guildId ? `https://discord.com/channels/${target.guildId}/${target.channelId}/${id}` : null;
}

const SCREENSHOT_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

// 画面から届いた data URL を、Discord に添付できるファイルにする。形が違えば null
export function parseScreenshot(dataUrl: string): Screenshot | null {
  const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const bytes = Buffer.from(m[2]!, "base64");
  return bytes.length > 0 ? { bytes, mime: m[1]!, filename: `screenshot.${SCREENSHOT_TYPES[m[1]!]}` } : null;
}

