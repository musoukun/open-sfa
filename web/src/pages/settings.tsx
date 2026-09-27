import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSearchParams } from "react-router";
import { ConfirmButton, Field, PageHeader, StatusBadge } from "@/components/common";
import { authClient } from "@/lib/auth-client";
import { unwrap, useAction, useGoogleMeetStatus } from "@/lib/hooks";

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

// サーバーの src/google-meet/rules.ts と同じ値
const MEET_SCOPE = "https://www.googleapis.com/auth/meetings.space.readonly";

function GoogleCard() {
  const { data: status } = useGoogleMeetStatus();
  // 連携に失敗すると、Better Auth が ?error=理由 を付けてこの画面に戻してくる
  const linkError = useSearchParams()[0].get("error");
  const link = useAction(() =>
    unwrap(authClient.linkSocial({ provider: "google", scopes: [MEET_SCOPE], callbackURL: "/settings", errorCallbackURL: "/settings" })),
  );
  const unlink = useAction(() => unwrap(authClient.unlinkAccount({ accountId: status?.accountId ?? "" })), { success: "Google との連携を解除しました" });
  if (!status?.enabled) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google との連携</CardTitle>
        <CardDescription>連携すると、Google Meet の会議の URL を貼るだけで、文字起こしを商談の記録に取り込めます</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">状態</span>
          {status.canReadMeet ? (
            <StatusBadge tone="green">連携済み</StatusBadge>
          ) : status.accountId ? (
            <StatusBadge tone="amber">Meet を読む許可が足りません</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">未連携</StatusBadge>
          )}
        </div>
        {linkError && <p className="text-destructive">Google との連携に失敗しました（{linkError}）。もう一度お試しください。</p>}
        <p className="text-xs text-muted-foreground">
          取り込めるのは、自分が主催か参加した会議で、会議中に「文字起こし」を開始したものだけです。文字起こしは会議から30日を過ぎると取り込めなくなります。
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {status.accountId && (
          <ConfirmButton title="Google との連携を解除しますか？" description="解除すると、Google Meet の文字起こしを取り込めなくなります。" confirmLabel="解除する" onConfirm={() => unlink.mutate(undefined)}>
            連携を解除
          </ConfirmButton>
        )}
        {!status.canReadMeet && (
          <Button onClick={() => link.mutate(undefined)} disabled={link.isPending}>
            Google と連携する
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export function SettingsPage() {
  return (
    <>
      <PageHeader title="個人設定" description="自分のアカウントの設定です" />
      <div className="grid max-w-2xl gap-6">
        <ProfileCard />
        <GoogleCard />
        <PasswordCard />
      </div>
    </>
  );
}
