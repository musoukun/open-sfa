import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { yen, yenShort } from "@/lib/format";
import type { Pipeline } from "@/lib/types";
import { DEAL_STAGES, DEAL_STAGE_LABELS, type DealStage } from "@server/deals/rules";

export type Measure = "count" | "amount";

// 段階の順番を表す青1色の濃淡（計画が淡く、クロージングが濃い）。検証スクリプトで --ordinal を通したもの
export const STAGE_COLORS = {
  plan: "#86b6ef",
  visit: "#5598e7",
  proposal: "#2a78d6",
  closing: "#1c5cab",
} satisfies Record<DealStage, string>;

const formatValue = (measure: Measure, v: number) => (measure === "count" ? `${v}件` : yenShort(v));

// 目盛りがきりのよい数になるよう、最大値を 1・2・5 × 10^n に切り上げる
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * power >= value)!;
  return step * power;
}

export function StageLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {DEAL_STAGES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: STAGE_COLORS[s] }} />
          {DEAL_STAGE_LABELS[s]}
        </span>
      ))}
    </div>
  );
}

export function PipelineFunnel(props: { pipeline: Pipeline; measure: Measure; salesRepId: string }) {
  const navigate = useNavigate();
  const max = Math.max(...props.pipeline.stages.map((s) => s[props.measure]), 0);
  const openStage = (stage: DealStage) =>
    navigate(`/deals?${new URLSearchParams({ status: "open", stage, ...(props.salesRepId && { salesRepId: props.salesRepId }) })}`);

  return (
    <div className="grid gap-2" data-testid="pipeline-funnel">
      {props.pipeline.stages.map((s) => {
        const value = s[props.measure];
        const width = max === 0 || value === 0 ? 0 : Math.max((value / max) * 100, 3);
        return (
          <button
            key={s.stage}
            type="button"
            onClick={() => openStage(s.stage)}
            className="group grid grid-cols-[84px_1fr_120px] items-center gap-3 rounded-md px-1 py-1 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
            aria-label={`${DEAL_STAGE_LABELS[s.stage]}: ${s.count}件、見込み ${yen(s.amount)}。この案件の一覧を開く`}
          >
            <span className="text-sm font-medium">{DEAL_STAGE_LABELS[s.stage]}</span>
            <span className="flex h-9 items-center justify-center">
              <span
                className="h-full rounded transition-all group-hover:opacity-85"
                style={{ width: `${width}%`, background: STAGE_COLORS[s.stage] }}
              />
            </span>
            <span className="text-right">
              <span className="block text-sm font-semibold">{formatValue(props.measure, value)}</span>
              <span className="block text-xs text-muted-foreground">
                {props.measure === "count" ? yenShort(s.amount) : `${s.count}件`}
                {s.unpriced > 0 && `・金額未入力 ${s.unpriced}件`}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const PLOT_HEIGHT = 200;

export function PipelineByMonth(props: { pipeline: Pipeline; measure: Measure }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);
  const { months } = props.pipeline;
  const totals = months.map((m) => m.stages.reduce((sum, s) => sum + s[props.measure], 0));
  const max = niceMax(Math.max(...totals, 0));
  const ticks = [max, max / 2, 0];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StageLegend />
        <Button variant="ghost" size="sm" onClick={() => setAsTable(!asTable)}>
          {asTable ? "グラフで見る" : "表で見る"}
        </Button>
      </div>
      {asTable ? (
        <Table data-testid="pipeline-table">
          <TableHeader>
            <TableRow>
              <TableHead>受注予定</TableHead>
              {DEAL_STAGES.map((s) => (
                <TableHead key={s} className="text-right">
                  {DEAL_STAGE_LABELS[s]}
                </TableHead>
              ))}
              <TableHead className="text-right">合計</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.map((m, i) => (
              <TableRow key={m.key}>
                <TableCell>{m.label}</TableCell>
                {m.stages.map((s) => (
                  <TableCell key={s.stage} className="text-right tabular-nums">
                    {s.count > 0 ? `${s.count}件 / ${yenShort(s.amount)}` : "—"}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium tabular-nums">{formatValue(props.measure, totals[i]!)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-[56px_1fr] gap-2">
          <div className="relative text-right text-xs text-muted-foreground tabular-nums" style={{ height: PLOT_HEIGHT }}>
            {ticks.map((t, i) => (
              <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
                {props.measure === "count" ? Math.round(t) : yenShort(t)}
              </span>
            ))}
          </div>
          <div>
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {ticks.map((_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-border" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex items-end gap-2 sm:gap-3">
                {months.map((m, i) => {
                  const nonZero = m.stages.filter((s) => s[props.measure] > 0);
                  return (
                    <div
                      key={m.key}
                      className="relative flex h-full flex-1 flex-col-reverse gap-[2px]"
                      onMouseEnter={() => setHovered(m.key)}
                      onMouseLeave={() => setHovered(null)}
                      tabIndex={0}
                      onFocus={() => setHovered(m.key)}
                      onBlur={() => setHovered(null)}
                      aria-label={`${m.label}: ${m.stages.map((s) => `${DEAL_STAGE_LABELS[s.stage]} ${s.count}件 ${yen(s.amount)}`).join("、")}`}
                    >
                      {nonZero.map((s, j) => (
                        <div
                          key={s.stage}
                          className={cn("w-full", j === nonZero.length - 1 && "rounded-t", hovered && hovered !== m.key && "opacity-50")}
                          style={{ height: `${(s[props.measure] / max) * 100}%`, background: STAGE_COLORS[s.stage] }}
                        />
                      ))}
                      {totals[i]! > 0 && (
                        <span
                          className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11px] whitespace-nowrap text-muted-foreground"
                          style={{ bottom: `calc(${(totals[i]! / max) * 100}% + 4px)` }}
                        >
                          {formatValue(props.measure, totals[i]!)}
                        </span>
                      )}
                      {hovered === m.key && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-6 w-44 -translate-x-1/2 rounded-md border bg-popover p-2 text-xs shadow-md">
                          <div className="mb-1 font-medium">{m.label}</div>
                          {[...m.stages].reverse().map((s) => (
                            <div key={s.stage} className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                <span className="size-2 rounded-sm" style={{ background: STAGE_COLORS[s.stage] }} />
                                {DEAL_STAGE_LABELS[s.stage]}
                              </span>
                              <span className="tabular-nums">
                                {s.count}件・{yenShort(s.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex gap-2 sm:gap-3">
              {months.map((m) => (
                <span key={m.key} className={cn("flex-1 text-center text-[11px] text-muted-foreground", m.key === props.pipeline.currentMonth && "font-semibold text-foreground")}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
