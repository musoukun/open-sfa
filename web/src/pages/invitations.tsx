import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton, EmptyRow, PageHeader, StatusBadge } from "@/components/common";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useAction } from "@/lib/hooks";
import { shortDate } from "@/lib/format";
import { INVITATION_VALID_DAYS } from "@server/config/business";

type Invitation = { id: number; email: string; invitedByName: string; autoApprove: boolean; expiresAt: string; createdAt: string };

export function InvitationsPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";
  const [email, setEmail] = useState("");
  const { data: invitations } = useQuery({ queryKey: ["invitations"], queryFn: () => api<Invitation[]>("/invitations") });
  const invite = useAction(() => api("/invitations", "POST", { email }), {
    success: `${email} に招待メールを送りました`,
    onSuccess: () => setEmail(""),
  });
  const revoke = useAction((id: number) => api(`/invitations/${id}`, "DELETE"), { success: "招待を取り消しました" });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    invite.mutate(undefined);
  };

  return (
    <>
      <PageHeader title="招待" description="一緒に使う人を招待します。招待された人は、メールのリンクから名前とパスワードを登録します。" />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-4" />
              招待メールを送る
            </CardTitle>
            <CardDescription>
              {isAdmin
                ? `あなたが招待した人は、登録するとすぐに使えます。リンクは${INVITATION_VALID_DAYS}日間有効です。`
                : `あなたが招待した人は、登録後に管理者の承認が済むと使えます。リンクは${INVITATION_VALID_DAYS}日間有効です。`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="email"
                required
                placeholder="name@example.com"
                aria-label="招待する人のメールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="sm:max-w-sm"
              />
              <Button type="submit" disabled={invite.isPending}>
                <Send />
                招待を送る
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>まだ登録されていない招待</CardTitle>
            <CardDescription>同じ人にもう一度送ると、前のリンクは使えなくなります</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>招待した人</TableHead>
                  <TableHead>登録後</TableHead>
                  <TableHead>有効期限</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations?.length === 0 && <EmptyRow colSpan={5}>登録待ちの招待はありません</EmptyRow>}
                {invitations?.map((inv) => {
                  const expired = new Date(inv.expiresAt) < new Date();
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell>{inv.invitedByName}</TableCell>
                      <TableCell>
                        <StatusBadge tone={inv.autoApprove ? "green" : "amber"}>{inv.autoApprove ? "すぐ使える" : "承認が必要"}</StatusBadge>
                      </TableCell>
                      <TableCell className={expired ? "text-destructive" : "text-muted-foreground"}>
                        {expired ? "期限切れ" : shortDate(inv.expiresAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ConfirmButton size="sm" title="この招待を取り消しますか？" description="メールのリンクは使えなくなります。" onConfirm={() => revoke.mutate(inv.id)}>
                          取り消す
                        </ConfirmButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
