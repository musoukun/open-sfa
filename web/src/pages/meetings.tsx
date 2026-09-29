import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Download, ListChecks, MessageSquareText, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyRow, Field, PageHeader } from "@/components/common";
import { api } from "@/lib/api";
import { useAction, useGoogleMeetStatus } from "@/lib/hooks";
import { dateTime, todayJst } from "@/lib/format";
import type { DealDetail, ImportedTranscript, Meeting, MeetingWithDeal } from "@/lib/types";

type MeetingForm = Pick<Meeting, "meetingDate" | "title" | "attendees" | "content" | "nextPreparations">;

const EMPTY: MeetingForm = { meetingDate: todayJst(), title: "", attendees: "", content: "", nextPreparations: "" };

export const meetingTitle = (m: Pick<Meeting, "title">) => m.title || "（商談名なし）";

// Google Meet の URL を貼ると、文字起こしを取ってきてフォームに入れる。保存はフォームの保存ボタンで行う
function MeetImport(props: { onImported: (t: ImportedTranscript) => void }) {
  const { data: status } = useGoogleMeetStatus();
  const [url, setUrl] = useState("");
  const load = useAction(() => api<ImportedTranscript>("/google-meet/import", "POST", { meetingUrl: url }), {
    success: "文字起こしを取り込みました。中身を確かめてから保存してください",
    onSuccess: (t) => {
      props.onImported(t);
      setUrl("");
    },
  });
  if (!status?.enabled) return null;
  if (!status.canReadMeet) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        <Link to="/settings" className="text-foreground underline">
          個人設定
        </Link>
        で Google と連携すると、Google Meet の文字起こしを取り込めます。
      </p>
    );
  }
  return (
    <Field label="Google Meet から取り込む" htmlFor="mt-meet-url">
      <div className="flex gap-2">
        <Input
          id="mt-meet-url"
          placeholder="https://meet.google.com/xxx-xxxx-xxx"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          // このフォームは商談の保存フォームの中にあるので、Enter で保存が走らないようにする
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (url.trim()) load.mutate(undefined);
          }}
        />
        <Button type="button" variant="outline" disabled={!url.trim() || load.isPending} onClick={() => load.mutate(undefined)}>
          <Download />
          {load.isPending ? "取り込み中…" : "取り込む"}
        </Button>
      </div>
    </Field>
  );
}

function MeetingFields(props: { form: MeetingForm; onChange: (f: MeetingForm) => void }) {
  const { form, onChange } = props;
  const text = (key: keyof MeetingForm) => ({ value: form[key], onChange: (e: { target: { value: string } }) => onChange({ ...form, [key]: e.target.value }) });
  // 書きかけのメモは消さず、文字起こしを後ろに足す
  const applyTranscript = (t: ImportedTranscript) =>
    onChange({
      ...form,
      meetingDate: t.meetingDate,
      attendees: form.attendees || t.attendees,
      content: form.content ? `${form.content}\n\n${t.content}` : t.content,
    });
  return (
    <div className="grid gap-5">
      <MeetImport onImported={applyTranscript} />
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <Field label="商談日" htmlFor="mt-date">
          <Input id="mt-date" type="date" required {...text("meetingDate")} />
        </Field>
        <Field label="商談名" htmlFor="mt-title">
          <Input id="mt-title" required placeholder="例: 初回ヒアリング、概算見積の説明" {...text("title")} />
        </Field>
      </div>
      <Field label="出席した人" htmlFor="mt-attendees">
        <Input id="mt-attendees" placeholder="例: 先方 事務長・現場監督／当社 営業・PM" {...text("attendees")} />
      </Field>
      <Field label="話したこと・分かったこと" htmlFor="mt-content">
        <Textarea
          id="mt-content"
          rows={8}
          placeholder="例: 見積の転記ミスが月に数件ある。現場はスマホで入力したい。予算は補助金しだいで来月決まる。"
          {...text("content")}
        />
      </Field>
      <Field label="次の打ち合わせまでに用意するもの" htmlFor="mt-next">
        <Textarea id="mt-next" rows={3} placeholder="例: 概算見積、似た案件の事例資料" {...text("nextPreparations")} />
      </Field>
      <p className="text-xs text-muted-foreground">分かったことのうち、案件全体に関わること（困りごと・範囲・前提など）は、案件概要にも書き足しておくと次の人に伝わります。</p>
    </div>
  );
}

export function MeetingsPage() {
  const navigate = useNavigate();
  const { data: meetings } = useQuery({ queryKey: ["meetings"], queryFn: () => api<MeetingWithDeal[]>("/meetings") });
  return (
    <>
      <PageHeader title="商談" description="すべての案件の打ち合わせ記録です。商談は案件の画面から記録します。" />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">商談日</TableHead>
              <TableHead>商談名</TableHead>
              <TableHead>顧客 / 案件</TableHead>
              <TableHead>次までに用意するもの</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings?.length === 0 && <EmptyRow colSpan={4}>まだ商談の記録がありません</EmptyRow>}
            {meetings?.map((m) => (
              <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/meetings/${m.id}`)}>
                <TableCell className="tabular-nums">{m.meetingDate}</TableCell>
                <TableCell className="font-medium">{meetingTitle(m)}</TableCell>
                <TableCell>
                  <div>{m.deal.customer.companyName}</div>
                  <div className="text-xs text-muted-foreground">{m.deal.name}</div>
                </TableCell>
                <TableCell className="max-w-72 truncate text-muted-foreground">{m.nextPreparations || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

export function NewMeetingPage() {
  const dealId = Number(useParams().id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const { data: deal } = useQuery({ queryKey: ["deal", dealId], queryFn: () => api<DealDetail>(`/deals/${dealId}`) });
  const create = useAction(() => api<{ id: number }>("/meetings", "POST", { ...form, dealId }), {
    success: "商談を記録しました",
    onSuccess: (m) => navigate(`/meetings/${m.id}`),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(undefined);
  };
  if (!deal) return <Skeleton className="h-96" />;
  const previous = deal.meetings[0];

  return (
    <>
      <PageHeader
        title="商談を記録する"
        description={
          <Link to={`/deals/${deal.id}`} className="hover:underline">
            {deal.customer.companyName}・{deal.name}
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={submit} className="lg:col-span-2">
          <Card>
            <CardContent className="grid gap-6">
              <MeetingFields form={form} onChange={setForm} />
              <div className="flex justify-end">
                <Button type="submit" disabled={create.isPending}>
                  記録する
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
        {previous?.nextPreparations && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">前回（{previous.meetingDate}）に宿題になったもの</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{previous.nextPreparations}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

// 上司や同僚が訪問の記録を読んで、次の打ち手のアドバイスを残す
function FeedbackCard({ meeting }: { meeting: MeetingWithDeal }) {
  const [body, setBody] = useState("");
  const add = useAction(() => api(`/meetings/${meeting.id}/comments`, "POST", { body }), {
    success: "フィードバックを残しました",
    onSuccess: () => setBody(""),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate(undefined);
  };
  const comments = meeting.comments ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="size-4" />
          アドバイス・フィードバック
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {comments.length === 0 && <p className="text-sm text-muted-foreground">まだありません。次の一手や、使えそうな過去の提案資料などを書いてあげてください。</p>}
        <ol className="grid gap-3" data-testid="meeting-feedback">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">
                {c.authorName}・{dateTime(c.createdAt)}
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ol>
        <form onSubmit={submit} className="grid gap-2">
          <Textarea
            aria-label="フィードバックを書く"
            rows={3}
            required
            placeholder="例: 決裁者が関わる前に、同じ業種で受注した事例資料を先に渡しておくと進みやすい"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={add.isPending || !body.trim()}>
              フィードバックを残す
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function MeetingDetailPage() {
  const id = Number(useParams().id);
  const [editing, setEditing] = useState(false);
  const { data: meeting } = useQuery({ queryKey: ["meeting", id], queryFn: () => api<MeetingWithDeal>(`/meetings/${id}`) });
  const [form, setForm] = useState(EMPTY);
  const save = useAction(() => api(`/meetings/${id}`, "PATCH", { ...form, version: meeting?.version }), {
    success: "商談を保存しました",
    onSuccess: () => setEditing(false),
  });

  if (!meeting) return <Skeleton className="h-96" />;
  const startEdit = () => {
    setForm({ meetingDate: meeting.meetingDate, title: meeting.title, attendees: meeting.attendees, content: meeting.content, nextPreparations: meeting.nextPreparations });
    setEditing(true);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined);
  };

  return (
    <>
      <PageHeader
        title={meetingTitle(meeting)}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {meeting.meetingDate}
            </span>
            <Link to={`/deals/${meeting.dealId}`} className="hover:underline">
              {meeting.deal.customer.companyName}・{meeting.deal.name}
            </Link>
            <span>記録: {meeting.authorName}</span>
          </span>
        }
        actions={
          !editing && (
            <>
              <Button variant="outline" asChild>
                <Link to={`/deals/${meeting.dealId}/overview`}>案件概要を見る</Link>
              </Button>
              <Button onClick={startEdit}>
                <Pencil />
                編集する
              </Button>
            </>
          )
        }
      />
      {editing ? (
        <form onSubmit={submit}>
          <Card>
            <CardContent className="grid gap-6">
              <MeetingFields form={form} onChange={setForm} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  保存する
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="grid content-start gap-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>話したこと・分かったこと</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{meeting.content || <span className="text-muted-foreground">まだ書かれていません</span>}</p>
              </CardContent>
            </Card>
            <FeedbackCard meeting={meeting} />
          </div>
          <div className="grid content-start gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="size-4" />
                  次の打ち合わせまでに用意するもの
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap" data-testid="meeting-next">
                  {meeting.nextPreparations || <span className="text-muted-foreground">なし</span>}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-4" />
                  出席した人
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{meeting.attendees || <span className="text-muted-foreground">記録なし</span>}</p>
                <p className="mt-4 text-xs text-muted-foreground">最終更新 {dateTime(meeting.updatedAt)}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
