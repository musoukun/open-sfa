// Google Meet REST API から、1つの会議の文字起こしを取ってくる
// https://developers.google.com/workspace/meet/api/guides/artifacts
import { RuleViolation } from "../lib/session";
import { formatTranscript, jstDate, participantName, type MeetParticipant } from "./rules";

const MEET_API = "https://meet.googleapis.com/v2";

type ConferenceRecord = { name: string; startTime: string };
type Transcript = { name: string; state?: string };
type TranscriptEntry = { participant: string; text: string };

export type ImportedTranscript = { meetingDate: string; attendees: string; content: string };

async function get<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${MEET_API}/${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401 || res.status === 403) {
    throw new RuleViolation("Google の連携が切れているか、権限が足りません。個人設定から Google と連携し直してください");
  }
  if (!res.ok) throw new Error(`Meet API ${path} が ${res.status} を返しました: ${await res.text()}`);
  return (await res.json()) as T;
}

// ページに分かれた一覧を最後までたどる
async function listAll<T>(accessToken: string, path: string, key: string, pageSize: number): Promise<T[]> {
  const items: T[] = [];
  let pageToken = "";
  do {
    const sep = path.includes("?") ? "&" : "?";
    const page = await get<Record<string, unknown>>(accessToken, `${path}${sep}pageSize=${pageSize}${pageToken && `&pageToken=${encodeURIComponent(pageToken)}`}`);
    items.push(...((page[key] as T[] | undefined) ?? []));
    pageToken = (page["nextPageToken"] as string | undefined) ?? "";
  } while (pageToken);
  return items;
}

export async function fetchTranscript(accessToken: string, meetingCode: string): Promise<ImportedTranscript> {
  const filter = encodeURIComponent(`space.meeting_code = "${meetingCode}"`);
  const records = await listAll<ConferenceRecord>(accessToken, `conferenceRecords?filter=${filter}`, "conferenceRecords", 100);
  if (records.length === 0) {
    throw new RuleViolation("この会議の記録が見つかりません。会議の主催者か参加者の Google アカウントで連携しているか確認してください");
  }

  // 同じ URL で何度も会議した場合は、文字起こしがある一番新しい会議を使う
  records.sort((a, b) => b.startTime.localeCompare(a.startTime));
  for (const record of records) {
    const transcripts = await listAll<Transcript>(accessToken, `${record.name}/transcripts`, "transcripts", 100);
    if (transcripts.length === 0) continue;

    const entries: TranscriptEntry[] = [];
    for (const t of transcripts) entries.push(...(await listAll<TranscriptEntry>(accessToken, `${t.name}/entries`, "transcriptEntries", 100)));
    if (entries.length === 0) {
      if (transcripts.some((t) => t.state !== "FILE_GENERATED")) throw new RuleViolation("文字起こしをまだ作っているところです。しばらく待ってからやり直してください");
      throw new RuleViolation("文字起こしの中身を取り出せません。会議から30日を過ぎると取り込めなくなります");
    }

    const participants = await listAll<MeetParticipant>(accessToken, `${record.name}/participants`, "participants", 250);
    const names = new Map(participants.map((p) => [p.name, participantName(p)]));
    const speaker = (participant: string) => names.get(participant) ?? "（名前不明）";
    return {
      meetingDate: jstDate(record.startTime),
      attendees: [...new Set(participants.map(participantName))].join("・"),
      content: formatTranscript(entries.map((e) => ({ speaker: speaker(e.participant), text: e.text }))),
    };
  }
  throw new RuleViolation("この会議には文字起こしがありません。会議中に「文字起こし」を開始したか確認してください");
}
