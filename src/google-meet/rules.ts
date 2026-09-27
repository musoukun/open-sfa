// Google Meet の議事録を商談の記録に取り込むときの決まり。外部 API には触れない

// 文字起こしを読むのに必要な権限。これだけなら Drive の権限はいらない
export const MEET_SCOPE = "https://www.googleapis.com/auth/meetings.space.readonly";

const MEETING_CODE = /(?:^|meet\.google\.com\/)([a-z]{3}-[a-z]{4}-[a-z]{3})(?:$|[/?#])/i;

// 「https://meet.google.com/abc-defg-hij?authuser=0」や「abc-defg-hij」から会議コードを取り出す
export function parseMeetingCode(input: string): string | null {
  const match = MEETING_CODE.exec(input.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

export type MeetParticipant = {
  name: string;
  signedinUser?: { displayName?: string };
  anonymousUser?: { displayName?: string };
  phoneUser?: { displayName?: string };
};

export const participantName = (p: MeetParticipant) =>
  p.signedinUser?.displayName || p.anonymousUser?.displayName || p.phoneUser?.displayName || "（名前不明）";

// 同じ人が続けて話した発言は1つにまとめ、「名前: 発言」の行にする
export function formatTranscript(entries: { speaker: string; text: string }[]): string {
  const blocks: { speaker: string; texts: string[] }[] = [];
  for (const { speaker, text } of entries) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    const last = blocks.at(-1);
    if (last?.speaker === speaker) last.texts.push(trimmed);
    else blocks.push({ speaker, texts: [trimmed] });
  }
  return blocks.map((b) => `${b.speaker}: ${b.texts.join(" ")}`).join("\n");
}

const JST_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" });

// 会議の開始時刻を、商談日の書式（YYYY-MM-DD・日本時間）にする
export const jstDate = (iso: string) => JST_DATE.format(new Date(iso));
