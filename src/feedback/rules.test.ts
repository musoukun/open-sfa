import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDiscordMessage, buildIssue } from "./rules";

const fb = { kind: "request" as const, body: "  案件一覧を受注予定月で並べ替えたい\n月末の見込みを確認するときに使いたい  ", pagePath: "/deals" };

test("Issue の題名は種別と内容の1行目。本文には種別・内容・画面が入り、送った人は入らない", () => {
  const issue = buildIssue(fb);
  assert.equal(issue.title, "[機能の要望] 案件一覧を受注予定月で並べ替えたい");
  assert.deepEqual(issue.labels, ["enhancement"]);
  assert.match(issue.body, /## 内容\n案件一覧を受注予定月で並べ替えたい\n月末の見込みを確認するときに使いたい\n/);
  assert.match(issue.body, /`\/deals`/);
});

test("長い1行目は題名で切り詰める", () => {
  const issue = buildIssue({ ...fb, kind: "bug", body: "あ".repeat(100) });
  assert.equal(issue.title, `[不具合] ${"あ".repeat(59)}…`);
  assert.deepEqual(issue.labels, ["bug"]);
});

test("Discord の投稿は Issue へのリンクと送った人を持ち、メンションで通知を飛ばさない", () => {
  const message = buildDiscordMessage({ ...fb, body: "@everyone 見てください" }, { number: 12, html_url: "https://github.com/o/r/issues/12" }, "営業 花子");
  assert.deepEqual(message.allowed_mentions, { parse: [] });
  const embed = message.embeds[0]!;
  assert.equal(embed.url, "https://github.com/o/r/issues/12");
  assert.match(embed.title, /^#12 \[機能の要望\]/);
  assert.equal(embed.fields.find((f) => f.name === "送った人")!.value, "営業 花子");
});
