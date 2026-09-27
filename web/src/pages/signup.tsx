import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Field } from "@/components/common";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "./auth-pages";

type InvitationInfo = { email: string; invitedByName: string; autoApprove: boolean };

export function SignupPage() {
  const navigate = useNavigate();
  const token = useSearchParams()[0].get("token") ?? "";
  const invitation = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => api<InvitationInfo>(`/signup/invitation?token=${encodeURIComponent(token)}`),
    enabled: token !== "",
  });
  const [form, setForm] = useState({ name: "", password: "", confirm: "" });
  const [pending, setPending] = useState(false);
  const [waiting, setWaiting] = useState(false);

  if (!token || invitation.isError) {
    return (
      <AuthShell title="招待リンクが使えません" description={invitation.error?.message ?? "招待メールのリンクから開いてください"}>
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">ログイン画面へ</Link>
        </Button>
      </AuthShell>
    );
  }
  if (!invitation.data) return <Skeleton className="m-auto mt-40 h-64 w-96" />;

  if (waiting) {
    return (
      <AuthShell title="登録を受け付けました" description="管理者の承認をお待ちください">
        <div className="grid gap-4 text-sm">
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" />
            管理者が承認すると、{invitation.data.email} とパスワードでログインできるようになります。
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">ログイン画面へ</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("パスワードが確認用と一致しません");
      return;
    }
    setPending(true);
    try {
      const { approved } = await api<{ approved: boolean }>("/signup", "POST", { token, name: form.name, password: form.password });
      if (!approved) {
        setWaiting(true);
        return;
      }
      await authClient.signIn.email({ email: invitation.data.email, password: form.password });
      toast.success("登録しました。ようこそ！");
      navigate("/");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell title="アカウントを登録" description={`${invitation.data.invitedByName} さんから招待されています`}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label="メールアドレス" htmlFor="email">
          <Input id="email" value={invitation.data.email} disabled />
        </Field>
        <Field label="名前" htmlFor="name">
          <Input id="name" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="パスワード（8文字以上）" htmlFor="password">
          <Input
            id="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="パスワード（確認）" htmlFor="confirm">
          <Input id="confirm" type="password" required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
        {!invitation.data.autoApprove && <p className="text-xs text-muted-foreground">登録後、管理者の承認が済むとログインできます。</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          登録する
        </Button>
      </form>
    </AuthShell>
  );
}
