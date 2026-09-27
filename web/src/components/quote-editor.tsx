import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, SimpleSelect } from "@/components/common";
import { useActiveMemberOptions } from "@/lib/hooks";
import { yen } from "@/lib/format";
import type { QuoteLine } from "@/lib/types";
import { calcTotals, lineAmount } from "@server/quotes/rules";
import { DEFAULT_QUOTE_UNIT } from "@server/config/business";

type LineDraft = { key: string; description: string; quantity: string; unit: string; unitPrice: string; assigneeId: string };

export type QuoteInput = {
  title: string;
  validUntil?: string;
  lines: { description: string; quantity: number; unit: string; unitPrice: number; assigneeId?: number }[];
};

const newLine = (): LineDraft => ({ key: crypto.randomUUID(), description: "", quantity: "1", unit: DEFAULT_QUOTE_UNIT, unitPrice: "", assigneeId: "" });

const toDraft = (l: QuoteLine): LineDraft => ({
  key: crypto.randomUUID(),
  description: l.description,
  quantity: String(l.quantity),
  unit: l.unit,
  unitPrice: String(l.unitPrice),
  assigneeId: l.assigneeId ? String(l.assigneeId) : "",
});

const toNumbers = (l: LineDraft) => ({ quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 });

export function QuoteEditor(props: {
  initial: { title: string; validUntil: string | null; lines: QuoteLine[] };
  taxRate: number;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: QuoteInput) => void;
}) {
  const [title, setTitle] = useState(props.initial.title);
  const [validUntil, setValidUntil] = useState(props.initial.validUntil ?? "");
  const [lines, setLines] = useState<LineDraft[]>(props.initial.lines.length ? props.initial.lines.map(toDraft) : [newLine()]);
  const members = useActiveMemberOptions(props.initial.lines.map((l) => l.assigneeId));
  const totals = calcTotals(lines.map(toNumbers), props.taxRate);

  const update = (key: string, patch: Partial<LineDraft>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    props.onSubmit({
      title,
      validUntil: validUntil || undefined,
      lines: lines.map((l) => ({
        description: l.description,
        ...toNumbers(l),
        unit: l.unit,
        assigneeId: l.assigneeId ? Number(l.assigneeId) : undefined,
      })),
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="件名" htmlFor="quote-title">
            <Input id="quote-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="有効期限" htmlFor="quote-valid">
            <Input id="quote-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>明細</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">作業内容</TableHead>
                <TableHead className="w-24">数量</TableHead>
                <TableHead className="w-24">単位</TableHead>
                <TableHead className="w-36">単価（円）</TableHead>
                <TableHead className="w-40">作業担当</TableHead>
                <TableHead className="w-32 text-right">金額</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={l.key} data-testid="quote-line">
                  <TableCell>
                    <Input aria-label={`${i + 1}行目の作業内容`} required value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input aria-label={`${i + 1}行目の数量`} type="number" step="0.01" min="0" required value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input aria-label={`${i + 1}行目の単位`} value={l.unit} onChange={(e) => update(l.key, { unit: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input aria-label={`${i + 1}行目の単価`} type="number" min="0" required value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <SimpleSelect
                      aria-label={`${i + 1}行目の作業担当`}
                      value={l.assigneeId}
                      onChange={(v) => update(l.key, { assigneeId: v })}
                      options={members}
                      noneLabel="なし"
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{yen(lineAmount(toNumbers(l)))}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${i + 1}行目を削除`}
                      disabled={lines.length === 1}
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, newLine()])}>
              <Plus />
              行を追加
            </Button>
          </div>
          <dl className="ml-auto grid w-full max-w-xs gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">小計</dt>
              <dd className="tabular-nums">{yen(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">消費税（{props.taxRate}%）</dt>
              <dd className="tabular-nums">{yen(totals.tax)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>合計</dt>
              <dd className="tabular-nums" data-testid="editor-total">
                {yen(totals.total)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={props.pending}>
          {props.submitLabel}
        </Button>
      </div>
    </form>
  );
}
