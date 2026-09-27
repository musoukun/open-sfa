import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { auth } from "../auth";
import type { AppEnv } from "../lib/session";
import { Field, FormError, Layout } from "./ui";
import { customerPages } from "./customers";
import { dealPages } from "./deals";
import { quotePages } from "./quotes";
import { memberPages } from "./members";

const requireLogin = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.redirect("/login");
  c.set("user", session.user);
  await next();
});

export const pages = new Hono<AppEnv>()
  .get("/login", (c) =>
    c.html(
      <Layout title="ログイン">
        <h1>sfa-lite にログイン</h1>
        <form class="card" style="max-width:360px" data-api="/api/auth/sign-in/email" data-redirect="/deals">
          <Field label="メールアドレス">
            <input name="email" type="email" required autocomplete="username" />
          </Field>
          <Field label="パスワード">
            <input name="password" type="password" required autocomplete="current-password" />
          </Field>
          <div class="actions">
            <button class="primary">ログイン</button>
          </div>
          <FormError />
        </form>
      </Layout>,
    ),
  )
  .use(requireLogin)
  .get("/", (c) => c.redirect("/deals"))
  .route("/customers", customerPages)
  .route("/deals", dealPages)
  .route("/quotes", quotePages)
  .route("/members", memberPages);
