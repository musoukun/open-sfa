import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmButton, DealBadge, EmptyRow, Field, PageHeader, StatusBadge } from "@/components/common";
import { NewDealDialog } from "@/components/new-deal-dialog";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import type { Customer, CustomerDetail } from "@/lib/types";

type CustomerForm = { companyName: string; department: string; contactName: string; email: string; phone: string; memo: string };

const EMPTY: CustomerForm = { companyName: "", department: "", contactName: "", email: "", phone: "", memo: "" };

const toForm = (c: Customer): CustomerForm => ({
  companyName: c.companyName,
  department: c.department,
  contactName: c.contactName ?? "",
  email: c.email ?? "",
  phone: c.phone ?? "",
  memo: c.memo ?? "",
});

// 空欄は送らず、サーバー側で「なし」として扱わせる
const toBody = (f: CustomerForm) => Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim() !== ""));

function CustomerFields(props: { form: CustomerForm; onChange: (f: CustomerForm) => void; idPrefix: string }) {
  const { form, onChange, idPrefix } = props;
  const input = (key: keyof CustomerForm, label: string, type = "text") => (
    <Field label={label} htmlFor={`${idPrefix}-${key}`}>
      <Input
        id={`${idPrefix}-${key}`}
        type={type}
        required={key === "companyName"}
        value={form[key]}
        onChange={(e) => onChange({ ...form, [key]: e.target.value })}
      />
    </Field>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {input("companyName", "会社名")}
      {input("department", "部署")}
      {input("contactName", "先方担当者")}
      {input("email", "メール", "email")}
      {input("phone", "電話")}
      <Field label="メモ" htmlFor={`${idPrefix}-memo`} className="sm:col-span-2">
        <Textarea id={`${idPrefix}-memo`} rows={3} value={form.memo} onChange={(e) => onChange({ ...form, memo: e.target.value })} />
      </Field>
    </div>
  );
}

function NewCustomerDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const create = useAction(() => api<{ id: number }>("/customers", "POST", toBody(form)), {
    success: "顧客を登録しました",
    onSuccess: (c) => navigate(`/customers/${c.id}`),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(undefined);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          新しい顧客
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>新しい顧客</DialogTitle>
            <DialogDescription>同じ会社名・部署の顧客は登録できません</DialogDescription>
          </DialogHeader>
          <CustomerFields form={form} onChange={setForm} idPrefix="new-customer" />
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              登録
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CustomersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") ?? "active";
  const { data: customers } = useQuery({ queryKey: ["customers", "all"], queryFn: () => api<Customer[]>("/customers?includeArchived=1") });
  const shown = customers?.filter((c) => (view === "archived" ? c.archivedAt : !c.archivedAt));

  return (
    <>
      <PageHeader title="顧客" description="取引先と見込み客を管理します" actions={<NewCustomerDialog />} />
      <Tabs value={view} onValueChange={(v) => setParams(v === "active" ? {} : { view: v })} className="mb-4">
        <TabsList>
          <TabsTrigger value="active">利用中</TabsTrigger>
          <TabsTrigger value="archived">アーカイブ済み</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>会社名</TableHead>
              <TableHead>部署</TableHead>
              <TableHead>先方担当者</TableHead>
              <TableHead className="text-right">案件数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown?.length === 0 && <EmptyRow colSpan={4}>顧客はありません</EmptyRow>}
            {shown?.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                <TableCell className="font-medium">{c.companyName}</TableCell>
                <TableCell>{c.department}</TableCell>
                <TableCell>{c.contactName}</TableCell>
                <TableCell className="text-right tabular-nums">{c._count?.deals ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

export function CustomerDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: customer } = useQuery({ queryKey: ["customer", id], queryFn: () => api<CustomerDetail>(`/customers/${id}`) });
  const [form, setForm] = useState(EMPTY);
  useEffect(() => {
    if (customer) setForm(toForm(customer));
  }, [customer]);

  const save = useAction(() => api(`/customers/${id}`, "PATCH", { ...toBody(form), version: customer?.version }), { success: "顧客を保存しました" });
  const archive = useAction((action: "archive" | "unarchive") => api(`/customers/${id}/${action}`, "POST", { version: customer?.version }), {
    success: "顧客の状態を変更しました",
  });

  if (!customer) return <Skeleton className="h-96" />;
  const archived = customer.archivedAt !== null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined);
  };

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {customer.companyName}
            {archived && <StatusBadge tone="neutral">アーカイブ済み</StatusBadge>}
          </span>
        }
        description={customer.department || undefined}
        actions={
          archived ? (
            <Button variant="outline" onClick={() => archive.mutate("unarchive")}>
              アーカイブを解除
            </Button>
          ) : (
            <>
              <ConfirmButton
                title="この顧客をアーカイブしますか？"
                description="一覧と案件作成の選択肢から外れます。データは消えません。"
                onConfirm={() => archive.mutate("archive")}
              >
                アーカイブ
              </ConfirmButton>
              <NewDealDialog customerId={customer.id} />
            </>
          )
        }
      />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>顧客情報</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4">
              <CustomerFields form={form} onChange={setForm} idPrefix="customer" />
              <div className="flex justify-end">
                <Button type="submit" disabled={save.isPending}>
                  保存
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>案件</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>案件名</TableHead>
                  <TableHead>営業担当</TableHead>
                  <TableHead>状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.deals.length === 0 && <EmptyRow colSpan={3}>まだ案件がありません</EmptyRow>}
                {customer.deals.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate(`/deals/${d.id}`)}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.salesRep.name}</TableCell>
                    <TableCell>
                      <DealBadge status={d.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
