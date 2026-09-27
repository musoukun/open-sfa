export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

const JST_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" });
const JST_DATETIME = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" });
const JST_SHORT = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "short", day: "numeric" });

export const todayJst = (addDays = 0) => JST_DATE.format(new Date(Date.now() + addDays * 86_400_000));
export const dateTime = (iso: string) => JST_DATETIME.format(new Date(iso));
export const shortDate = (iso: string) => JST_SHORT.format(new Date(iso));

export const initials = (name: string) => name.trim().slice(0, 2);
