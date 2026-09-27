import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

function useSetupStatus() {
  return useQuery({ queryKey: ["setup"], queryFn: () => api<{ needsSetup: boolean }>("/setup") });
}

export function AuthShell(props: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2 font-semibold">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Briefcase className="size-4" />
          </div>
          open-sfa
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{props.title}</CardTitle>
            <CardDescription>{props.description}</CardDescription>
          </CardHeader>
          <CardContent>{props.children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

function loginErrorMessage(error: { status: number; message?: string }) {
  if (error.message?.includes("承認待ち")) return error.message;
  if (error.status === 403) return "このアカウントは利用停止中です。管理者に連絡してください";
  return "メールアドレスかパスワードが違います";
}

export function LoginPage() {
  const navigate = useNavigate();
  const setup = useSetupStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (setup.data?.needsSetup) return <Navigate to="/setup" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    const { error } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) {
      setError(loginErrorMessage(error));
      return;
    }
    navigate("/");
  };

  return (
    <AuthShell title="ログイン" description="管理者から受け取ったメールアドレスとパスワードを入力してください">
      <form onSubmit={submit} className="grid gap-4">
        <Field label="メールアドレス" htmlFor="email">
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="パスワード" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          ログイン
        </Button>
        <Link to="/forgot-password" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
          パスワードを忘れた場合
        </Link>
        <p className="text-center text-xs text-muted-foreground">アカウントは招待制です。社内の人に招待メールを送ってもらってください</p>
      </form>
    </AuthShell>
  );
}

export function SetupPage() {
  const navigate = useNavigate();
  const setup = useSetupStatus();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [pending, setPending] = useState(false);

  if (setup.data && !setup.data.needsSetup) return <Navigate to="/login" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await api("/setup", "POST", form);
      await authClient.signIn.email({ email: form.email, password: form.password });
      toast.success("管理者アカウントを作成しました");
      navigate("/");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell title="初回セットアップ" description="最初の管理者アカウントを作成します。ほかの人のアカウントは、あとでアカウント管理画面から作れます。">
      <form onSubmit={submit} className="grid gap-4">
        <Field label="名前" htmlFor="name">
          <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="メールアドレス" htmlFor="email">
          <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
        <Button type="submit" className="w-full" disabled={pending}>
          管理者を作成して始める
        </Button>
      </form>
    </AuthShell>
  );
}
