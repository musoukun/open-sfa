import { useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DealBadge, DifficultyBadge, EmptyRow, PageHeader, SimpleSelect } from "@/components/common";
import { NewDealDialog } from "@/components/new-deal-dialog";
import { api } from "@/lib/api";
import { useMembers } from "@/lib/hooks";
import { shortDate } from "@/lib/format";
import type { Deal } from "@/lib/types";
import { DEAL_STATUSES, DEAL_STATUS_LABELS } from "@server/deals/rules";

export function DealsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const salesRepId = params.get("salesRepId") ?? "";
  const { data: members = [] } = useMembers();
  const query = new URLSearchParams({ ...(status && { status }), ...(salesRepId && { salesRepId }) }).toString();
  const { data: deals } = useQuery({ queryKey: ["deals", query], queryFn: () => api<Deal[]>(`/deals?${query}`) });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <>
      <PageHeader title="案件" description="顧客との商談を案件ごとに追いかけます" actions={<NewDealDialog />} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status || "all"} onValueChange={(v) => setParam("status", v === "all" ? "" : v)}>
          <TabsList>
            <TabsTrigger value="all">すべて</TabsTrigger>
            {DEAL_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s}>
                {DEAL_STATUS_LABELS[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <SimpleSelect
          className="w-48"
          aria-label="営業担当で絞り込む"
          value={salesRepId}
          onChange={(v) => setParam("salesRepId", v)}
          options={members.map((m) => ({ value: String(m.id), label: m.name }))}
          noneLabel="すべての営業担当"
        />
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>案件名</TableHead>
              <TableHead>顧客</TableHead>
              <TableHead>営業担当</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>難易度</TableHead>
              <TableHead className="text-right">更新</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals?.length === 0 && <EmptyRow colSpan={6}>該当する案件はありません</EmptyRow>}
            {deals?.map((d) => (
              <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate(`/deals/${d.id}`)}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>
                  {d.customer.companyName} <span className="text-muted-foreground">{d.customer.department}</span>
                </TableCell>
                <TableCell>{d.salesRep.name}</TableCell>
                <TableCell>
                  <DealBadge status={d.status} />
                </TableCell>
                <TableCell>
                  <DifficultyBadge cooperation={d.overview?.cooperationLevel ?? null} risk={d.overview?.riskLevel ?? null} />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{shortDate(d.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
