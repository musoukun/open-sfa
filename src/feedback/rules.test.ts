import { test } from "node:test";
import assert from "node:assert/strict";
import { appWideFieldOf, buildDiscordMessage, buildIssue } from "./rules";
import { parseScreenshot } from "./notify";

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

test("スクリーンショットがあれば、Issue には Discord を見るよう書き、Discord の投稿に画像を付ける", () => {
  assert.match(buildIssue(fb, true).body, /## スクリーンショット\nDiscord の通知に添付しています/);
  assert.doesNotMatch(buildIssue(fb).body, /スクリーンショット/);
  const message = buildDiscordMessage(fb, { number: 3, html_url: "https://github.com/o/r/issues/3" }, "営業 花子", { filename: "screenshot.jpg" });
  assert.deepEqual(message.attachments, [{ id: 0, filename: "screenshot.jpg" }]);
  assert.deepEqual(message.embeds[0]!.image, { url: "attachment://screenshot.jpg" });
});

test("画像の data URL だけをスクリーンショットとして受け付ける", () => {
  const shot = parseScreenshot(`data:image/jpeg;base64,${Buffer.from("jpeg-bytes").toString("base64")}`);
  assert.equal(shot!.filename, "screenshot.jpg");
  assert.equal(Buffer.from(shot!.bytes).toString(), "jpeg-bytes");
  assert.equal(parseScreenshot("data:text/html;base64,PGI+"), null);
  assert.equal(parseScreenshot("https://example.com/a.png"), null);
});
test("機能・デザインの要望だけ、アプリ全体への要望を書ける。書いたら Issue と Discord に載る", () => {
  assert.ok(appWideFieldOf("design"));
  assert.ok(appWideFieldOf("request"));
  assert.equal(appWideFieldOf("bug"), undefined);
  const design = { kind: "design" as const, body: "ボタンの色が画面ごとに違う", pagePath: "/", appWide: "主な操作のボタンは全画面で同じ色にしてほしい" };
  assert.equal(buildIssue(design).title, "[デザインの要望] ボタンの色が画面ごとに違う");
  assert.match(buildIssue(design).body, /## アプリ全体への要望\n主な操作のボタンは全画面で同じ色にしてほしい/);
  const message = buildDiscordMessage(design, { number: 4, html_url: "https://github.com/o/r/issues/4" }, "営業 花子");
  assert.equal(message.embeds[0]!.fields.find((f) => f.name === "アプリ全体への要望")!.value, "主な操作のボタンは全画面で同じ色にしてほしい");
  assert.doesNotMatch(buildIssue({ ...design, appWide: "  " }).body, /アプリ全体/);
});