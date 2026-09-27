import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { auth } from "./auth";
import { CONFLICT_MESSAGE, RuleViolation, VersionConflict, requireUser, type AppEnv } from "./lib/session";
import { membersRoutes } from "./members/routes";
import { customersRoutes } from "./customers/routes";
import { dealsRoutes } from "./deals/routes";
import { quotesRoutes } from "./quotes/routes";
import { dashboardRoutes } from "./dashboard/routes";
import { setupRoutes } from "./setup/routes";
import { approvalRoutes, invitationsRoutes, signupRoutes } from "./invitations/routes";
import { APIError } from "better-auth/api";

const WEB_DIST = "./web/dist";

const api = new Hono<AppEnv>()
  .use(requireUser)
  .route("/members", membersRoutes)
  .route("/customers", customersRoutes)
  .route("/deals", dealsRoutes)
  .route("/quotes", quotesRoutes)
  .route("/dashboard", dashboardRoutes)
  .route("/invitations", invitationsRoutes)
  .route("/admin/users", approvalRoutes);

export const app = new Hono()
  .get("/health", (c) => c.json({ ok: true }))
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .route("/api/setup", setupRoutes)
  .route("/api/signup", signupRoutes)
  .route("/api", api)
  .all("/api/*", (c) => c.json({ error: "見つかりません" }, 404))
  .use("/*", serveStatic({ root: WEB_DIST }))
  // 画面の URL はすべて React 側のルーターに任せる
  .get("*", serveStatic({ path: `${WEB_DIST}/index.html` }))
  .onError((err, c) => {
    if (err instanceof VersionConflict) return c.json({ error: CONFLICT_MESSAGE }, 409);
    if (err instanceof RuleViolation) return c.json({ error: err.message }, 422);
    if (err instanceof APIError) return c.json({ error: err.message }, err.statusCode as 400);
    console.error(err);
    return c.json({ error: "サーバーでエラーが起きました" }, 500);
  });
