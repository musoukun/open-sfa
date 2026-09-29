import { test } from "node:test";
import assert from "node:assert/strict";
import { calcTotals, canTransition, formatQuoteNumber, isEditable, lineAmount } from "./rules";
import { buildMatchKey } from "../customers/rules";
import { canAddContract, canTransition as canDealTransition } from "../deals/rules";
import { difficultyOf } from "../overviews/rules";
import { expectedDealAmount } from "../deals/rules";
import { addMonths, buildPipeline } from "../dashboard/pipeline";
import { movementOf } from "../deals/rules";
import { fiscalYearOf, fiscalYearRange, lostByStage, summarizeOutcomes } from "../insights/rules";

test("フェーズの移動は、パイプラインの先へ進めば前進、戻れば後退", () => {
  assert.equal(movementOf("stage", "plan", "proposal"), "forward");
  assert.equal(movementOf("stage", "closing", "visit"), "back");
  assert.equal(movementOf("lost", "proposal", null), "lost");
  assert.equal(movementOf("created", null, "plan"), "new");
});

test("年度は4月始まりで、日本時間で判定する", () => {
  assert.equal(fiscalYearOf(new Date("2026-03-31T15:00:00Z")), 2026); // 日本時間 4/1 0:00
  assert.equal(fiscalYearOf(new Date("2026-03-31T14:59:59Z")), 2025);
  const { from, to } = fiscalYearRange(2026);
  assert.equal(from.toISOString(), "2026-03-31T15:00:00.000Z");
  assert.equal(to.toISOString(), "2027-03-31T15:00:00.000Z");
});

test("業種別の成績は、決着した案件のうち受注した割合を受注率にする", () => {
  const rows = summarizeOutcomes(
    [
      { key: "retail", status: "won", stage: "closing", amount: 300 },
      { key: "retail", status: "lost", stage: "proposal", amount: 100 },
      { key: "retail", status: "open", stage: "plan", amount: null },
      { key: "", status: "open", stage: "plan", amount: null },
    ],
    ["retail", "finance", ""],
  );
  assert.deepEqual(rows[0], { key: "retail", total: 3, open: 1, won: 1, lost: 1, wonAmount: 300, winRate: 0.5 });
  assert.equal(rows.length, 2);
  assert.equal(rows[1]!.winRate, null);
  assert.equal(lostByStage([{ status: "lost", stage: "proposal" }]).find((r) => r.stage === "proposal")!.count, 1);
});

test("見込み金額は入力を優先し、無ければ最新の有効な見積の税抜金額を使う", () => {
  const quotes = [
    { status: "declined", subtotal: 900 },
    { status: "submitted", subtotal: 500 },
  ];
  assert.equal(expectedDealAmount(1000, quotes), 1000);
  assert.equal(expectedDealAmount(null, quotes), 500);
  assert.equal(expectedDealAmount(null, [{ status: "expired", subtotal: 1 }]), null);
});

test("月の足し算は年をまたぐ", () => {
  assert.equal(addMonths("2026-11", 3), "2027-02");
});

test("パイプラインはフェーズ別と受注予定月別に集計する", () => {
  const p = buildPipeline(
    [
      { stage: "plan", expectedAmount: 100, expectedCloseMonth: "2026-09", quotes: [] },
      { stage: "plan", expectedAmount: null, expectedCloseMonth: null, quotes: [] },
      { stage: "closing", expectedAmount: null, expectedCloseMonth: "2026-08", quotes: [{ status: "submitted", subtotal: 300 }] },
      { stage: "proposal", expectedAmount: 50, expectedCloseMonth: "2027-06", quotes: [] },
    ],
    "2026-09",
  );
  assert.deepEqual(p.stages.find((s) => s.stage === "plan"), { stage: "plan", count: 2, amount: 100, unpriced: 1 });
  assert.equal(p.stages.find((s) => s.stage === "closing")!.amount, 300);
  const month = (key: string) => p.months.find((m) => m.key === key)!;
  assert.equal(month("overdue").stages.find((s) => s.stage === "closing")!.count, 1);
  assert.equal(month("2026-09").stages.find((s) => s.stage === "plan")!.amount, 100);
  assert.equal(month("none").stages.find((s) => s.stage === "plan")!.count, 1);
  assert.equal(month("later").stages.find((s) => s.stage === "proposal")!.count, 1);
  assert.deepEqual(p.months.map((m) => m.key).slice(0, 3), ["overdue", "2026-09", "2026-10"]);
});

test("案件の難易度は、協力度と予算・期間の無理のうち悪い方で決まる", () => {
  assert.equal(difficultyOf("good", "none"), "low");
  assert.equal(difficultyOf("good", "some"), "medium");
  assert.equal(difficultyOf("poor", "none"), "high");
  assert.equal(difficultyOf("normal", "high"), "high");
  assert.equal(difficultyOf(null, "some"), "medium");
  assert.equal(difficultyOf(null, null), null);
});

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
