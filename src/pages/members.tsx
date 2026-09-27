import { Hono } from "hono";
import { prisma } from "../db";
import type { AppEnv } from "../lib/session";
import { Field, FormError, Layout, Options } from "./ui";

export const memberPages = new Hono<AppEnv>().get("/", async (c) => {
  const user = c.get("user");
  const isAdmin = user.role === "admin";
  const [members, accounts] = await Promise.all([
    prisma.member.findMany({ orderBy: { id: "asc" } }),
    isAdmin ? prisma.user.findMany({ orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
  ]);

  return c.html(
    <Layout title="メンバー" user={user}>
      <h1>社内メンバー</h1>
      <p class="muted">営業担当や見積の作業担当として選べる人です。ログインしない人も登録できます。</p>
      <table>
        <thead>
          <tr>
            <th>氏名</th>
            <th>メール</th>
            <th>状態</th>
            {isAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr>
              <td>{m.name}</td>
              <td>{m.email}</td>
              <td>{m.isActive ? "有効" : <span class="muted">無効</span>}</td>
              {isAdmin && (
                <td>
                  <form class="inline" data-api={`/api/members/${m.id}`} data-method="PATCH">
                    <input type="hidden" name="isActive" value={String(!m.isActive)} data-type="boolean" />
                    <button class={m.isActive ? "danger" : ""}>{m.isActive ? "無効にする" : "有効にする"}</button>
                  </form>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {isAdmin && (
        <>
          <h2>メンバーを登録</h2>
          <form class="card" data-api="/api/members">
            <div class="grid">
              <Field label="氏名">
                <input name="name" required />
              </Field>
              <Field label="メール">
                <input name="email" type="email" />
              </Field>
            </div>
            <div class="actions">
              <button class="primary">登録</button>
            </div>
            <FormError />
          </form>

          <h1 style="margin-top:40px">ログインアカウント</h1>
          <table>
            <thead>
              <tr>
                <th>名前</th>
                <th>メール</th>
                <th>役割</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr>
                  <td>{a.name}</td>
                  <td>{a.email}</td>
                  <td>{a.role === "admin" ? "管理者" : "一般"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>アカウントを作る</h2>
          <form class="card" data-api="/api/auth/admin/create-user">
            <div class="grid">
              <Field label="名前">
                <input name="name" required />
              </Field>
              <Field label="メール">
                <input name="email" type="email" required />
              </Field>
              <Field label="初期パスワード（8文字以上）">
                <input name="password" type="password" minlength={8} required autocomplete="new-password" />
              </Field>
              <Field label="役割">
                <select name="role">
                  <Options
                    items={[
                      { value: "user", label: "一般" },
                      { value: "admin", label: "管理者" },
                    ]}
                    selected="user"
                  />
                </select>
              </Field>
            </div>
            <div class="actions">
              <button class="primary">作成</button>
            </div>
            <FormError />
          </form>
        </>
      )}
    </Layout>,
  );
});
