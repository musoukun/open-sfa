import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "./auth-pages";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
    setPending(false);
    setSent(true);
  };

  return (
    <AuthShell title="パスワードを忘れた場合" description="登録しているメールアドレスに、パスワードを再設定するリンクを送ります">
      {sent ? (
        <div className="grid gap-4 text-sm">
          <p role="status">
            {email} が登録されていれば、再設定のメールを送りました。メールのリンクは1時間だけ使えます。
          </p>
          <Link to="/login" className="text-center text-muted-foreground underline-offset-4 hover:underline">
            ログイン画面へ戻る
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <Field label="メールアドレス" htmlFor="email">
            <Input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={pending}>
            再設定のメールを送る
          </Button>
          <Link to="/login" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            ログイン画面へ戻る
          </Link>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [pending, setPending] = useState(false);

  if (!token || params.get("error")) {
    return (
      <AuthShell title="リンクが使えません" description="再設定のリンクが無効か、期限が切れています">
        <Button asChild className="w-full">
          <Link to="/forgot-password">もう一度メールを送る</Link>
        </Button>
      </AuthShell>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("新しいパスワードが確認用と一致しません");
      return;
    }
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: form.password, token });
    setPending(false);
    if (error) {
      toast.error("リンクが無効か、期限が切れています。もう一度メールを送ってください");
      return;
    }
    toast.success("パスワードを再設定しました。新しいパスワードでログインしてください");
    navigate("/login");
  };

  return (
    <AuthShell title="新しいパスワード" description="新しいパスワードを決めてください">
      <form onSubmit={submit} className="grid gap-4">
        <Field label="新しいパスワード（8文字以上）" htmlFor="new-password">
          <Input
            id="new-password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="新しいパスワード（確認）" htmlFor="confirm-password">
          <Input
            id="confirm-password"
            type="password"
            required
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          パスワードを再設定する
        </Button>
      </form>
    </AuthShell>
  );
}
