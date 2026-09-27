import type { Child, PropsWithChildren } from "hono/jsx";
import { CLIENT_JS } from "./client";
import type { SessionUser } from "../auth";

const CSS = `
:root { --fg:#1f2328; --muted:#656d76; --line:#d0d7de; --bg:#f6f8fa; --accent:#0969da; --danger:#cf222e; --ok:#1a7f37; }
* { box-sizing: border-box; }
body { margin:0; font-family: system-ui, "Hiragino Sans", "Yu Gothic UI", sans-serif; color:var(--fg); background:#fff; }
header { display:flex; gap:20px; align-items:center; padding:10px 24px; border-bottom:1px solid var(--line); background:var(--bg); }
header .brand { font-weight:700; }
header nav { display:flex; gap:16px; flex:1; }
header a { color:var(--fg); text-decoration:none; }
header a:hover { color:var(--accent); }
main { max-width:1080px; margin:0 auto; padding:24px; }
h1 { font-size:22px; margin:0 0 16px; }
h2 { font-size:17px; margin:28px 0 10px; }
a { color:var(--accent); }
table { width:100%; border-collapse:collapse; font-size:14px; }
th, td { text-align:left; padding:8px; border-bottom:1px solid var(--line); vertical-align:top; }
th { color:var(--muted); font-weight:600; background:var(--bg); }
td.num, th.num { text-align:right; font-variant-numeric: tabular-nums; }
form.card, section.card { border:1px solid var(--line); border-radius:8px; padding:16px; margin:12px 0; }
.grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px; }
label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:var(--muted); }
input, select, textarea { font:inherit; padding:6px 8px; border:1px solid var(--line); border-radius:6px; color:var(--fg); }
textarea { min-height:70px; }
button { font:inherit; padding:6px 14px; border-radius:6px; border:1px solid var(--line); background:#fff; cursor:pointer; }
button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
button.danger { color:var(--danger); }
.actions { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; align-items:center; }
.inline { display:inline; }
.form-error { color:var(--danger); font-size:13px; white-space:pre-line; }
.badge { display:inline-block; padding:1px 8px; border-radius:10px; font-size:12px; border:1px solid var(--line); }
.badge.won, .badge.accepted { color:var(--ok); border-color:var(--ok); }
.badge.lost, .badge.declined, .badge.expired { color:var(--muted); }
.badge.submitted { color:var(--accent); border-color:var(--accent); }
.muted { color:var(--muted); font-size:13px; }
.totals { margin-left:auto; width:280px; }
.filters { display:flex; gap:12px; align-items:flex-end; }
`;

export function Layout(props: PropsWithChildren<{ title: string; user?: SessionUser }>) {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title} | sfa-lite</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        {props.user && (
          <header>
            <span class="brand">sfa-lite</span>
            <nav>
              <a href="/deals">案件</a>
              <a href="/customers">顧客</a>
              <a href="/members">メンバー</a>
            </nav>
            <span class="muted">{props.user.name}</span>
            <button type="button" data-logout>ログアウト</button>
          </header>
        )}
        <main>{props.children}</main>
        <script dangerouslySetInnerHTML={{ __html: CLIENT_JS }} />
      </body>
    </html>
  );
}

export function Field(props: PropsWithChildren<{ label: string }>) {
  return (
    <label>
      {props.label}
      {props.children}
    </label>
  );
}

export function FormError() {
  return <p class="form-error" role="alert"></p>;
}

export function Badge(props: { status: string; label: string }) {
  return <span class={`badge ${props.status}`}>{props.label}</span>;
}

export function Options(props: { items: { value: string | number; label: string }[]; selected?: string | number | null; empty?: string }) {
  const children: Child[] = [];
  if (props.empty !== undefined) children.push(<option value="">{props.empty}</option>);
  for (const item of props.items) {
    children.push(
      <option value={String(item.value)} selected={item.value === props.selected}>
        {item.label}
      </option>,
    );
  }
  return <>{children}</>;
}

export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

const JST_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" });
const JST_DATETIME = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" });

export const todayJst = (addDays = 0) => JST_DATE.format(new Date(Date.now() + addDays * 86_400_000));
export const dateTime = (d: Date) => JST_DATETIME.format(d);
