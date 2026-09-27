import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, FileText, Trophy, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DealBadge, PageHeader } from "@/components/common";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { shortDate, yen } from "@/lib/format";
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
          <div className="text-3xl font-semibold tabular-nums">{props.value}</div>
          {props.sub && <p className="mt-1 text-xs text-muted-foreground">{props.sub}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

export function DashboardPage() {
  const { data: session } = authClient.useSession();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });

  return (
    <>
      <PageHeader title={`おかえりなさい、${session?.user.name ?? ""}さん`} description="営業の状況をひと目で確認できます" />
      {!data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard title="進行中の案件" value={`${data.openDeals}件`} icon={Briefcase} to="/deals?status=open" />
            <StatCard
              title="提出中の見積"
              value={`${data.submittedQuotes.count}件`}
              sub={`合計 ${yen(data.submittedQuotes.total)}（税込）`}
              icon={FileText}
              to="/quotes?status=submitted"
            />
            <StatCard title="今月の受注" value={`${data.wonThisMonth}件`} icon={Trophy} to="/deals?status=won" />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>最近動いた案件</CardTitle>
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
                    <DealBadge status={d.status} />
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
        </>
      )}
    </>
  );
}
