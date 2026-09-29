import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { MessageSquarePlus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, SimpleSelect } from "@/components/common";
import { api } from "@/lib/api";
import { FEEDBACK_KINDS } from "@server/feedback/rules";

const KIND_OPTIONS = Object.entries(FEEDBACK_KINDS).map(([value, k]) => ({ value, label: k.label }));

type Sent = { issueNumber: number; issueUrl: string; notified: boolean };

// 画面の右下から、今見ている画面についての要望を送る。届いた要望は GitHub の Issue になり、Discord に知らせが行く
export function FeedbackWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = useMutation({
    mutationFn: () => api<Sent>("/feedback", "POST", { kind, body, pagePath: pathname }),
    onSuccess: (sent) => {
      toast.success(`要望を送りました（Issue #${sent.issueNumber}）`, {
        description: sent.notified ? "Discord にも知らせました" : undefined,
        action: { label: "開く", onClick: () => window.open(sent.issueUrl, "_blank", "noopener") },
      });
      setKind("");
      setBody("");
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send.mutate();
  };

  if (!open) {
    return (
      <Button size="icon" className="fixed right-6 bottom-6 z-40 size-12 rounded-full shadow-lg" aria-label="要望を送る" onClick={() => setOpen(true)}>
        <MessageSquarePlus className="size-5" />
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      aria-label="要望を送る"
      className="fixed right-6 bottom-6 z-40 grid w-[380px] max-w-[calc(100vw-2rem)] gap-4 rounded-xl border bg-background p-5 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">要望を送る</h2>
          <p className="text-sm text-muted-foreground">開発チームに届きます。今見ている画面も一緒に伝わります</p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="閉じる" onClick={() => setOpen(false)}>
          <X />
        </Button>
      </div>
      <Field label="種別" htmlFor="feedback-kind">
        <SimpleSelect id="feedback-kind" value={kind} onChange={setKind} options={KIND_OPTIONS} placeholder="選んでください" />
      </Field>
      <Field label="内容" htmlFor="feedback-body">
        <Textarea
          id="feedback-body"
          rows={6}
          autoFocus
          maxLength={5000}
          placeholder="例: 案件一覧を受注予定月で並べ替えたい"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      <p className="text-xs text-muted-foreground">送った内容は GitHub の Issue になります。お客さんの名前や金額など、外に出せない情報は書かないでください</p>
      <div className="flex justify-end">
        <Button type="submit" disabled={send.isPending || !kind || !body.trim()}>
          <Send />
          {send.isPending ? "送信中…" : "送信"}
        </Button>
      </div>
    </form>
  );
}
