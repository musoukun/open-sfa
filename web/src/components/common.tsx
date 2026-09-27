import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { DEAL_STATUS_LABELS, type DealStatus } from "@server/deals/rules";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@server/quotes/rules";

export function PageHeader(props: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>
        {props.description && <p className="text-sm text-muted-foreground">{props.description}</p>}
      </div>
      {props.actions && <div className="flex flex-wrap items-center gap-2">{props.actions}</div>}
    </div>
  );
}

const TONE = {
  neutral: "bg-muted text-muted-foreground",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  red: "bg-red-500/10 text-red-700 dark:text-red-300",
} as const;

export type Tone = keyof typeof TONE;

export function StatusBadge(props: { tone: Tone; children: ReactNode }) {
  return <Badge className={cn("font-medium", TONE[props.tone])}>{props.children}</Badge>;
}

const DEAL_TONE = { open: "amber", won: "green", lost: "neutral" } satisfies Record<DealStatus, Tone>;
const QUOTE_TONE = {
  draft: "neutral",
  submitted: "blue",
  accepted: "green",
  declined: "red",
  expired: "neutral",
} satisfies Record<QuoteStatus, Tone>;

export const DealBadge = ({ status }: { status: DealStatus }) => (
  <StatusBadge tone={DEAL_TONE[status]}>{DEAL_STATUS_LABELS[status]}</StatusBadge>
);

export const QuoteBadge = ({ status }: { status: QuoteStatus }) => (
  <StatusBadge tone={QUOTE_TONE[status]}>{QUOTE_STATUS_LABELS[status]}</StatusBadge>
);

export function Field(props: { label: string; htmlFor?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("grid gap-2", props.className)}>
      <Label htmlFor={props.htmlFor}>{props.label}</Label>
      {props.children}
    </div>
  );
}

const NONE = "__none__";

// Radix の Select は空文字の値を持てないので、「なし」は専用の値に置き換える
export function SimpleSelect(props: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  noneLabel?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Select value={props.value === "" ? (props.noneLabel ? NONE : "") : props.value} onValueChange={(v) => props.onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={props.id} className={cn("w-full", props.className)} aria-label={props["aria-label"]}>
        <SelectValue placeholder={props.placeholder ?? "選んでください"} />
      </SelectTrigger>
      <SelectContent>
        {props.noneLabel && <SelectItem value={NONE}>{props.noneLabel}</SelectItem>}
        {props.options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ConfirmButton(props: {
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  variant?: "default" | "outline" | "destructive" | "secondary";
  size?: "default" | "sm";
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={props.variant ?? "outline"} size={props.size} disabled={props.disabled}>
          {props.children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          {props.description && <AlertDialogDescription>{props.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={props.onConfirm}>{props.confirmLabel ?? "実行する"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EmptyRow(props: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={props.colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {props.children}
      </td>
    </tr>
  );
}
