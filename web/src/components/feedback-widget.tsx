import { useState, type FormEvent } from "react";
import { useLocation } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2, MessageSquarePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, SimpleSelect } from "@/components/common";
import { ScreenshotAnnotator } from "@/components/screenshot-annotator";
import { api } from "@/lib/api";
import { flattenAnnotations, type Mark } from "@/lib/annotations";
import { captureViewport, SCREENSHOT_IGNORE_ATTR } from "@/lib/screenshot";
import { appWideFieldOf, FEEDBACK_KINDS } from "@server/feedback/rules";

const KIND_OPTIONS = Object.entries(FEEDBACK_KINDS).map(([value, k]) => ({ value, label: k.label }));

type Sent = { issueNumber: number; issueUrl: string; notified: boolean };

// 画面の右下から要望を送る。押した瞬間の画面を撮り、線や文字を書き込んで一緒に送れる
// 届いた要望は GitHub の Issue になり、スクリーンショットは Discord の投稿にだけ付く
export function FeedbackWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [attachShot, setAttachShot] = useState(true);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [kind, setKind] = useState("");
  const [body, setBody] = useState("");
  const [appWide, setAppWide] = useState("");
  const appWideField = appWideFieldOf(kind);

  const openWithScreenshot = async () => {
    setCapturing(true);
    try {
      setShot(await captureViewport());
    } catch (e) {
      console.error(e);
      setShot(null);
      toast.warning("画面を撮れませんでした。文章だけで送れます");
    } finally {
      setCapturing(false);
    }
    setMarks([]);
    setAttachShot(true);
    setOpen(true);
  };

  const send = useMutation({
    mutationFn: async () => {
      const screenshot = shot && attachShot ? await flattenAnnotations(shot, marks) : undefined;
      return api<Sent>("/feedback", "POST", { kind, body, appWide: appWideField ? appWide : undefined, pagePath: pathname, screenshot });
    },
    onSuccess: (sent) => {
      toast.success(`要望を送りました（Issue #${sent.issueNumber}）`, {
        description: sent.notified ? "Discord にも知らせました" : undefined,
        action: { label: "開く", onClick: () => window.open(sent.issueUrl, "_blank", "noopener") },
      });
      setKind("");
      setBody("");
      setAppWide("");
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send.mutate();
  };

  return (
    <>
      <Button
        size="icon"
        {...{ [SCREENSHOT_IGNORE_ATTR]: "" }}
        className="fixed right-6 bottom-6 z-40 size-12 rounded-full shadow-lg"
        aria-label="要望を送る"
        disabled={capturing}
        onClick={openWithScreenshot}
      >
        {capturing ? <Loader2 className="size-5 animate-spin" /> : <MessageSquarePlus className="size-5" />}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-6xl"
          // 画像に文字を打っている途中の Esc は入力の取り消しだけにし、フォームは閉じない
          onEscapeKeyDown={(e) => e.target instanceof HTMLInputElement && e.target.getAttribute("aria-label") === "書き込む文字" && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>要望を送る</DialogTitle>
            <DialogDescription>開発チームに届きます。今の画面に線や文字を書き込んで、どこの話かを伝えられます</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} aria-label="要望を送る" className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid min-w-0 content-start gap-2">
              {shot ? (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={attachShot} onChange={(e) => setAttachShot(e.target.checked)} className="size-4 accent-primary" />
                    スクリーンショットを付ける
                  </label>
                  {attachShot && <ScreenshotAnnotator image={shot} marks={marks} onChange={setMarks} />}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">スクリーンショットはありません</p>
              )}
            </div>
            <div className="grid content-start gap-4">
              <Field label="種別" htmlFor="feedback-kind">
                <SimpleSelect id="feedback-kind" value={kind} onChange={setKind} options={KIND_OPTIONS} placeholder="選んでください" />
              </Field>
              <Field label="内容" htmlFor="feedback-body">
                <Textarea
                  id="feedback-body"
                  rows={8}
                  maxLength={5000}
                  placeholder="例: 案件一覧を受注予定月で並べ替えたい"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </Field>
              {appWideField && (
                <Field label={appWideField.label} htmlFor="feedback-app-wide">
                  <Textarea
                    id="feedback-app-wide"
                    rows={4}
                    maxLength={5000}
                    placeholder={appWideField.placeholder}
                    value={appWide}
                    onChange={(e) => setAppWide(e.target.value)}
                  />
                </Field>
              )}
              <p className="text-xs text-muted-foreground">
                文章は GitHub の Issue になります。お客さんの名前や金額など、外に出せない情報は書かないでください。スクリーンショットは Issue には載せず、社内の Discord にだけ送ります
              </p>
              <div className="flex justify-end">
                <Button type="submit" disabled={send.isPending || !kind || !body.trim()}>
                  {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                  {send.isPending ? "送信中…" : "送信"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
