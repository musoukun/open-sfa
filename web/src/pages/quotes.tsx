import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmButton, EmptyRow, PageHeader, QuoteBadge } from "@/components/common";
import { QuoteEditor, type QuoteInput } from "@/components/quote-editor";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { dateTime, shortDate, todayJst, yen } from "@/lib/format";
import type { DealDetail, QuoteDetail, QuoteWithDeal } from "@/lib/types";
import { QUOTE_STATUSES, QUOTE_STATUS_LABELS, isEditable, nextStatuses, type QuoteStatus } from "@server/quotes/rules";
import { DEFAULT_QUOTE_VALID_DAYS, TAX_RATE_PERCENT } from "@server/config/business";

export function QuotesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "all";
  const { data: quotes } = useQuery({ queryKey: ["quotes"], queryFn: () => api<QuoteWithDeal[]>("/quotes") });
  const shown = quotes?.filter((q) => status === "all" || q.status === status);

  return (
    <>
      <PageHeader title="見積" description="見積は案件の画面から作成します" />
      <Tabs value={status} onValueChange={(v) => setParams(v === "all" ? {} : { status: v })} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">すべて</TabsTrigger>
          {QUOTE_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {QUOTE_STATUS_LABELS[s]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>見積番号</TableHead>
              <TableHead>件名</TableHead>
              <TableHead>顧客 / 案件</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>有効期限</TableHead>
              <TableHead className="text-right">合計（税込）</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown?.length === 0 && <EmptyRow colSpan={6}>該当する見積はありません</EmptyRow>}
            {shown?.map((q) => (
              <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotes/${q.id}`)}>
                <TableCell className="font-mono text-xs">{q.quoteNumber}</TableCell>
                <TableCell className="font-medium">{q.title}</TableCell>
                <TableCell>
                  <div>{q.deal.customer.companyName}</div>
                  <div className="text-xs text-muted-foreground">{q.deal.name}</div>
                </TableCell>
                <TableCell>
                  <QuoteBadge status={q.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{q.validUntil ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{yen(q.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

export function NewQuotePage() {
  const navigate = useNavigate();
  const dealId = Number(useSearchParams()[0].get("dealId"));
  const { data: deal } = useQuery({ queryKey: ["deal", dealId], queryFn: () => api<DealDetail>(`/deals/${dealId}`) });
  const create = useAction((input: QuoteInput) => api<{ id: number }>("/quotes", "POST", { ...input, dealId }), {
    success: "見積を作成しました",
    onSuccess: (q) => navigate(`/quotes/${q.id}`),
  });

  if (!deal) return <Skeleton className="h-96" />;
  return (
    <>
      <PageHeader
        title="見積を作る"
        description={
          <Link to={`/deals/${deal.id}`} className="hover:underline">
            {deal.customer.companyName}・{deal.name}
          </Link>
        }
      />
      <QuoteEditor
        initial={{ title: deal.name, validUntil: todayJst(DEFAULT_QUOTE_VALID_DAYS), lines: [] }}
        taxRate={TAX_RATE_PERCENT}
        submitLabel="作成する"
        pending={create.isPending}
        onSubmit={(input) => create.mutate(input)}
      />
    </>
  );
}

const ACTION_LABELS = {
  draft: "作成中に戻す",
  submitted: "提出する",
  accepted: "承諾にする",
  declined: "辞退にする",
  expired: "期限切れにする",
} satisfies Record<QuoteStatus, string>;

const ACTION_NOTES: Partial<Record<QuoteStatus, string>> = {
  submitted: "提出すると明細は変更できなくなります。",
  accepted: "承諾にすると、案件が自動で受注になります。",
};

export function QuoteDetailPage() {
  const id = Number(useParams().id);
  const { data: quote } = useQuery({ queryKey: ["quote", id], queryFn: () => api<QuoteDetail>(`/quotes/${id}`) });
  const save = useAction((input: QuoteInput) => api(`/quotes/${id}`, "PUT", { ...input, version: quote?.version }), { success: "見積を保存しました" });
  const changeStatus = useAction((to: QuoteStatus) => api(`/quotes/${id}/status`, "POST", { to, version: quote?.version }), {
    success: "見積の状態を変更しました",
  });

  if (!quote) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-base text-muted-foreground">{quote.quoteNumber}</span>
            {quote.title}
            <QuoteBadge status={quote.status} />
          </span>
        }
        description={
          <Link to={`/deals/${quote.dealId}`} className="hover:underline">
            {quote.deal.customer.companyName}・{quote.deal.name}
          </Link>
        }
        actions={nextStatuses(quote.status).map((to) => (
          <ConfirmButton
            key={to}
            variant={to === "submitted" || to === "accepted" ? "default" : "outline"}
            title={`「${QUOTE_STATUS_LABELS[to]}」にしますか？`}
            description={ACTION_NOTES[to]}
            onConfirm={() => changeStatus.mutate(to)}
          >
            {ACTION_LABELS[to]}
          </ConfirmButton>
        ))}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isEditable(quote.status) ? (
            <QuoteEditor
              key={quote.version}
              initial={quote}
              taxRate={quote.taxRate}
              submitLabel="保存する"
              pending={save.isPending}
              onSubmit={(input) => save.mutate(input)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>明細</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>作業内容</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">単価</TableHead>
                      <TableHead>作業担当</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quote.lines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.description}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.quantity} {l.unit}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{yen(l.unitPrice)}</TableCell>
                        <TableCell>{l.assignee?.name ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{yen(l.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>金額</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">小計</dt>
                  <dd className="tabular-nums">{yen(quote.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">消費税（{quote.taxRate}%）</dt>
                  <dd className="tabular-nums">{yen(quote.tax)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2 text-lg font-semibold">
                  <dt>合計</dt>
                  <dd className="tabular-nums" data-testid="quote-total">
                    {yen(quote.total)}
                  </dd>
                </div>
                <div className="flex justify-between pt-2 text-xs text-muted-foreground">
                  <dt>有効期限</dt>
                  <dd>{quote.validUntil ?? "なし"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>状態の履歴</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative grid gap-4 border-l pl-5" data-testid="quote-history">
                {quote.history.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary" />
                    <div className="text-sm">
                      {h.fromStatus ? `${QUOTE_STATUS_LABELS[h.fromStatus]} → ` : ""}
                      <span className="font-medium">{QUOTE_STATUS_LABELS[h.toStatus]}</span>
                    </div>
                    <div className="text-xs text-muted-foreground" title={dateTime(h.changedAt)}>
                      {shortDate(h.changedAt)}・{h.changedByName}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
