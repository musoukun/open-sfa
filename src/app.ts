import { Hono } from "hono";
import { auth } from "./auth";
import { CONFLICT_MESSAGE, RuleViolation, VersionConflict, requireUser, type AppEnv } from "./lib/session";
import { membersRoutes } from "./members/routes";
import { customersRoutes } from "./customers/routes";
import { dealsRoutes } from "./deals/routes";
import { quotesRoutes } from "./quotes/routes";
import { pages } from "./pages";

const api = new Hono<AppEnv>()
  .use(requireUser)
  .route("/members", membersRoutes)
  .route("/customers", customersRoutes)
  .route("/deals", dealsRoutes)
  .route("/quotes", quotesRoutes);

export const app = new Hono()
  .get("/health", (c) => c.json({ ok: true }))
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .route("/api", api)
  .route("/", pages)
  .onError((err, c) => {
    if (err instanceof VersionConflict) return c.json({ error: CONFLICT_MESSAGE }, 409);
    if (err instanceof RuleViolation) return c.json({ error: err.message }, 422);
    console.error(err);
    return c.json({ error: "サーバーでエラーが起きました" }, 500);
  });
