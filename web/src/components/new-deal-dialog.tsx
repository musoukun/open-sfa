import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, SimpleSelect } from "@/components/common";
import { api } from "@/lib/api";
import { useAction, useActiveMemberOptions } from "@/lib/hooks";
import type { Customer } from "@/lib/types";

export function NewDealDialog(props: { customerId?: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customerId: props.customerId ? String(props.customerId) : "", name: "", salesRepId: "" });
  const members = useActiveMemberOptions();
  const { data: customers = [] } = useQuery({ queryKey: ["customers", "active"], queryFn: () => api<Customer[]>("/customers") });

  const create = useAction(
    () => api<{ id: number }>("/deals", "POST", { customerId: Number(form.customerId), name: form.name, salesRepId: Number(form.salesRepId) }),
    { success: "案件を作成しました", onSuccess: (deal) => navigate(`/deals/${deal.id}`) },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          新しい案件
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>新しい案件</DialogTitle>
            <DialogDescription>顧客と営業担当を決めて案件を作ります</DialogDescription>
          </DialogHeader>
          <Field label="顧客" htmlFor="deal-customer">
            <SimpleSelect
              id="deal-customer"
              value={form.customerId}
              onChange={(v) => setForm({ ...form, customerId: v })}
              options={customers.map((c) => ({ value: String(c.id), label: `${c.companyName} ${c.department}`.trim() }))}
            />
          </Field>
          <Field label="案件名" htmlFor="deal-name">
            <Input id="deal-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="営業担当" htmlFor="deal-rep">
            <SimpleSelect id="deal-rep" value={form.salesRepId} onChange={(v) => setForm({ ...form, salesRepId: v })} options={members} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !form.customerId || !form.salesRepId}>
              作成
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
