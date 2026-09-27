import { test } from "node:test";
import assert from "node:assert/strict";
import { calcTotals, canTransition, formatQuoteNumber, isEditable, lineAmount } from "./rules";
import { buildMatchKey } from "../customers/rules";
import { canAddContract, canTransition as canDealTransition } from "../deals/rules";

test("0.5 人月を含む明細の小計・消費税・合計", () => {
  const lines = [
    { quantity: 0.5, unitPrice: 800_000 },
    { quantity: 2, unitPrice: 650_000 },
  ];
  assert.deepEqual(calcTotals(lines, 10), { subtotal: 1_700_000, tax: 170_000, total: 1_870_000 });
});

test("消費税は小計に1回だけ掛けて円未満を切り捨てる", () => {
  assert.deepEqual(calcTotals([{ quantity: 1, unitPrice: 999 }], 10), { subtotal: 999, tax: 99, total: 1098 });
  assert.equal(calcTotals([{ quantity: 1, unitPrice: 999 }], 10, "round").tax, 100);
});

test("行金額は円未満を四捨五入する", () => {
  assert.equal(lineAmount({ quantity: 0.333, unitPrice: 1000 }), 333);
});

test("明細が無ければ0円", () => {
  assert.deepEqual(calcTotals([], 10), { subtotal: 0, tax: 0, total: 0 });
});

test("見積の状態は決まった遷移しか許さない", () => {
  assert.ok(canTransition("draft", "submitted"));
  assert.ok(canTransition("submitted", "accepted"));
  assert.ok(canTransition("submitted", "declined"));
  assert.ok(canTransition("submitted", "expired"));
  assert.ok(!canTransition("draft", "accepted"));
  assert.ok(!canTransition("accepted", "draft"));
  assert.ok(!canTransition("declined", "submitted"));
});

test("明細を編集できるのは作成中だけ", () => {
  assert.ok(isEditable("draft"));
  assert.ok(!isEditable("submitted"));
});

test("見積番号は id から書式化する", () => {
  assert.equal(formatQuoteNumber(42), "Q-000042");
});

test("空白や全角半角だけが違う会社名＋部署は同じキーになる", () => {
  assert.equal(buildMatchKey("株式会社ＡＢＣ ", "開発部"), buildMatchKey("株式会社ABC", " 開発部"));
  assert.notEqual(buildMatchKey("株式会社ABC", "開発部"), buildMatchKey("株式会社ABC", "営業部"));
});

test("案件は進行中からだけ受注・失注にでき、契約概要は受注に1件だけ", () => {
  assert.ok(canDealTransition("open", "won"));
  assert.ok(!canDealTransition("won", "open"));
  assert.ok(!canDealTransition("lost", "won"));
  assert.ok(canAddContract("won", false));
  assert.ok(!canAddContract("won", true));
  assert.ok(!canAddContract("open", false));
});
