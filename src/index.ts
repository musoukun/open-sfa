import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env["PORT"] ?? 3000);

// "::" は IPv4 と IPv6 の両方で待つ。Railway の内部ネットワーク（IPv6）から届くようにするため
serve({ fetch: app.fetch, port, hostname: "::" }, (info) => {
  console.log(`sfa-lite listening on http://localhost:${info.port}`);
});
