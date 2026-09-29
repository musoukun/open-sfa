export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

const JST_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" });
const JST_DATETIME = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" });
const JST_SHORT = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "short", day: "numeric" });

export const todayJst = (addDays = 0) => JST_DATE.format(new Date(Date.now() + addDays * 86_400_000));
export const dateTime = (iso: string) => JST_DATETIME.format(new Date(iso));
export const shortDate = (iso: string) => JST_SHORT.format(new Date(iso));

export const initials = (name: string) => name.trim().slice(0, 2);

// グラフの目盛りや要約用。1万円未満は円のまま出す
export const yenShort = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}億円`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString("ja-JP")}万円`;
  return `${n.toLocaleString("ja-JP")}円`;
};