// 案件概要で書き留める項目。見出し・記入例は画面とサーバーで同じものを使う
export const OVERVIEW_GROUPS = [
  {
    title: "きっかけと困りごと",
    fields: [
      { key: "kickoff", label: "この案件が始まったきっかけ", example: "既存のお客さんからの紹介で、問い合わせフォームから相談が来た" },
      { key: "problem", label: "お客さんが今、困っていること", example: "見積と工事の予定を Excel と紙で管理していて、二重入力と転記ミスが多い" },
      { key: "goal", label: "お客さんが実現したいこと・確かめたいこと", example: "現場からスマホで進み具合を入れ、事務所で見積から請求まで続けて見たい" },
      { key: "futurePlan", label: "開発がうまくいったらどうしたいか", example: "協力会社にも使ってもらえるように広げたい" },
    ],
  },
  {
    title: "作るもの",
    fields: [
      { key: "phase", label: "今の段階（PoC・本開発など）", example: "要件定義。終わったら本開発の見積を出す" },
      { key: "users", label: "アプリを利用するユーザー", example: "事務所の担当者と、現場の職人（スマホで使う）" },
      { key: "integrations", label: "組み込み先・つなぐシステム", example: "今使っている会計ソフトに、請求データを CSV で渡す" },
      { key: "scope", label: "当社が作るもの・作らないもの", example: "見積・工程・請求の管理を作る。給与計算や在庫管理は今回やらない" },
      { key: "requirements", label: "求められる機能", example: "スマホで写真付きの日報を送れる。見積書は今の書式のまま出せる" },
      { key: "data", label: "扱うデータ（中身・形式・置き場所）", example: "過去の見積（Excel）と顧客台帳。お客さんの社内サーバーにある" },
      { key: "approach", label: "進め方", example: "まず見積だけを作って1か月使ってもらい、その後に工程と請求を足す" },
      { key: "deliverables", label: "納品物", example: "要件定義書・画面設計書・ソースコード・操作マニュアル" },
    ],
  },
  {
    title: "条件と体制",
    fields: [
      { key: "assumptions", label: "技術や環境の前提", example: "お客さんのクラウド契約は使えない。当社が用意するサーバーで動かす" },
      { key: "effort", label: "当社の工数・体制", example: "PM 1人・エンジニア 2人で3か月" },
      { key: "stakeholders", label: "関係する会社・人と役割", example: "社長が最終決定、事務長が窓口。会計ソフトの販売店にも相談が要る" },
      { key: "customerResponsibilities", label: "お客さん側でやってもらうこと", example: "過去データの取り出し、現場で試す人の用意" },
    ],
  },
  {
    title: "受注に向けて",
    fields: [
      { key: "blockers", label: "受注に対してブロッカーになるもの", example: "社長の決裁が必要。補助金が通るかで予算が変わる" },
      { key: "openQuestions", label: "まだ分かっていないこと・確認が必要なこと", example: "会計ソフトの取り込み形式。現場のスマホは会社支給か私物か" },
    ],
  },
] as const;

export type OverviewTextKey = (typeof OVERVIEW_GROUPS)[number]["fields"][number]["key"];

export const OVERVIEW_TEXT_KEYS = OVERVIEW_GROUPS.flatMap((g) => g.fields.map((f) => f.key)) as OverviewTextKey[];

export const COOPERATION_LEVELS = ["good", "normal", "poor"] as const;
export type CooperationLevel = (typeof COOPERATION_LEVELS)[number];
export const COOPERATION_LABELS = {
  good: "協力的",
  normal: "ふつう",
  poor: "あまり協力的でない",
} satisfies Record<CooperationLevel, string>;

export const RISK_LEVELS = ["none", "some", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export const RISK_LABELS = {
  none: "無理はない",
  some: "少し心配",
  high: "危険",
} satisfies Record<RiskLevel, string>;

export const DIFFICULTY_FIELDS = {
  cooperation: {
    label: "お客さんの協力度",
    hint: "データを出してもらえるか、こちらが提案する技術を受け入れてもらえるか",
    example: "データはすぐ出せるとのこと。クラウドの利用には慎重",
  },
  risk: {
    label: "予算・期間の無理",
    hint: "作りたいものに対して、予算が安すぎたり期間が短すぎたりしないか",
    example: "作りたいものに対して予算が半分ほど。納期が3か月しかない",
  },
} as const;

export type Difficulty = "low" | "medium" | "high";
export const DIFFICULTY_LABELS = { low: "低", medium: "中", high: "高" } satisfies Record<Difficulty, string>;

const COOPERATION_SCORE = { good: 0, normal: 1, poor: 2 } satisfies Record<CooperationLevel, number>;
const RISK_SCORE = { none: 0, some: 1, high: 2 } satisfies Record<RiskLevel, number>;
const DIFFICULTY_BY_SCORE: Difficulty[] = ["low", "medium", "high"];

// 協力度と無理の度合いのうち、悪い方で難易度を決める。どちらも未評価なら null
export function difficultyOf(cooperation: CooperationLevel | null, risk: RiskLevel | null): Difficulty | null {
  const scores = [cooperation && COOPERATION_SCORE[cooperation], risk && RISK_SCORE[risk]].filter((s): s is number => typeof s === "number");
  if (scores.length === 0) return null;
  return DIFFICULTY_BY_SCORE[Math.max(...scores)]!;
}
