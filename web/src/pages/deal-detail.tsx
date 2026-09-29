import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, FilePlus2, NotebookPen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton, DealProgressBadge, DifficultyBadge, EmptyRow, Field, MovementBadge, PageHeader, QuoteBadge, SimpleSelect } from "@/components/common";
import { meetingTitle } from "./meetings";
import { api } from "@/lib/api";
import { useAction, useActiveMemberOptions } from "@/lib/hooks";
import { shortDate, yen } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DEAL_SOURCE_OPTIONS } from "@/components/new-deal-dialog";
import { DEAL_SOURCES, INDUSTRIES, LOST_REASONS, type DealSource, type Industry } from "@server/config/sales";

const LOST_REASON_OPTIONS = Object.entries(LOST_REASONS).map(([value, label]) => ({ value, label }));
import type { DealDetail } from "@/lib/types";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  canAddContract,
  canCreateQuote,
  expectedDealAmount,
  movementOf,
  type DealStage,
} from "@server/deals/rules";
import { STAGE_COLORS } from "@/components/pipeline-charts";
import { cn } from "@/lib/utils";

// 営業パイプラインのどこにいるかを矢印で見せる。進行中なら押してフェーズを変えられる
function StageStepper(props: { deal: DealDetail; onChange: (stage: DealStage) => void; pending: boolean }) {
  const { deal } = props;
  const open = deal.status === "open";
  const current = DEAL_STAGES.indexOf(deal.stage);
  return (
    <div className="mb-6 flex flex-wrap items-stretch gap-1" data-testid="stage-stepper">
      {DEAL_STAGES.map((stage, i) => {
        const reached = deal.status === "won" || (open && i <= current);
        const isCurrent = open && i === current;
        return (
          <button
            key={stage}
            type="button"
            disabled={!open || props.pending || isCurrent}
            onClick={() => props.onChange(stage)}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex min-w-24 flex-1 items-center justify-center px-5 py-2 text-sm font-medium transition-colors [clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%,12px_50%)] first:[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%)]",
              reached ? "text-white" : "bg-muted text-muted-foreground",
              open && !isCurrent && "hover:opacity-80",
              isCurrent && "ring-2 ring-offset-2",
            )}
            style={reached ? { background: STAGE_COLORS[stage] } : undefined}
          >
            {DEAL_STAGE_LABELS[stage]}
          </button>
        );
      })}
      <div
        className={cn(
          "flex min-w-20 items-center justify-center rounded-r-md px-4 py-2 text-sm font-semibold",
          deal.status === "won" ? "bg-emerald-600 text-white" : deal.status === "lost" ? "bg-muted text-muted-foreground line-through" : "border border-dashed text-muted-foreground",
        )}
      >
        受注
      </div>
    </div>
  );
}

const toInfoForm = (deal: DealDetail) => ({
  name: deal.name,
  salesRepId: String(deal.salesRepId),
  expectedAmount: deal.expectedAmount === null ? "" : String(deal.expectedAmount),
  expectedCloseMonth: deal.expectedCloseMonth ?? "",
  source: deal.source as string,
});

function DealInfoCard({ deal }: { deal: DealDetail }) {
  const [form, setForm] = useState(() => toInfoForm(deal));
  useEffect(() => setForm(toInfoForm(deal)), [deal]);
  const members = useActiveMemberOptions([deal.salesRepId]);
  const fallbackAmount = expectedDealAmount(null, deal.quotes);
  const save = useAction(
    () =>
      api(`/deals/${deal.id}`, "PATCH", {
        name: form.name,
        salesRepId: Number(form.salesRepId),
        expectedAmount: form.expectedAmount === "" ? null : Number(form.expectedAmount),
        expectedCloseMonth: form.expectedCloseMonth || null,
        source: form.source,
        version: deal.version,
      }),
    { success: "案件を保存しました" },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>案件情報</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="案件名" htmlFor="deal-name">
            <Input id="deal-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="営業担当" htmlFor="deal-rep">
            <SimpleSelect id="deal-rep" value={form.salesRepId} onChange={(v) => setForm({ ...form, salesRepId: v })} options={members} />
          </Field>
          <Field label="見込み金額（税抜・円）" htmlFor="deal-amount">
            <Input
              id="deal-amount"
              type="number"
              min={0}
              placeholder={fallbackAmount === null ? "例: 5000000" : `空欄なら最新の見積の ${fallbackAmount.toLocaleString("ja-JP")}`}
              value={form.expectedAmount}
              onChange={(e) => setForm({ ...form, expectedAmount: e.target.value })}
            />
          </Field>
          <Field label="受注予定月" htmlFor="deal-close-month">
            <Input id="deal-close-month" type="month" value={form.expectedCloseMonth} onChange={(e) => setForm({ ...form, expectedCloseMonth: e.target.value })} />
          </Field>
          <Field label="きっかけ" htmlFor="deal-source">
            <SimpleSelect id="deal-source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} options={DEAL_SOURCE_OPTIONS} noneLabel="未設定" />
          </Field>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" variant="outline" disabled={save.isPending}>
              保存
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ContractCard({ deal }: { deal: DealDetail }) {
  const acceptedQuote = deal.quotes.find((q) => q.status === "accepted");
  const [form, setForm] = useState({ contractType: "", startDate: "", endDate: "", amount: String(acceptedQuote?.subtotal ?? "") });
  const create = useAction(
    () =>
      api(`/deals/${deal.id}/contract`, "POST", {
        contractType: form.contractType,
        startDate: form.startDate,
        endDate: form.endDate,
        amount: Number(form.amount),
        sourceQuoteId: acceptedQuote?.id,
      }),
    { success: "契約概要を登録しました" },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(undefined);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>契約概要</CardTitle>
        {!deal.contract && <CardDescription>受注した案件に1件だけ登録できます</CardDescription>}
      </CardHeader>
      <CardContent>
        {deal.contract ? (
          <dl className="grid gap-3 text-sm" data-testid="contract-summary">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">契約形態</dt>
              <dd className="font-medium">{CONTRACT_TYPE_LABELS[deal.contract.contractType]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">期間</dt>
              <dd>
                {deal.contract.startDate} 〜 {deal.contract.endDate}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">金額（税抜）</dt>
              <dd className="font-semibold tabular-nums">{yen(deal.contract.amount)}</dd>
            </div>
          </dl>
        ) : canAddContract(deal.status, false) ? (
          <form onSubmit={submit} className="grid gap-3">
            <Field label="契約形態" htmlFor="contract-type">
              <SimpleSelect
                id="contract-type"
                value={form.contractType}
                onChange={(v) => setForm({ ...form, contractType: v })}
                options={CONTRACT_TYPES.map((t) => ({ value: t, label: CONTRACT_TYPE_LABELS[t] }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="開始日" htmlFor="contract-start">
                <Input id="contract-start" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </Field>
              <Field label="終了日" htmlFor="contract-end">
                <Input id="contract-end" type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </Field>
            </div>
            <Field label="金額（税抜）" htmlFor="contract-amount">
              <Input id="contract-amount" type="number" min={0} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Button type="submit" disabled={create.isPending || !form.contractType}>
              契約概要を登録
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">案件が受注になると登録できます。</p>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewSummaryCard({ deal }: { deal: DealDetail }) {
  const o = deal.overview;
  const highlights = [
    { label: "お客さんが今、困っていること", text: o?.problem },
    { label: "受注に対してブロッカーになるもの", text: o?.blockers },
    { label: "まだ分かっていないこと", text: o?.openQuestions },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          案件概要 <DifficultyBadge cooperation={o?.cooperationLevel ?? null} risk={o?.riskLevel ?? null} />
        </CardTitle>
        <CardDescription>打ち合わせで分かったことを、案件の概要として書き足していきます</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/deals/${deal.id}/overview`}>
              <NotebookPen />
              {o ? "案件概要を開く" : "案件概要を書く"}
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4">
          {highlights.map((h) => (
            <div key={h.label} className="grid gap-1">
              <dt className="text-xs font-medium text-muted-foreground">{h.label}</dt>
              <dd className="line-clamp-3 text-sm whitespace-pre-wrap">{h.text?.trim() || <span className="text-muted-foreground/60">まだ書かれていません</span>}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function MeetingsCard({ deal }: { deal: DealDetail }) {
  const navigate = useNavigate();
  const latest = deal.meetings[0];
  return (
    <Card>
      <CardHeader>
        <CardTitle>商談</CardTitle>
        <CardAction>
          <Button size="sm" onClick={() => navigate(`/deals/${deal.id}/meetings/new`)}>
            <Plus />
            商談を記録する
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {latest?.nextPreparations && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="text-xs font-medium text-muted-foreground">次の打ち合わせまでに用意するもの（{latest.meetingDate}の商談より）</div>
            <p className="mt-1 text-sm whitespace-pre-wrap">{latest.nextPreparations}</p>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">商談日</TableHead>
              <TableHead>商談名</TableHead>
              <TableHead>出席した人</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deal.meetings.length === 0 && <EmptyRow colSpan={3}>まだ商談の記録がありません</EmptyRow>}
            {deal.meetings.map((m) => (
              <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/meetings/${m.id}`)}>
                <TableCell className="tabular-nums">{m.meetingDate}</TableCell>
                <TableCell className="font-medium">{meetingTitle(m)}</TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">{m.attendees || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LoseDealDialog(props: { onConfirm: (reason: string, note: string) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    props.onConfirm(reason, note);
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">失注にする</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>失注（消滅）にしますか？</DialogTitle>
            <DialogDescription>元には戻せません。理由を残しておくと、どのフェーズで何が原因で落ちているかを振り返れます。</DialogDescription>
          </DialogHeader>
          <Field label="主な理由" htmlFor="lost-reason">
            <SimpleSelect id="lost-reason" value={reason} onChange={setReason} options={LOST_REASON_OPTIONS} />
          </Field>
          <Field label="くわしく（任意）" htmlFor="lost-note">
            <Textarea id="lost-note" rows={3} placeholder="例: 他社の方が導入実績が多いと判断された" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={!reason || props.pending}>
              失注にする
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// 案件の動き（前進・後退・受注・失注）を新しい順に並べる
function EventsCard({ deal }: { deal: DealDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>案件の動き</CardTitle>
        <CardDescription>フェーズの前進・後退と、受注・失注の記録です</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3" data-testid="deal-events">
          {deal.events.length === 0 && <p className="text-sm text-muted-foreground">まだ記録がありません</p>}
          {deal.events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <MovementBadge movement={movementOf(e.kind, e.fromStage, e.toStage)} />
              <span>
                {e.fromStage && DEAL_STAGE_LABELS[e.fromStage]}
                {e.fromStage && e.toStage && " → "}
                {e.toStage && DEAL_STAGE_LABELS[e.toStage]}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {shortDate(e.createdAt)}・{e.changedByName}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// 同じ業種・同じきっかけの案件。うまくいった提案は流用し、落ちた理由は先回りして潰す
function SimilarDealsCard({ deal }: { deal: DealDetail }) {
  const ready = deal.customer.industry && deal.source;
  return (
    <Card>
      <CardHeader>
        <CardTitle>同じ業種・同じきっかけの案件</CardTitle>
        <CardDescription>
          {ready
            ? `${INDUSTRIES[deal.customer.industry as Industry]}・${DEAL_SOURCES[deal.source as DealSource]}`
            : "顧客の業種と案件のきっかけを入れると、似た案件がここに出ます"}
        </CardDescription>
      </CardHeader>
      {ready && (
        <CardContent className="grid gap-2">
          {deal.similar.length === 0 && <p className="text-sm text-muted-foreground">まだ似た案件はありません</p>}
          {deal.similar.map((s) => (
            <Link key={s.id} to={`/deals/${s.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{s.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.customer.companyName}・{s.salesRep.name}
                  {s.lostReason && `・${LOST_REASONS[s.lostReason]}`}
                </div>
              </div>
              <DealProgressBadge status={s.status} stage={s.stage} />
            </Link>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export function DealDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: deal } = useQuery({ queryKey: ["deal", id], queryFn: () => api<DealDetail>(`/deals/${id}`) });
  const changeStatus = useAction(
    (v: { to: "won" | "lost"; lostReason?: string; lostNote?: string }) => api(`/deals/${id}/status`, "POST", { ...v, version: deal?.version }),
    { success: "案件の状態を変更しました" },
  );

  const changeStage = useAction((stage: DealStage) => api(`/deals/${id}/stage`, "POST", { stage, version: deal?.version }), {
    success: "フェーズを変更しました",
  });

  if (!deal) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {deal.name} <DealProgressBadge status={deal.status} stage={deal.stage} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link to={`/customers/${deal.customerId}`} className="inline-flex items-center gap-1 hover:underline">
              <Building2 className="size-3.5" />
              {deal.customer.companyName} {deal.customer.department}
            </Link>
            {deal.status === "lost" && deal.lostReason && (
              <span data-testid="lost-reason">
                失注の理由: {LOST_REASONS[deal.lostReason]}
                {deal.lostNote && `（${deal.lostNote}）`}
              </span>
            )}
          </span>
        }
        actions={
          deal.status === "open" && (
            <>
              <LoseDealDialog pending={changeStatus.isPending} onConfirm={(lostReason, lostNote) => changeStatus.mutate({ to: "lost", lostReason, lostNote })} />
              <ConfirmButton
                title="受注にしますか？"
                description="受注にすると元に戻せません。承諾した見積があれば、見積の画面で承諾にすると自動で受注になります。"
                onConfirm={() => changeStatus.mutate({ to: "won" })}
              >
                受注にする
              </ConfirmButton>
            </>
          )
        }
      />
      <StageStepper deal={deal} onChange={(s) => changeStage.mutate(s)} pending={changeStage.isPending} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-6 lg:col-span-2">
          <DealInfoCard deal={deal} />
          <OverviewSummaryCard deal={deal} />
          <Card>
            <CardHeader>
              <CardTitle>見積</CardTitle>
              {canCreateQuote(deal.status) && (
                <CardAction>
                  <Button size="sm" onClick={() => navigate(`/quotes/new?dealId=${deal.id}`)}>
                    <FilePlus2 />
                    見積を作る
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>見積番号</TableHead>
                    <TableHead>件名</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead className="text-right">合計（税込）</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deal.quotes.length === 0 && <EmptyRow colSpan={4}>まだ見積がありません</EmptyRow>}
                  {deal.quotes.map((q) => (
                    <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotes/${q.id}`)}>
                      <TableCell className="font-mono text-xs">{q.quoteNumber}</TableCell>
                      <TableCell>{q.title}</TableCell>
                      <TableCell>
                        <QuoteBadge status={q.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{yen(q.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <MeetingsCard deal={deal} />
        </div>
        <div className="grid content-start gap-6">
          <ContractCard key={deal.version} deal={deal} />
          <EventsCard deal={deal} />
          <SimilarDealsCard deal={deal} />
          <Card>
            <CardHeader>
              <CardTitle>顧客</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Link to={`/customers/${deal.customerId}`} className="font-medium hover:underline">
                {deal.customer.companyName} {deal.customer.department}
              </Link>
              {deal.customer.contactName && <div>担当: {deal.customer.contactName}</div>}
              {deal.customer.email && <div className="text-muted-foreground">{deal.customer.email}</div>}
              {deal.customer.phone && <div className="text-muted-foreground">{deal.customer.phone}</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
