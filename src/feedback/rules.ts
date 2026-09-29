// 画面右下の「要望を送る」から届いた声を、GitHub の Issue と Discord の投稿の形に整える

// 並び順がそのまま画面の選択肢の順になる。labels は GitHub に最初からあるラベルだけを使う
export const FEEDBACK_KINDS = {
  bug: { label: "不具合", labels: ["bug"] },
  request: { label: "機能の要望", labels: ["enhancement"] },
  usability: { label: "使いにくい所", labels: ["enhancement"] },
  question: { label: "質問", labels: ["question"] },
  other: { label: "その他", labels: [] },
} as const satisfies Record<string, { label: string; labels: string[] }>;

export type FeedbackKind = keyof typeof FEEDBACK_KINDS;

export type Feedback = { kind: FeedbackKind; body: string; pagePath: string };

export type IssueDraft = { title: string; body: string; labels: string[] };

const TITLE_MAX = 60;
const DISCORD_EXCERPT_MAX = 500;

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// 送った人の名前やメールは Issue に書かない（リポジトリが公開のときに見えてしまうため）
export function buildIssue(fb: Feedback): IssueDraft {
  const kind = FEEDBACK_KINDS[fb.kind];
  const firstLine = fb.body.trim().split("\n")[0]!.trim();
  return {
    title: `[${kind.label}] ${truncate(firstLine, TITLE_MAX)}`,
    body: [
      `## 種別\n${kind.label}`,
      `## 内容\n${fb.body.trim()}`,
      `## 送られた画面\n\`${fb.pagePath}\``,
      "---\nアプリの画面右下「要望を送る」から送信されました",
    ].join("\n\n"),
    labels: [...kind.labels],
  };
}

export type CreatedIssue = { number: number; html_url: string };

// Discord の Create Message に渡す本文。@everyone などが本文に入っていても通知は飛ばさない
export function buildDiscordMessage(fb: Feedback, issue: CreatedIssue, senderName: string) {
  const kind = FEEDBACK_KINDS[fb.kind];
  return {
    content: `新しい要望が届きました（${kind.label}）`,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: truncate(`#${issue.number} ${buildIssue(fb).title}`, 256),
        url: issue.html_url,
        description: truncate(fb.body.trim(), DISCORD_EXCERPT_MAX),
        fields: [
          { name: "種別", value: kind.label, inline: true },
          { name: "送った人", value: truncate(senderName, 100), inline: true },
          { name: "画面", value: truncate(fb.pagePath, 200), inline: true },
        ],
      },
    ],
  };
}
