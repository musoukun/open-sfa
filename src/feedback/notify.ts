// 要望を GitHub の Issue にして、Discord のチャンネルに知らせる
// https://docs.github.com/en/rest/issues/issues#create-an-issue
// https://docs.discord.com/developers/resources/message#create-message
import type { CreatedIssue, IssueDraft } from "./rules";

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
export async function postToDiscord(target: DiscordTarget, message: unknown): Promise<string | null> {
  const res = await fetch(`https://discord.com/api/v10/channels/${target.channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${target.botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!res.ok) throw new Error(`Discord への投稿が ${res.status} を返しました: ${await res.text()}`);
  const { id } = (await res.json()) as { id: string };
  return target.guildId ? `https://discord.com/channels/${target.guildId}/${target.channelId}/${id}` : null;
}
