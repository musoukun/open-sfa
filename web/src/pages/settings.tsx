import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, PageHeader, StatusBadge } from "@/components/common";
import { authClient } from "@/lib/auth-client";
import { unwrap, useAction } from "@/lib/hooks";

function ProfileCard() {
  const { data: session, refetch } = authClient.useSession();
  const [name, setName] = useState(session?.user.name ?? "");
  const save = useAction(() => unwrap(authClient.updateUser({ name })), {
    success: "表示名を変更しました",
    onSuccess: () => refetch(),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined);
  };
  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-(--card-spacing)">
        <CardHeader>
          <CardTitle>プロフィール</CardTitle>
          <CardDescription>商談メモや見積の履歴には、この名前が記録されます</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="表示名" htmlFor="profile-name">
            <Input id="profile-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="メールアドレス" htmlFor="profile-email">
            <Input id="profile-email" value={session?.user.email ?? ""} disabled />
          </Field>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">役割</span>
            <StatusBadge tone={session?.user.role === "admin" ? "blue" : "neutral"}>
              {session?.user.role === "admin" ? "管理者" : "一般ユーザー"}
            </StatusBadge>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={save.isPending}>
            保存
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const empty = { currentPassword: "", newPassword: "", confirm: "" };
  const [form, setForm] = useState(empty);
  const change = useAction(
    () => unwrap(authClient.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword, revokeOtherSessions: true })),
    { success: "パスワードを変更しました。ほかの端末ではログアウトされます", onSuccess: () => setForm(empty) },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      toast.error("新しいパスワードが確認用と一致しません");
      return;
    }
    change.mutate(undefined);
  };
  const input = (key: keyof typeof empty, label: string, autoComplete: string) => (
    <Field label={label} htmlFor={`pw-${key}`}>
      <Input
        id={`pw-${key}`}
        type="password"
        required
        minLength={key === "currentPassword" ? undefined : 8}
        autoComplete={autoComplete}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </Field>
  );
  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-(--card-spacing)">
        <CardHeader>
          <CardTitle>パスワードの変更</CardTitle>
          <CardDescription>管理者から受け取った初期パスワードは、ここで自分だけのものに変えてください</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {input("currentPassword", "今のパスワード", "current-password")}
          {input("newPassword", "新しいパスワード（8文字以上）", "new-password")}
          {input("confirm", "新しいパスワード（確認）", "new-password")}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={change.isPending}>
            パスワードを変更
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function SettingsPage() {
  return (
    <>
      <PageHeader title="個人設定" description="自分のアカウントの設定です" />
      <div className="grid max-w-2xl gap-6">
        <ProfileCard />
        <PasswordCard />
      </div>
    </>
  );
}
