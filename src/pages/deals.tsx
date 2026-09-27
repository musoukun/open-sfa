import { Hono } from "hono";
import { prisma } from "../db";
import type { AppEnv } from "../lib/session";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  DEAL_STATUSES,
  DEAL_STATUS_LABELS,
  canAddContract,
  canCreateQuote,
  type ContractType,
  type DealStatus,
} from "../deals/rules";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "../quotes/rules";
import { Badge, Field, FormError, Layout, Options, dateTime, todayJst, yen } from "./ui";

const statusLabel = (s: string) => DEAL_STATUS_LABELS[s as DealStatus];

async function activeMemberOptions() {
  const members = await prisma.member.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
  return members.map((m) => ({ value: m.id, label: m.name }));
}

export const dealPages = new Hono<AppEnv>()
  .get("/", async (c) => {
    const salesRepId = c.req.query("salesRepId") ? Number(c.req.query("salesRepId")) : undefined;
    const status = DEAL_STATUSES.find((s) => s === c.req.query("status"));
    const newFor = c.req.query("newFor") ? Number(c.req.query("newFor")) : undefined;
    const [deals, allMembers, members, customers] = await Promise.all([
      prisma.deal.findMany({
        where: { salesRepId, status },
        include: { customer: true, salesRep: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.member.findMany({ orderBy: { id: "asc" } }),
      activeMemberOptions(),
      prisma.customer.findMany({ where: { archivedAt: null }, orderBy: { companyName: "asc" } }),
    ]);
    return c.html(
      <Layout title="案件" user={c.get("user")}>
        <h1>案件</h1>
        <form class="filters" method="get">
          <Field label="営業担当">
            <select name="salesRepId">
              <Options items={allMembers.map((m) => ({ value: m.id, label: m.name }))} selected={salesRepId} empty="すべて" />
            </select>
          </Field>
          <Field label="状態">
            <select name="status">
              <Options items={DEAL_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))} selected={status} empty="すべて" />
            </select>
          </Field>
          <button>絞り込む</button>
        </form>
        <table>
          <thead>
            <tr>
              <th>案件名</th>
              <th>顧客</th>
              <th>営業担当</th>
              <th>状態</th>
              <th>更新</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr>
                <td>
                  <a href={`/deals/${d.id}`}>{d.name}</a>
                </td>
                <td>
                  {d.customer.companyName} {d.customer.department}
                </td>
                <td>{d.salesRep.name}</td>
                <td>
                  <Badge status={d.status} label={statusLabel(d.status)} />
                </td>
                <td class="muted">{dateTime(d.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>案件を作る</h2>
        <form class="card" data-api="/api/deals" data-redirect="/deals/{id}">
          <div class="grid">
            <Field label="顧客">
              <select name="customerId" data-type="number" required>
                <Options
                  items={customers.map((cu) => ({ value: cu.id, label: `${cu.companyName} ${cu.department}` }))}
                  selected={newFor}
                  empty="選んでください"
                />
              </select>
            </Field>
            <Field label="案件名">
              <input name="name" required />
            </Field>
            <Field label="営業担当">
              <select name="salesRepId" data-type="number" required>
                <Options items={members} empty="選んでください" />
              </select>
            </Field>
          </div>
          <div class="actions">
            <button class="primary">作成</button>
          </div>
          <FormError />
        </form>
      </Layout>,
    );
  })
  .get("/:id{[0-9]+}", async (c) => {
    const deal = await prisma.deal.findUnique({
      where: { id: Number(c.req.param("id")) },
      include: {
        customer: true,
        salesRep: true,
        contract: true,
        quotes: { orderBy: { id: "desc" } },
        notes: { orderBy: [{ meetingDate: "desc" }, { id: "desc" }] },
      },
    });
    if (!deal) return c.notFound();
    const status = deal.status as DealStatus;
    const members = await activeMemberOptions();
    if (!members.some((m) => m.value === deal.salesRepId)) members.push({ value: deal.salesRepId, label: deal.salesRep.name });
    const acceptedQuote = deal.quotes.find((q) => q.status === "accepted");

    return c.html(
      <Layout title={deal.name} user={c.get("user")}>
        <h1>
          {deal.name} <Badge status={deal.status} label={statusLabel(deal.status)} />
        </h1>
        <p>
          顧客: <a href={`/customers/${deal.customerId}`}>{deal.customer.companyName} {deal.customer.department}</a>
        </p>

        <form class="card" data-api={`/api/deals/${deal.id}`} data-method="PATCH">
          <div class="grid">
            <Field label="案件名">
              <input name="name" value={deal.name} required />
            </Field>
            <Field label="営業担当">
              <select name="salesRepId" data-type="number">
                <Options items={members} selected={deal.salesRepId} />
              </select>
            </Field>
          </div>
          <input type="hidden" name="version" value={deal.version} data-type="number" />
          <div class="actions">
            <button class="primary">保存</button>
          </div>
          <FormError />
        </form>

        {status === "open" && (
          <div class="actions">
            {(["won", "lost"] as const).map((to) => (
              <form class="inline" data-api={`/api/deals/${deal.id}/status`} data-confirm={`${statusLabel(to)}にしますか？`}>
                <input type="hidden" name="to" value={to} />
                <input type="hidden" name="version" value={deal.version} data-type="number" />
                <button>{statusLabel(to)}にする</button>
              </form>
            ))}
          </div>
        )}

        <h2>契約概要</h2>
        {deal.contract ? (
          <section class="card">
            <p>
              {CONTRACT_TYPE_LABELS[deal.contract.contractType as ContractType]} / {deal.contract.startDate} 〜 {deal.contract.endDate} /{" "}
              {yen(deal.contract.amount)}
            </p>
          </section>
        ) : canAddContract(status, false) ? (
          <form class="card" data-api={`/api/deals/${deal.id}/contract`}>
            <div class="grid">
              <Field label="契約形態">
                <select name="contractType" required>
                  <Options items={CONTRACT_TYPES.map((t) => ({ value: t, label: CONTRACT_TYPE_LABELS[t] }))} empty="選んでください" />
                </select>
              </Field>
              <Field label="開始日">
                <input name="startDate" type="date" required />
              </Field>
              <Field label="終了日">
                <input name="endDate" type="date" required />
              </Field>
              <Field label="金額（税抜）">
                <input name="amount" type="number" min="0" value={acceptedQuote?.subtotal} required />
              </Field>
            </div>
            {acceptedQuote && <input type="hidden" name="sourceQuoteId" value={acceptedQuote.id} data-type="number" />}
            <div class="actions">
              <button class="primary">契約概要を登録</button>
            </div>
            <FormError />
          </form>
        ) : (
          <p class="muted">受注した案件にだけ登録できます。</p>
        )}

        <h2>見積</h2>
        {canCreateQuote(status) && (
          <p>
            <a href={`/quotes/new?dealId=${deal.id}`}>見積を作る</a>
          </p>
        )}
        <table>
          <thead>
            <tr>
              <th>見積番号</th>
              <th>件名</th>
              <th>状態</th>
              <th class="num">合計（税込）</th>
            </tr>
          </thead>
          <tbody>
            {deal.quotes.map((q) => (
              <tr>
                <td>
                  <a href={`/quotes/${q.id}`}>{q.quoteNumber}</a>
                </td>
                <td>{q.title}</td>
                <td>
                  <Badge status={q.status} label={QUOTE_STATUS_LABELS[q.status as QuoteStatus]} />
                </td>
                <td class="num">{yen(q.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>商談メモ</h2>
        <form class="card" data-api={`/api/deals/${deal.id}/notes`}>
          <div class="grid">
            <Field label="商談日">
              <input name="meetingDate" type="date" value={todayJst()} required />
            </Field>
          </div>
          <Field label="内容">
            <textarea name="content" required></textarea>
          </Field>
          <div class="actions">
            <button class="primary">メモを残す</button>
          </div>
          <FormError />
        </form>
        {deal.notes.map((n) => (
          <section class="card">
            <p class="muted">
              {n.meetingDate} / {n.authorName}
            </p>
            <p style="white-space:pre-wrap">{n.content}</p>
          </section>
        ))}
      </Layout>,
    );
  });
