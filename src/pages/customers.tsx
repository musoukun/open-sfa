import { Hono } from "hono";
import { prisma } from "../db";
import type { AppEnv } from "../lib/session";
import type { Customer } from "../generated/prisma/client";
import { DEAL_STATUS_LABELS, type DealStatus } from "../deals/rules";
import { Badge, Field, FormError, Layout } from "./ui";

function CustomerFields(props: { customer?: Customer }) {
  const c = props.customer;
  return (
    <div class="grid">
      <Field label="会社名（必須）">
        <input name="companyName" value={c?.companyName} required />
      </Field>
      <Field label="部署">
        <input name="department" value={c?.department} />
      </Field>
      <Field label="先方担当者">
        <input name="contactName" value={c?.contactName ?? ""} />
      </Field>
      <Field label="メール">
        <input name="email" type="email" value={c?.email ?? ""} />
      </Field>
      <Field label="電話">
        <input name="phone" value={c?.phone ?? ""} />
      </Field>
      <Field label="メモ">
        <textarea name="memo">{c?.memo ?? ""}</textarea>
      </Field>
    </div>
  );
}

export const customerPages = new Hono<AppEnv>()
  .get("/", async (c) => {
    const showArchived = c.req.query("archived") === "1";
    const customers = await prisma.customer.findMany({
      where: showArchived ? {} : { archivedAt: null },
      include: { _count: { select: { deals: true } } },
      orderBy: { companyName: "asc" },
    });
    return c.html(
      <Layout title="顧客" user={c.get("user")}>
        <h1>顧客</h1>
        <p>
          {showArchived ? <a href="/customers">アーカイブ済みを隠す</a> : <a href="/customers?archived=1">アーカイブ済みも表示</a>}
        </p>
        <table>
          <thead>
            <tr>
              <th>会社名</th>
              <th>部署</th>
              <th>先方担当者</th>
              <th class="num">案件数</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((cu) => (
              <tr>
                <td>
                  <a href={`/customers/${cu.id}`}>{cu.companyName}</a>
                </td>
                <td>{cu.department}</td>
                <td>{cu.contactName}</td>
                <td class="num">{cu._count.deals}</td>
                <td>{cu.archivedAt && <span class="badge">アーカイブ済み</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>顧客を登録</h2>
        <form class="card" data-api="/api/customers" data-redirect="/customers/{id}">
          <CustomerFields />
          <div class="actions">
            <button class="primary">登録</button>
          </div>
          <FormError />
        </form>
      </Layout>,
    );
  })
  .get("/:id{[0-9]+}", async (c) => {
    const customer = await prisma.customer.findUnique({
      where: { id: Number(c.req.param("id")) },
      include: { deals: { include: { salesRep: true }, orderBy: { updatedAt: "desc" } } },
    });
    if (!customer) return c.notFound();
    const archived = customer.archivedAt !== null;
    return c.html(
      <Layout title={customer.companyName} user={c.get("user")}>
        <h1>
          {customer.companyName} {customer.department} {archived && <span class="badge">アーカイブ済み</span>}
        </h1>
        <form class="card" data-api={`/api/customers/${customer.id}`} data-method="PATCH">
          <CustomerFields customer={customer} />
          <input type="hidden" name="version" value={customer.version} data-type="number" />
          <div class="actions">
            <button class="primary">保存</button>
          </div>
          <FormError />
        </form>
        <form
          class="inline"
          data-api={`/api/customers/${customer.id}/${archived ? "unarchive" : "archive"}`}
          data-confirm={archived ? undefined : "この顧客をアーカイブしますか？"}
        >
          <input type="hidden" name="version" value={customer.version} data-type="number" />
          <button class={archived ? "" : "danger"}>{archived ? "アーカイブを解除" : "アーカイブ"}</button>
          <FormError />
        </form>

        <h2>案件</h2>
        {!archived && (
          <p>
            <a href={`/deals?newFor=${customer.id}`}>この顧客の案件を作る</a>
          </p>
        )}
        <table>
          <thead>
            <tr>
              <th>案件名</th>
              <th>営業担当</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {customer.deals.map((d) => (
              <tr>
                <td>
                  <a href={`/deals/${d.id}`}>{d.name}</a>
                </td>
                <td>{d.salesRep.name}</td>
                <td>
                  <Badge status={d.status} label={DEAL_STATUS_LABELS[d.status as DealStatus]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Layout>,
    );
  });
