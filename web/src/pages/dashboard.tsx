import { Link, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Briefcase, CalendarRange, FileText, Trophy, type LucideIcon } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DealProgressBadge, MovementBadge, PageHeader, SimpleSelect } from "@/components/common";
import { DEAL_STAGE_LABELS, MOVEMENT_LABELS, type Movement } from "@server/deals/rules";
import { PipelineByMonth, PipelineFunnel, type Measure } from "@/components/pipeline-charts";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useMembers } from "@/lib/hooks";
import { shortDate, yen, yenShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Dashboard } from "@/lib/types";
import { meetingTitle } from "./meetings";

function StatCard(props: { title: string; value: string; sub?: string; icon: LucideIcon; to: string }) {
  return (
    <Link to={props.to} className="block h-full">
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardDescription>{props.title}</CardDescription>
          <props.icon className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">{props.value}</div>
          {props.sub && <p className="mt-1 text-xs text-muted-foreground">{props.sub}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

const MOVEMENT_ORDER: Movement[] = ["new", "forward", "back", "won", "lost"];

// 案件は前進も後退も消滅もする。直近の動きを数と一覧で見せる
function MovementsCard({ movements }: { movements: Dashboard["recentMovements"] }) {
  const counts = Object.fromEntries(MOVEMENT_ORDER.map((m) => [m, movements.items.filter((i) => i.movement === m).length])) as Record<Movement, number>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>この{movements.days}日間の案件の動き</CardTitle>
        <CardDescription>前に進んだ案件だけでなく、後退した案件・消えた案件も見ておきます</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="movement-counts">
          {MOVEMENT_ORDER.map((m) => (
            <div key={m} className="rounded-lg border p-3">
              <MovementBadge movement={m} />
              <div className="mt-2 text-2xl font-semibold" aria-label={`${MOVEMENT_LABELS[m]} ${counts[m]}件`}>
                {counts[m]}
                <span className="ml-0.5 text-sm font-normal text-muted-foreground">件</span>
              </div>
            </div>
          ))}
        </div>
        {movements.items.length > 0 && (
          <ol className="grid gap-1">
            {movements.items.slice(0, 8).map((i) => (
              <li key={i.id}>
                <Link to={`/deals/${i.deal.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                  <MovementBadge movement={i.movement} />
                  <span className="font-medium">{i.deal.name}</span>
                  <span className="text-muted-foreground">{i.deal.customer.companyName}</span>
                  {i.movement !== "new" && i.fromStage && (
                    <span className="text-muted-foreground">
                      {DEAL_STAGE_LABELS[i.fromStage as keyof typeof DEAL_STAGE_LABELS]}
                      {i.toStage && ` → ${DEAL_STAGE_LABELS[i.toStage as keyof typeof DEAL_STAGE_LABELS]}`}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {shortDate(i.createdAt)}・{i.changedByName}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { data: session } = authClient.useSession();
  const [params, setParams] = useSearchParams();
  const salesRepId = params.get("salesRepId") ?? "";
  const measure: Measure = params.get("measure") === "count" ? "count" : "amount";
  const { data: members = [] } = useMembers();
  const { data, isPlaceholderData } = useQuery({
    queryKey: ["dashboard", salesRepId],
    queryFn: () => api<Dashboard>(`/dashboard${salesRepId ? `?salesRepId=${salesRepId}` : ""}`),
    placeholderData: keepPreviousData,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const withRep = (path: string) => (salesRepId ? `${path}&salesRepId=${salesRepId}` : path);
  const pipelineTotal = data?.pipeline.stages.reduce((sum, s) => sum + s.amount, 0) ?? 0;

  return (
    <>
      <PageHeader title={`おかえりなさい、${session?.user.name ?? ""}さん`} description="営業の状況をひと目で確認できます" />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SimpleSelect
          className="w-52"
          aria-label="営業担当で絞り込む"
          value={salesRepId}
          onChange={(v) => setParam("salesRepId", v)}
          options={members.map((m) => ({ value: String(m.id), label: m.name }))}
          noneLabel="すべての営業担当"
        />
        <Tabs value={measure} onValueChange={(v) => setParam("measure", v === "amount" ? "" : v)}>
          <TabsList>
            <TabsTrigger value="amount">金額で見る</TabsTrigger>
            <TabsTrigger value="count">件数で見る</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {!data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className={cn("grid gap-6 transition-opacity", isPlaceholderData && "opacity-60")}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="進行中の案件"
              value={`${data.openDeals}件`}
              sub={`見込み合計 ${yenShort(pipelineTotal)}（税抜）`}
              icon={Briefcase}
              to={withRep("/deals?status=open")}
            />
            <StatCard
              title="提出中の見積"
              value={`${data.submittedQuotes.count}件`}
              sub={`合計 ${yen(data.submittedQuotes.total)}（税込）`}
              icon={FileText}
              to="/quotes?status=submitted"
            />
            <StatCard
              title="今月の受注"
              value={`${data.wonThisMonth.count}件`}
              sub={`${yenShort(data.wonThisMonth.amount)}（税抜）`}
              icon={Trophy}
              to={withRep("/deals?status=won")}
            />
            <StatCard
              title={`${data.wonThisFiscalYear.fiscalYear}年度の受注`}
              value={`${data.wonThisFiscalYear.count}件`}
              sub={`${yenShort(data.wonThisFiscalYear.amount)}（税抜）`}
              icon={CalendarRange}
              to={`/insights${salesRepId ? `?salesRepId=${salesRepId}` : ""}`}
            />
          </div>
          <MovementsCard movements={data.recentMovements} />

          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>営業パイプライン</CardTitle>
                <CardDescription>進行中の案件がどのフェーズにどれだけあるか。押すと案件の一覧を開きます</CardDescription>
              </CardHeader>
              <CardContent>
                <PipelineFunnel pipeline={data.pipeline} measure={measure} salesRepId={salesRepId} />
              </CardContent>
            </Card>
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle>受注予定月ごとの見込み</CardTitle>
                <CardDescription>いつごろ、どのフェーズの案件がどれだけ受注に届きそうか</CardDescription>
              </CardHeader>
              <CardContent>
                <PipelineByMonth pipeline={data.pipeline} measure={measure} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>最近動いた案件</CardTitle>
                <CardAction>
                  <Link to="/deals" className="text-xs text-muted-foreground hover:underline">
                    すべて見る
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-1">
                {data.recentDeals.length === 0 && <p className="text-sm text-muted-foreground">まだ案件がありません</p>}
                {data.recentDeals.map((d) => (
                  <Link key={d.id} to={`/deals/${d.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{d.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {d.customer.companyName}・{d.salesRep.name}
                      </div>
                    </div>
                    <DealProgressBadge status={d.status} stage={d.stage} />
                  </Link>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>最近の商談</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {data.recentMeetings.length === 0 && <p className="text-sm text-muted-foreground">まだ商談の記録がありません</p>}
                {data.recentMeetings.map((n) => (
                  <Link key={n.id} to={`/meetings/${n.id}`} className="rounded-md px-2 py-1 hover:bg-muted">
                    <div className="text-xs text-muted-foreground">
                      {shortDate(n.meetingDate)}・{n.deal.name}・{n.authorName}
                    </div>
                    <div className="text-sm font-medium">{meetingTitle(n)}</div>
                    <div className="line-clamp-2 text-sm text-muted-foreground">{n.content}</div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
