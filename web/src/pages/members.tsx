import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyRow, Field, PageHeader, StatusBadge } from "@/components/common";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useAction, useMembers } from "@/lib/hooks";

function NewMemberDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const create = useAction(() => api("/members", "POST", { name: form.name, email: form.email || undefined }), {
    success: "メンバーを登録しました",
    onSuccess: () => {
      setOpen(false);
      setForm({ name: "", email: "" });
    },
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
          メンバーを追加
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>メンバーを追加</DialogTitle>
            <DialogDescription>営業担当や作業担当として選べるようになります。ログインしない人も登録できます。</DialogDescription>
          </DialogHeader>
          <Field label="氏名" htmlFor="member-name">
            <Input id="member-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="メール（任意）" htmlFor="member-email">
            <Input id="member-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              追加
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MembersPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";
  const { data: members } = useMembers();
  const toggle = useAction((m: { id: number; isActive: boolean }) => api(`/members/${m.id}`, "PATCH", { isActive: !m.isActive }), {
    success: "メンバーを更新しました",
  });

  return (
    <>
      <PageHeader
        title="社内メンバー"
        description="営業担当や見積の作業担当として選べる人の一覧です"
        actions={isAdmin && <NewMemberDialog />}
      />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>メール</TableHead>
              <TableHead>状態</TableHead>
              {isAdmin && <TableHead className="w-32" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.length === 0 && <EmptyRow colSpan={4}>メンバーがいません</EmptyRow>}
            {members?.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-muted-foreground">{m.email ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge tone={m.isActive ? "green" : "neutral"}>{m.isActive ? "有効" : "無効"}</StatusBadge>
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => toggle.mutate(m)}>
                      {m.isActive ? "無効にする" : "有効にする"}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
