// ブラウザで動く共通スクリプト。data-api を持つフォームを JSON にして API へ送る
export const CLIENT_JS = `
function readValue(el) {
  if (el.type === "checkbox") return el.checked;
  const v = el.value.trim();
  if (v === "") return undefined;
  if (el.type === "number" || el.dataset.type === "number") return Number(v);
  if (el.dataset.type === "boolean") return v === "true";
  return v;
}

function formToJson(form) {
  const body = {};
  for (const el of form.elements) {
    if (!el.name || el.closest("[data-line]")) continue;
    const v = readValue(el);
    if (v !== undefined) body[el.name] = v;
  }
  const rows = form.querySelectorAll("[data-line]");
  if (form.dataset.lines !== undefined) {
    body.lines = [...rows].map((row) => {
      const line = {};
      for (const el of row.querySelectorAll("[data-field]")) {
        const v = readValue(el);
        if (v !== undefined) line[el.dataset.field] = v;
      }
      return line;
    });
  }
  return body;
}

document.addEventListener("submit", async (e) => {
  const form = e.target;
  if (!form.dataset.api) return;
  e.preventDefault();
  if (form.dataset.confirm && !confirm(form.dataset.confirm)) return;
  const errorBox = form.querySelector(".form-error");
  if (errorBox) errorBox.textContent = "";
  const res = await fetch(form.dataset.api, {
    method: form.dataset.method || "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formToJson(form)),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json.error || json.message || "保存できませんでした (" + res.status + ")";
    if (errorBox) errorBox.textContent = message; else alert(message);
    return;
  }
  const redirect = form.dataset.redirect;
  if (redirect) location.href = redirect.replace("{id}", json.id ?? "");
  else location.reload();
});

document.addEventListener("click", async (e) => {
  const addBtn = e.target.closest("[data-add-line]");
  if (addBtn) {
    const tpl = document.getElementById("line-template");
    addBtn.closest("form").querySelector("tbody").append(tpl.content.cloneNode(true));
  }
  const removeBtn = e.target.closest("[data-remove-line]");
  if (removeBtn) removeBtn.closest("tr").remove();
  if (e.target.closest("[data-logout]")) {
    await fetch("/api/auth/sign-out", { method: "POST" });
    location.href = "/login";
  }
});
`;
