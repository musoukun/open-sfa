import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DifficultyBadge, Field, PageHeader, SimpleSelect } from "@/components/common";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { dateTime } from "@/lib/format";
import type { DealDetail, DealOverview } from "@/lib/types";
import {
  COOPERATION_LABELS,
  COOPERATION_LEVELS,
  DIFFICULTY_FIELDS,
  OVERVIEW_GROUPS,
  OVERVIEW_TEXT_KEYS,
  RISK_LABELS,
  RISK_LEVELS,
  type CooperationLevel,
  type OverviewTextKey,
  type RiskLevel,
} from "@server/overviews/rules";

type OverviewForm = Record<OverviewTextKey, string> & {
  cooperationLevel: string;
  cooperationNote: string;
  riskLevel: string;
  riskNote: string;
};

const toForm = (o: DealOverview | null): OverviewForm => ({
  ...(Object.fromEntries(OVERVIEW_TEXT_KEYS.map((k) => [k, o?.[k] ?? ""])) as Record<OverviewTextKey, string>),
  cooperationLevel: o?.cooperationLevel ?? "",
  cooperationNote: o?.cooperationNote ?? "",
  riskLevel: o?.riskLevel ?? "",
  riskNote: o?.riskNote ?? "",
});

function FilledProgress({ overview }: { overview: DealOverview | null }) {
  const filled = OVERVIEW_TEXT_KEYS.filter((k) => overview?.[k]?.trim()).length;
  const total = OVERVIEW_TEXT_KEYS.length;
  return (
    <div className="grid gap-1.5" data-testid="overview-progress">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>書けている項目</span>
        <span className="tabular-nums">
          {filled} / {total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(filled / total) * 100}%` }} />
      </div>
    </div>
  );
}

function Value({ text }: { text: string | undefined }) {
  return text?.trim() ? <p className="text-sm whitespace-pre-wrap">{text}</p> : <p className="text-sm text-muted-foreground/60">まだ書かれていません</p>;
}

function OverviewView({ overview }: { overview: DealOverview | null }) {
  return (
    <div className="grid gap-6">
      {OVERVIEW_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5">
              {group.fields.map((f) => (
                <div key={f.key} className="grid gap-1 md:grid-cols-[240px_1fr] md:gap-6">
                  <dt className="text-sm font-medium text-muted-foreground">{f.label}</dt>
                  <dd>
                    <Value text={overview?.[f.key]} />
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            難易度 <DifficultyBadge cooperation={overview?.cooperationLevel ?? null} risk={overview?.riskLevel ?? null} />
          </CardTitle>
          <CardDescription>「協力度」と「予算・期間の無理」のうち、悪い方で決まります</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5">
            <div className="grid gap-1 md:grid-cols-[240px_1fr] md:gap-6">
              <dt className="text-sm font-medium text-muted-foreground">{DIFFICULTY_FIELDS.cooperation.label}</dt>
              <dd className="grid gap-1">
                <span className="text-sm font-medium">{overview?.cooperationLevel ? COOPERATION_LABELS[overview.cooperationLevel] : "未評価"}</span>
                <Value text={overview?.cooperationNote} />
              </dd>
            </div>
            <div className="grid gap-1 md:grid-cols-[240px_1fr] md:gap-6">
              <dt className="text-sm font-medium text-muted-foreground">{DIFFICULTY_FIELDS.risk.label}</dt>
              <dd className="grid gap-1">
                <span className="text-sm font-medium">{overview?.riskLevel ? RISK_LABELS[overview.riskLevel] : "未評価"}</span>
                <Value text={overview?.riskNote} />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewEditor(props: { deal: DealDetail; onDone: () => void }) {
  const [form, setForm] = useState(() => toForm(props.deal.overview));
  const set = (key: keyof OverviewForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const save = useAction(
    () =>
      api(`/deals/${props.deal.id}/overview`, "PUT", {
        ...form,
        cooperationLevel: (form.cooperationLevel || null) as CooperationLevel | null,
        riskLevel: (form.riskLevel || null) as RiskLevel | null,
        version: props.deal.overview?.version ?? 0,
      }),
    { success: "案件概要を保存しました", onSuccess: props.onDone },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined);
  };

  return (
    <form onSubmit={submit} className="grid gap-6">
      {OVERVIEW_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle>{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            {group.fields.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`ov-${f.key}`}>
                <Textarea id={`ov-${f.key}`} rows={3} placeholder={`例: ${f.example}`} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              </Field>
            ))}
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader>
          <CardTitle>難易度</CardTitle>
          <CardDescription>「協力度」と「予算・期間の無理」のうち、悪い方で難易度が決まります</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="grid content-start gap-3">
            <Field label={DIFFICULTY_FIELDS.cooperation.label} htmlFor="ov-cooperation">
              <p className="text-xs text-muted-foreground">{DIFFICULTY_FIELDS.cooperation.hint}</p>
              <SimpleSelect
                id="ov-cooperation"
                value={form.cooperationLevel}
                onChange={(v) => set("cooperationLevel", v)}
                options={COOPERATION_LEVELS.map((l) => ({ value: l, label: COOPERATION_LABELS[l] }))}
                noneLabel="未評価"
              />
            </Field>
            <Textarea
              aria-label="協力度についてのメモ"
              rows={3}
              placeholder={`例: ${DIFFICULTY_FIELDS.cooperation.example}`}
              value={form.cooperationNote}
              onChange={(e) => set("cooperationNote", e.target.value)}
            />
          </div>
          <div className="grid content-start gap-3">
            <Field label={DIFFICULTY_FIELDS.risk.label} htmlFor="ov-risk">
              <p className="text-xs text-muted-foreground">{DIFFICULTY_FIELDS.risk.hint}</p>
              <SimpleSelect
                id="ov-risk"
                value={form.riskLevel}
                onChange={(v) => set("riskLevel", v)}
                options={RISK_LEVELS.map((l) => ({ value: l, label: RISK_LABELS[l] }))}
                noneLabel="未評価"
              />
            </Field>
            <Textarea
              aria-label="予算・期間の無理についてのメモ"
              rows={3}
              placeholder={`例: ${DIFFICULTY_FIELDS.risk.example}`}
              value={form.riskNote}
              onChange={(e) => set("riskNote", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
      <div className="sticky bottom-4 flex justify-end gap-2">
        <Button type="button" variant="outline" className="bg-background" onClick={props.onDone}>
          キャンセル
        </Button>
        <Button type="submit" disabled={save.isPending}>
          保存する
        </Button>
      </div>
    </form>
  );
}

export function DealOverviewPage() {
  const id = Number(useParams().id);
  const [editing, setEditing] = useState(false);
  const { data: deal } = useQuery({ queryKey: ["deal", id], queryFn: () => api<DealDetail>(`/deals/${id}`) });
  if (!deal) return <Skeleton className="h-96" />;
  const overview = deal.overview;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            案件概要 <DifficultyBadge cooperation={overview?.cooperationLevel ?? null} risk={overview?.riskLevel ?? null} />
          </span>
        }
        description={
          <>
            <Link to={`/deals/${deal.id}`} className="hover:underline">
              {deal.customer.companyName}・{deal.name}
            </Link>
            {overview && (
              <span className="ml-2">
                （最終更新 {dateTime(overview.updatedAt)}・{overview.updatedByName}）
              </span>
            )}
          </>
        }
        actions={
          !editing && (
            <Button onClick={() => setEditing(true)}>
              <Pencil />
              編集する
            </Button>
          )
        }
      />
      <div className="mb-6 max-w-sm">
        <FilledProgress overview={overview} />
      </div>
      {editing ? <OverviewEditor key={overview?.version ?? 0} deal={deal} onDone={() => setEditing(false)} /> : <OverviewView overview={overview} />}
    </>
  );
}
