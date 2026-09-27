import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTranscript, jstDate, parseMeetingCode, participantName } from "./rules";

test("Meet の URL や会議コードから会議コードを取り出す", () => {
  assert.equal(parseMeetingCode("https://meet.google.com/abc-defg-hij"), "abc-defg-hij");
  assert.equal(parseMeetingCode("https://meet.google.com/abc-defg-hij?authuser=0"), "abc-defg-hij");
  assert.equal(parseMeetingCode("  meet.google.com/ABC-DEFG-HIJ/  "), "abc-defg-hij");
  assert.equal(parseMeetingCode("abc-defg-hij"), "abc-defg-hij");
});

test("Meet の会議でないものは受け付けない", () => {
  assert.equal(parseMeetingCode("https://example.com/abc-defg-hij"), null);
  assert.equal(parseMeetingCode("https://meet.google.com/abc-defg-hijk"), null);
  assert.equal(parseMeetingCode(""), null);
});

test("続けて話した発言は1行にまとめ、空の発言は捨てる", () => {
  const text = formatTranscript([
    { speaker: "話者A", text: "よろしくお願いします。" },
    { speaker: "話者A", text: "今日は見積の件です。" },
    { speaker: "話者B", text: " " },
    { speaker: "話者B", text: "承知しました。" },
    { speaker: "話者A", text: "では始めます。" },
  ]);
  assert.equal(text, "話者A: よろしくお願いします。 今日は見積の件です。\n話者B: 承知しました。\n話者A: では始めます。");
});

test("参加者の名前は、ログインした人・ゲスト・電話の順で探す", () => {
  assert.equal(participantName({ name: "p1", signedinUser: { displayName: "話者A" } }), "話者A");
  assert.equal(participantName({ name: "p2", anonymousUser: { displayName: "ゲスト" } }), "ゲスト");
  assert.equal(participantName({ name: "p3" }), "（名前不明）");
});

test("会議の開始時刻は日本時間の日付にする", () => {
  assert.equal(jstDate("2026-09-27T16:30:00Z"), "2026-09-28");
});
