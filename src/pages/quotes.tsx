import { Hono } from "hono";
import { prisma } from "../db";
import type { AppEnv } from "../lib/session";
import { DEFAULT_QUOTE_UNIT, DEFAULT_QUOTE_VALID_DAYS } from "../config/business";
import { canCreateQuote, type DealStatus } from "../deals/rules";
import { QUOTE_STATUS_LABELS, isEditable, nextStatuses, type QuoteStatus } from "../quotes/rules";
import type { QuoteLine } from "../generated/prisma/client";
import { Badge, Field, FormError, Layout, Options, dateTime, todayJst, yen } from "./ui";

type MemberOption = { value: number; label: string };
type LineDraft = Pick<QuoteLine, "description" | "quantity" | "unit" | "unitPrice" | "assigneeId">;

const EMPTY_LINE: LineDraft = { description: "", quantity: 1, unit: DEFAULT_QUOTE_UNIT, unitPrice: 0, assigneeId: null };

const statusLabel = (s: string) => QUOTE_STATUS_LABELS[s as QuoteStatus];

function LineRow(props: { line: LineDraft; members: MemberOption[] }) {
  const l = props.line;
  return (
    <tr data-line>
      <td>
        <input data-field="description" value={l.description} required style="width:100%" />
      </td>
      <td>
        <input data-field="quantity" type="number" step="0.01" min="0" value={l.quantity} style="width:80px" />
      </td>
      <td>
        <input data-field="unit" value={l.unit} style="width:70px" />
      </td>
      <td>
        <input data-field="unitPrice" type="number" min="0" value={l.unitPrice} style="width:120px" />
      </td>
      <td>
        <select data-field="assigneeId" data-type="number">
          <Options items={props.members} selected={l.assigneeId} empty="なし" />
        </select>
      </td>
      <td>
        <button type="button" class="danger" data-remove-line>
          削除
        </button>
      </td>
    </tr>
  );
}

function QuoteEditor(props: {
  api: string;
  method: string;
  redirect?: string;
  title: string;
  validUntil: string | null;
  lines: LineDraft[];
  members: MemberOption[];
  hidden: Record<string, number>;
  submitLabel: string;
}) {
  return (
    <form class="card" data-api={props.api} data-method={props.method} data-redirect={props.redirect} data-lines>
      <div class="grid">
        <Field label="件名">
          <input name="title" value={props.title} required />
        </Field>
        <Field label="有効期限">
          <input name="validUntil" type="date" value={props.validUntil ?? ""} />
        </Field>
      </div>
      <h2>明細</h2>
      <table>
        <thead>
          <tr>
            <th>作業内容</th>
            <th>数量</th>
            <th>単位</th>
            <th>単価（円）</th>
            <th>作業担当</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {props.lines.map((line) => (
            <LineRow line={line} members={props.members} />
          ))}
        </tbody>
      </table>
      <template id="line-template">
        <LineRow line={EMPTY_LINE} members={props.members} />
      </template>
      {Object.entries(props.hidden).map(([name, value]) => (
        <input type="hidden" name={name} value={value} data-type="number" />
      ))}
      <div class="actions">
        <button type="button" data-add-line>
          行を追加
        </button>
        <button class="primary">{props.submitLabel}</button>
      </div>
      <p class="muted">小計・消費税・合計は保存すると計算されます。</p>
      <FormError />
    </form>
  );
}

async function activeMemberOptions(): Promise<MemberOption[]> {
  const members = await prisma.member.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
  return members.map((m) => ({ value: m.id, label: m.name }));
}

export const quotePages = new Hono<AppEnv>()
  .get("/new", async (c) => {
    const deal = await prisma.deal.findUnique({ where: { id: Number(c.req.query("dealId")) }, include: { customer: true } });
    if (!deal) return c.notFound();
    if (!canCreateQuote(deal.status as DealStatus)) return c.redirect(`/deals/${deal.id}`);
    return c.html(
      <Layout title="見積を作る" user={c.get("user")}>
        <h1>見積を作る</h1>
        <p>
          案件: <a href={`/deals/${deal.id}`}>{deal.name}</a>（{deal.customer.companyName}）
        </p>
        <QuoteEditor
          api="/api/quotes"
          method="POST"
          redirect="/quotes/{id}"
          title={deal.name}
          validUntil={todayJst(DEFAULT_QUOTE_VALID_DAYS)}
          lines={[EMPTY_LINE]}
          members={await activeMemberOptions()}
          hidden={{ dealId: deal.id }}
          submitLabel="作成"
        />
      </Layout>,
    );
  })
  .get("/:id{[0-9]+}", async (c) => {
    const quote = await prisma.quote.findUnique({
      where: { id: Number(c.req.param("id")) },
      include: {
        deal: { include: { customer: true } },
        lines: { include: { assignee: true }, orderBy: { lineNo: "asc" } },
        history: { orderBy: { id: "desc" } },
      },
    });
    if (!quote) return c.notFound();
    const status = quote.status as QuoteStatus;
    const members = await activeMemberOptions();
    for (const l of quote.lines) {
      if (l.assignee && !members.some((m) => m.value === l.assigneeId)) members.push({ value: l.assignee.id, label: l.assignee.name });
    }

    return c.html(
      <Layout title={quote.quoteNumber ?? "見積"} user={c.get("user")}>
        <h1>
          {quote.quoteNumber} {quote.title} <Badge status={status} label={statusLabel(status)} />
        </h1>
        <p>
          案件: <a href={`/deals/${quote.dealId}`}>{quote.deal.name}</a>（{quote.deal.customer.companyName}）
        </p>

        <table class="totals">
          <tbody>
            <tr>
              <th>小計</th>
              <td class="num">{yen(quote.subtotal)}</td>
            </tr>
            <tr>
              <th>消費税（{quote.taxRate}%）</th>
              <td class="num">{yen(quote.tax)}</td>
            </tr>
            <tr>
              <th>合計</th>
              <td class="num" data-testid="quote-total">
                {yen(quote.total)}
              </td>
            </tr>
          </tbody>
        </table>

        {isEditable(status) ? (
          <QuoteEditor
            api={`/api/quotes/${quote.id}`}
            method="PUT"
            title={quote.title}
            validUntil={quote.validUntil}
            lines={quote.lines}
            members={members}
            hidden={{ version: quote.version }}
            submitLabel="保存"
          />
        ) : (
          <section class="card">
            <p class="muted">有効期限: {quote.validUntil ?? "なし"}</p>
            <table>
              <thead>
                <tr>
                  <th>作業内容</th>
                  <th class="num">数量</th>
                  <th>単位</th>
                  <th class="num">単価</th>
                  <th class="num">金額</th>
                  <th>作業担当</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((l) => (
                  <tr>
                    <td>{l.description}</td>
                    <td class="num">{l.quantity}</td>
                    <td>{l.unit}</td>
                    <td class="num">{yen(l.unitPrice)}</td>
                    <td class="num">{yen(l.amount)}</td>
                    <td>{l.assignee?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {nextStatuses(status).length > 0 && (
          <div class="actions">
            {nextStatuses(status).map((to) => (
              <form class="inline" data-api={`/api/quotes/${quote.id}/status`} data-confirm={`「${statusLabel(to)}」にしますか？`}>
                <input type="hidden" name="to" value={to} />
                <input type="hidden" name="version" value={quote.version} data-type="number" />
                <button>{to === "submitted" ? "提出する" : `${statusLabel(to)}にする`}</button>
                <FormError />
              </form>
            ))}
          </div>
        )}

        <h2>状態の履歴</h2>
        <table>
          <thead>
            <tr>
              <th>日時</th>
              <th>変更</th>
              <th>変更者</th>
            </tr>
          </thead>
          <tbody>
            {quote.history.map((h) => (
              <tr>
                <td>{dateTime(h.changedAt)}</td>
                <td>
                  {h.fromStatus ? `${statusLabel(h.fromStatus)} → ` : ""}
                  {statusLabel(h.toStatus)}
                </td>
                <td>{h.changedByName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Layout>,
    );
  });
