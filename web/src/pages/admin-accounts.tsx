import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, MoreHorizontal, Plus, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmButton, Field, PageHeader, SimpleSelect, StatusBadge } from "@/components/common";
import { authClient } from "@/lib/auth-client";
import { unwrap, useAction } from "@/lib/hooks";
import { api } from "@/lib/api";
import { initials, shortDate } from "@/lib/format";

const ROLE_OPTIONS = [
  { value: "user", label: "一般ユーザー" },
  { value: "admin", label: "管理者" },
];

type Account = { id: string; name: string; email: string; role?: string | null; banned?: boolean | null; approved?: boolean | null; createdAt: Date | string };

function NewAccountDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });
  const create = useAction(
    () => unwrap(authClient.admin.createUser({ ...form, role: form.role as "user" | "admin" })),
    {
      success: "アカウントを作成しました。初期パスワードを本人に伝えてください",
      onSuccess: () => {
        setOpen(false);
        setForm({ name: "", email: "", password: "", role: "user" });
      },
    },
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
          アカウントを作成
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>アカウントを作成</DialogTitle>
            <DialogDescription>作成したら、メールアドレスと初期パスワードを本人に伝えてください。本人は個人設定からパスワードを変えられます。</DialogDescription>
          </DialogHeader>
          <Field label="名前" htmlFor="account-name">
            <Input id="account-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="メールアドレス" htmlFor="account-email">
            <Input id="account-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="初期パスワード（8文字以上）" htmlFor="account-password">
            <Input
              id="account-password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Field label="役割" htmlFor="account-role">
            <SimpleSelect id="account-role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={ROLE_OPTIONS} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              作成
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog(props: { account: Account | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const reset = useAction(
    () => unwrap(authClient.admin.setUserPassword({ userId: props.account!.id, newPassword: password })),
    {
      success: "パスワードを再設定しました",
      onSuccess: () => {
        setPassword("");
        props.onClose();
      },
    },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    reset.mutate(undefined);
  };
  return (
    <Dialog open={props.account !== null} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>パスワードを再設定</DialogTitle>
            <DialogDescription>{props.account?.name} さんの新しいパスワードを設定します。</DialogDescription>
          </DialogHeader>
          <Field label="新しいパスワード（8文字以上）" htmlFor="reset-password">
            <Input id="reset-password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={reset.isPending}>
              再設定する
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminAccountsPage() {
  const { data: session } = authClient.useSession();
  const [resetTarget, setResetTarget] = useState<Account | null>(null);
  const { data } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => unwrap(authClient.admin.listUsers({ query: { limit: 500, sortBy: "createdAt", sortDirection: "asc" } })),
  });
  const setRole = useAction((a: { id: string; role: "admin" | "user" }) => unwrap(authClient.admin.setRole({ userId: a.id, role: a.role })), {
    success: "役割を変更しました",
  });
  const setBanned = useAction(
    (a: { id: string; ban: boolean }) => unwrap(a.ban ? authClient.admin.banUser({ userId: a.id }) : authClient.admin.unbanUser({ userId: a.id })),
    { success: "利用状態を変更しました" },
  );
  const approve = useAction((id: string) => api(`/admin/users/${id}/approve`, "POST"), { success: "承認しました。本人がログインできるようになりました" });
  const reject = useAction((id: string) => unwrap(authClient.admin.removeUser({ userId: id })), { success: "登録を却下して削除しました" });
  const accounts = (data?.users ?? []) as Account[];
  const pendingCount = accounts.filter((a) => a.approved === false).length;

  return (
    <>
      <PageHeader title="アカウント管理" description="ログインできる人を管理します。利用停止にするとログインできなくなります。" actions={<NewAccountDialog />} />
      {pendingCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200" role="status">
          承認待ちのアカウントが {pendingCount} 件あります。内容を確認して「承認」か「却下」を選んでください。
        </div>
      )}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名前</TableHead>
              <TableHead>役割</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>作成日</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => {
              const isSelf = a.id === session?.user.id;
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback>{initials(a.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {a.name}
                          {isSelf && <span className="ml-2 text-xs text-muted-foreground">（あなた）</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={a.role === "admin" ? "blue" : "neutral"}>{a.role === "admin" ? "管理者" : "一般ユーザー"}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    {a.approved === false ? (
                      <div className="flex items-center gap-2">
                        <StatusBadge tone="amber">承認待ち</StatusBadge>
                        <Button size="xs" onClick={() => approve.mutate(a.id)}>
                          承認
                        </Button>
                        <ConfirmButton size="sm" title={`${a.name} さんの登録を却下しますか？`} description="アカウントは削除されます。" onConfirm={() => reject.mutate(a.id)}>
                          却下
                        </ConfirmButton>
                      </div>
                    ) : (
                      <StatusBadge tone={a.banned ? "red" : "green"}>{a.banned ? "利用停止" : "利用中"}</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{shortDate(String(a.createdAt))}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`${a.name}の操作`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setResetTarget(a)}>
                          <KeyRound />
                          パスワードを再設定
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={isSelf} onSelect={() => setRole.mutate({ id: a.id, role: a.role === "admin" ? "user" : "admin" })}>
                          {a.role === "admin" ? <ShieldOff /> : <ShieldCheck />}
                          {a.role === "admin" ? "一般ユーザーにする" : "管理者にする"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={isSelf}
                          variant={a.banned ? "default" : "destructive"}
                          onSelect={() => setBanned.mutate({ id: a.id, ban: !a.banned })}
                        >
                          {a.banned ? <UserCheck /> : <UserX />}
                          {a.banned ? "利用を再開する" : "利用停止にする"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <ResetPasswordDialog account={resetTarget} onClose={() => setResetTarget(null)} />
    </>
  );
}
