import nodemailer from "nodemailer";

const port = Number(process.env["SMTP_PORT"] ?? 1025);
const user = process.env["SMTP_USER"];

const transporter = nodemailer.createTransport({
  host: process.env["SMTP_HOST"] ?? "localhost",
  port,
  secure: port === 465,
  auth: user ? { user, pass: process.env["SMTP_PASS"] } : undefined,
});

const FROM = process.env["MAIL_FROM"] ?? "open-sfa <no-reply@sfa.test>";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// 本文の段落と、押してもらうボタン1つだけの簡単なメール
export async function sendActionMail(to: string, subject: string, paragraphs: string[], action: { label: string; url: string }) {
  const text = [...paragraphs, "", `${action.label}: ${action.url}`].join("\n");
  const html = `<div style="font-family:sans-serif;line-height:1.7;color:#171717">
${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")}
<p><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:10px 18px;background:#171717;color:#fff;border-radius:8px;text-decoration:none">${escapeHtml(action.label)}</a></p>
<p style="color:#737373;font-size:12px">ボタンが押せない場合は、次の URL を開いてください。<br>${escapeHtml(action.url)}</p>
</div>`;
  await transporter.sendMail({ from: FROM, to, subject, text, html });
}
