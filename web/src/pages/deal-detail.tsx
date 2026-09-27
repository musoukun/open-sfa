import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, FilePlus2, NotebookPen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton, DealBadge, DifficultyBadge, EmptyRow, Field, PageHeader, QuoteBadge, SimpleSelect } from "@/components/common";
import { meetingTitle } from "./meetings";
import { api } from "@/lib/api";
import { useAction, useActiveMemberOptions } from "@/lib/hooks";
import { yen } from "@/lib/format";
import type { DealDetail } from "@/lib/types";
import { CONTRACT_TYPES, CONTRACT_TYPE_LABELS, canAddContract, canCreateQuote } from "@server/deals/rules";

function DealInfoCard({ deal }: { deal: DealDetail }) {
  const [form, setForm] = useState({ name: deal.name, salesRepId: String(deal.salesRepId) });
  useEffect(() => setForm({ name: deal.name, salesRepId: String(deal.salesRepId) }), [deal]);
  const members = useActiveMemberOptions([deal.salesRepId]);
  const save = useAction(
    () => api(`/deals/${deal.id}`, "PATCH", { name: form.name, salesRepId: Number(form.salesRepId), version: deal.version }),
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
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="案件名" htmlFor="deal-name">
            <Input id="deal-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="営業担当" htmlFor="deal-rep">
            <SimpleSelect id="deal-rep" value={form.salesRepId} onChange={(v) => setForm({ ...form, salesRepId: v })} options={members} />
          </Field>
          <Button type="submit" variant="outline" disabled={save.isPending}>
            保存
          </Button>
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

export function DealDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: deal } = useQuery({ queryKey: ["deal", id], queryFn: () => api<DealDetail>(`/deals/${id}`) });
  const changeStatus = useAction((to: "won" | "lost") => api(`/deals/${id}/status`, "POST", { to, version: deal?.version }), {
    success: "案件の状態を変更しました",
  });

  if (!deal) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {deal.name} <DealBadge status={deal.status} />
          </span>
        }
        description={
          <Link to={`/customers/${deal.customerId}`} className="inline-flex items-center gap-1 hover:underline">
            <Building2 className="size-3.5" />
            {deal.customer.companyName} {deal.customer.department}
          </Link>
        }
        actions={
          deal.status === "open" && (
            <>
              <ConfirmButton title="失注にしますか？" description="失注にすると元に戻せません。" onConfirm={() => changeStatus.mutate("lost")}>
                失注にする
              </ConfirmButton>
              <ConfirmButton
                title="受注にしますか？"
                description="受注にすると元に戻せません。承諾した見積があれば、見積の画面で承諾にすると自動で受注になります。"
                onConfirm={() => changeStatus.mutate("won")}
              >
                受注にする
              </ConfirmButton>
            </>
          )
        }
      />
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
