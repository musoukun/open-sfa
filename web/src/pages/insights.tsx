import { useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyRow, PageHeader, SimpleSelect } from "@/components/common";
import { STAGE_COLORS } from "@/components/pipeline-charts";
import { api } from "@/lib/api";
import { useMembers } from "@/lib/hooks";
import { yenShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Insights, OutcomeRow } from "@/lib/types";
import { DEAL_STAGE_LABELS } from "@server/deals/rules";
import { DEAL_SOURCES, INDUSTRIES, LOST_REASONS } from "@server/config/sales";
import { fiscalYearOf } from "@server/insights/rules";

// 1系列だけの棒なので、色は1色（パレットの1番）にそろえる
const BAR_COLOR = "#2a78d6";

function RateBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-muted-foreground">決着なし</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full" style={{ width: `${rate * 100}%`, background: BAR_COLOR }} />
      </span>
      <span className="w-10 text-right text-sm tabular-nums">{Math.round(rate * 100)}%</span>
    </span>
  );
}

function OutcomeTable(props: { rows: OutcomeRow[]; labels: Record<string, string>; heading: string; testId: string }) {
  const sorted = [...props.rows].sort((a, b) => b.total - a.total);
  return (
    <Table data-testid={props.testId}>
      <TableHeader>
        <TableRow>
          <TableHead>{props.heading}</TableHead>
          <TableHead className="text-right">案件</TableHead>
          <TableHead className="text-right">受注</TableHead>
          <TableHead className="text-right">失注</TableHead>
          <TableHead className="text-right">進行中</TableHead>
          <TableHead>受注率</TableHead>
          <TableHead className="text-right">受注金額</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length === 0 && <EmptyRow colSpan={7}>この年度の案件はありません</EmptyRow>}
        {sorted.map((r) => (
          <TableRow key={r.key}>
            <TableCell className={cn("font-medium", !r.key && "text-muted-foreground")}>{r.key ? props.labels[r.key] : "未設定"}</TableCell>
            <TableCell className="text-right tabular-nums">{r.total}</TableCell>
            <TableCell className="text-right tabular-nums">{r.won}</TableCell>
            <TableCell className="text-right tabular-nums">{r.lost}</TableCell>
            <TableCell className="text-right tabular-nums">{r.open}</TableCell>
            <TableCell>
              <RateBar rate={r.winRate} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{r.wonAmount > 0 ? yenShort(r.wonAmount) : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CountBars(props: { rows: { key: string; label: string; count: number; color: string }[]; empty: string; testId: string }) {
  const max = Math.max(...props.rows.map((r) => r.count), 0);
  if (max === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{props.empty}</p>;
  return (
    <div className="grid gap-2" data-testid={props.testId}>
      {props.rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[140px_1fr_48px] items-center gap-3 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="h-5">
            {r.count > 0 && <span className="block h-full rounded-r" style={{ width: `${(r.count / max) * 100}%`, background: r.color }} />}
          </span>
          <span className="text-right tabular-nums">{r.count}件</span>
        </div>
      ))}
    </div>
  );
}

export function InsightsPage() {
  const [params, setParams] = useSearchParams();
  const currentFy = fiscalYearOf(new Date());
  const fiscalYear = params.get("fy") ?? String(currentFy);
  const salesRepId = params.get("salesRepId") ?? "";
  const { data: members = [] } = useMembers();
  const query = new URLSearchParams({ fiscalYear, ...(salesRepId && { salesRepId }) }).toString();
  const { data, isPlaceholderData } = useQuery({
    queryKey: ["insights", query],
    queryFn: () => api<Insights>(`/insights?${query}`),
    placeholderData: keepPreviousData,
  });
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="振り返り"
        description="どの業種・どのきっかけの案件が取れているか、どこで落ちているかを見て、うまくいく形を広げ、弱い所を補強します"
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <SimpleSelect
          className="w-36"
          aria-label="年度"
          value={fiscalYear}
          onChange={(v) => setParam("fy", v === String(currentFy) ? "" : v)}
          options={[currentFy, currentFy - 1, currentFy - 2].map((y) => ({ value: String(y), label: `${y}年度` }))}
        />
        <SimpleSelect
          className="w-52"
          aria-label="営業担当で絞り込む"
          value={salesRepId}
          onChange={(v) => setParam("salesRepId", v)}
          options={members.map((m) => ({ value: String(m.id), label: m.name }))}
          noneLabel="すべての営業担当"
        />
      </div>
      {!data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className={cn("grid gap-6 transition-opacity", isPlaceholderData && "opacity-60")}>
          <p className="text-xs text-muted-foreground">
            {data.fiscalYear}年度に作成・受注・失注のいずれかがあった案件が対象です。受注率は、決着した案件（受注＋失注）のうち受注した割合です。
          </p>
          <Card>
            <CardHeader>
              <CardTitle>業種別</CardTitle>
              <CardDescription>取れている業種は、同じ業種の別のお客さんにも広げられる可能性があります</CardDescription>
            </CardHeader>
            <CardContent>
              <OutcomeTable rows={data.byIndustry} labels={INDUSTRIES} heading="業種" testId="insights-industry" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>きっかけ別</CardTitle>
              <CardDescription>どのきっかけから生まれた案件が受注につながっているか</CardDescription>
            </CardHeader>
            <CardContent>
              <OutcomeTable rows={data.bySource} labels={DEAL_SOURCES} heading="きっかけ" testId="insights-source" />
            </CardContent>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>どのフェーズで失注しているか</CardTitle>
                <CardDescription>多いフェーズが、補強すべき所です</CardDescription>
              </CardHeader>
              <CardContent>
                <CountBars
                  testId="insights-lost-stage"
                  empty="この年度の失注はありません"
                  rows={data.lostByStage.map((r) => ({ key: r.stage, label: DEAL_STAGE_LABELS[r.stage], count: r.count, color: STAGE_COLORS[r.stage] }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>失注の理由</CardTitle>
              </CardHeader>
              <CardContent>
                <CountBars
                  testId="insights-lost-reason"
                  empty="この年度の失注はありません"
                  rows={[...data.lostByReason].sort((a, b) => b.count - a.count).map((r) => ({ key: r.reason, label: LOST_REASONS[r.reason], count: r.count, color: BAR_COLOR }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
