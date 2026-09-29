import { expect, request, test, type APIRequestContext } from "@playwright/test";

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:3099";

async function login(email: string, password: string) {
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const res = await ctx.post("/api/auth/sign-in/email", { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  return ctx;
}

async function postJson(ctx: APIRequestContext, url: string, data: unknown, method: "POST" | "PUT" = "POST") {
  const res = await ctx.fetch(url, { method, data });
  return { status: res.status(), body: await res.json() };
}

test("業務ルールと権限", async () => {
  const suffix = Date.now().toString().slice(-6);
  const admin = await login(process.env["ADMIN_EMAIL"]!, process.env["ADMIN_PASSWORD"]!);

  // ユーザーが1人でもいれば、初回セットアップから管理者は作れない
  const setup = { name: "乗っ取り", email: `x${suffix}@sfa.test`, password: "password123" };
  expect((await postJson(admin, "/api/setup", setup)).status).toBe(403);

  const member = (await postJson(admin, "/api/members", { name: `担当${suffix}` })).body;
  const customer = (await postJson(admin, "/api/customers", { companyName: `ルール確認${suffix}` })).body;
  const deal = (await postJson(admin, "/api/deals", { customerId: customer.id, name: "案件", salesRepId: member.id })).body;
  const lines = [{ description: "開発", quantity: 1, unitPrice: 1000 }];
  const quote = (await postJson(admin, "/api/quotes", { dealId: deal.id, title: "見積", lines })).body;
  expect(quote.quoteNumber).toMatch(/^Q-\d{6}$/);

  // 同じ版番号で2回保存すると、2回目は他人の更新とみなして弾く
  const edit = { title: "見積 改", lines, version: quote.version };
  expect((await postJson(admin, `/api/quotes/${quote.id}`, edit, "PUT")).status).toBe(200);
  expect((await postJson(admin, `/api/quotes/${quote.id}`, edit, "PUT")).status).toBe(409);

  // 作成中からいきなり承諾はできない
  expect((await postJson(admin, `/api/quotes/${quote.id}/status`, { to: "accepted", version: 2 })).status).toBe(422);

  // 提出後は明細を変えられない
  expect((await postJson(admin, `/api/quotes/${quote.id}/status`, { to: "submitted", version: 2 })).status).toBe(200);
  expect((await postJson(admin, `/api/quotes/${quote.id}`, { ...edit, version: 3 }, "PUT")).status).toBe(422);

  // 受注していない案件には契約概要を登録できない
  const contract = { contractType: "contract_work", startDate: "2026-10-01", endDate: "2026-12-31", amount: 1000 };
  expect((await postJson(admin, `/api/deals/${deal.id}/contract`, contract)).status).toBe(422);

  // 失注（消滅）は理由が必須。理由と、どのフェーズで落ちたかが「動き」に残る
  const lossDeal = (await postJson(admin, "/api/deals", { customerId: customer.id, name: "失注する案件", salesRepId: member.id, source: "seminar" })).body;
  expect((await postJson(admin, `/api/deals/${lossDeal.id}/stage`, { stage: "proposal", version: 1 })).status).toBe(200);
  expect((await postJson(admin, `/api/deals/${lossDeal.id}/status`, { to: "lost", version: 2 })).status).toBe(400);
  expect((await postJson(admin, `/api/deals/${lossDeal.id}/status`, { to: "lost", version: 2, lostReason: "price" })).status).toBe(200);
  const lostDetail = (await (await admin.get(`/api/deals/${lossDeal.id}`)).json()) as { events: { kind: string; fromStage: string | null }[] };
  expect(lostDetail.events.map((e) => e.kind)).toEqual(["lost", "stage", "created"]);
  expect(lostDetail.events[0]!.fromStage).toBe("proposal");
  const insights = (await (await admin.get("/api/insights")).json()) as { lostByStage: { stage: string; count: number }[] };
  expect(insights.lostByStage.find((r) => r.stage === "proposal")!.count).toBeGreaterThan(0);

  // 一般ユーザーはメンバーを登録できない
  const email = `user${suffix}@sfa.test`;
  const password = `pw-${suffix}-${suffix}`;
  const created = await postJson(admin, "/api/auth/admin/create-user", { email, password, name: "一般", role: "user" });
  expect(created.status).toBe(200);
  const user = await login(email, password);
  expect((await postJson(user, "/api/members", { name: "登録不可" })).status).toBe(403);
  expect((await postJson(user, "/api/customers", { companyName: `一般も登録可${suffix}` })).status).toBe(201);
});
