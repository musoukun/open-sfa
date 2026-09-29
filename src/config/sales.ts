// 営業の分類に使う選択肢。チームで見直すときはここを直す
// 値（キー）は DB に保存されるので、変えるときは表示名だけにする

export const INDUSTRIES = {
  manufacturing: "製造",
  retail: "小売・卸",
  finance: "金融・保険",
  telecom: "通信・IT",
  construction: "建設・不動産",
  logistics: "運輸・物流",
  medical: "医療・福祉",
  public: "官公庁・自治体",
  education: "教育",
  service: "サービス",
  other: "その他",
} as const;
export type Industry = keyof typeof INDUSTRIES;

// 案件が生まれたきっかけ。同じ業種×同じきっかけで横に広げられるかを見るために使う
export const DEAL_SOURCES = {
  inquiry: "問い合わせ",
  seminar: "セミナー・イベント",
  exhibition: "展示会",
  referral: "紹介",
  existing: "既存のお客さんから",
  outbound: "こちらからの営業",
  partner: "協力会社から",
  other: "その他",
} as const;
export type DealSource = keyof typeof DEAL_SOURCES;

// 失注（消滅）したときの主な理由。どこを補強すればよいかを見るために使う
export const LOST_REASONS = {
  price: "価格が合わなかった",
  competitor: "他社に決まった",
  timing: "時期が合わなかった・延期",
  budget: "予算が取れなかった",
  requirements: "要件が合わなかった",
  noDecision: "お客さんが見送った",
  other: "その他",
} as const;
export type LostReason = keyof typeof LOST_REASONS;

// 年度の始まりの月（4月始まり）
export const FISCAL_YEAR_START_MONTH = 4;

// ダッシュボードで「最近の動き」として数える日数
export const RECENT_MOVEMENT_DAYS = 7;
