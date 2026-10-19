import { api } from "/js/api/client.js";
import { formatCurrency, showToast, escapeHtml } from "/js/components/ui.js";
import { initSidebar } from "/js/components/sidebar.js";

initSidebar();

const $ = (id) => document.getElementById(id);
let currency = "USD";

function toYMD(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatPeriod(d, groupBy) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return escapeHtml(String(d));
  if (groupBy === "day") return escapeHtml(dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }));
  return escapeHtml(String(d));
}

async function loadCurrency() {
  const res = await api.get("/api/auth/me").catch(() => null);
  const me = res?.data || res || {};
  const user = (me.data && me.data.user) ? me.data.user : (me.user || me.data || me);
  currency = user.currency || currency;
}

function setDefaults() {
  const today = new Date();
  $("date-from").value = toYMD(new Date(today.getFullYear(), today.getMonth(), 1));
  $("date-to").value = toYMD(today);
  $("group-by").value = "day";
}

function validate(from, to) {
  if (!from || !to) { showToast("warning", "Please select both dates."); return false; }
  if (from > to) { showToast("warning", "Date from must be before date to."); return false; }
  if ((new Date(to) - new Date(from)) / 86400000 > 366) { showToast("warning", "Date range cannot exceed 366 days."); return false; }
  return true;
}

async function loadReports() {
  const from = $("date-from").value, to = $("date-to").value, groupBy = $("group-by").value;
  if (!validate(from, to)) return;
  const loading = $("reports-loading"), error = $("reports-error");
  if (loading) loading.classList.remove("d-none");
  if (error) { error.classList.add("d-none"); error.textContent = ""; }
  try {
    const [sumRes, trendRes] = await Promise.all([
      api.get(`/api/reports/summary?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`),
      api.get(`/api/reports/sales-trend?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}&group_by=${encodeURIComponent(groupBy)}`),
    ]);
    renderSummary(sumRes?.data ?? sumRes ?? {});
    renderTrend(trendRes?.data ?? trendRes ?? []);
    await loadReportsExtra(from, to);
  } catch (e) {
    const msg = (e && e.message) || "Failed to load reports";
    if (error) {
      error.classList.remove("d-none");
      error.innerHTML = `<span class="text-muted">${escapeHtml(msg)}</span> `;
      const retry = document.createElement("button");
      retry.type = "button"; retry.className = "btn btn-sm btn-link text-decoration-underline"; retry.textContent = "Retry";
      retry.addEventListener("click", loadReports);
      error.appendChild(retry);
    }
    showToast("danger", msg);
  } finally {
    if (loading) loading.classList.add("d-none");
  }
}

function renderSummary(s) {
  const container = $("report-summary");
  if (!container) return;
  const orders = (typeof s.orders === "object" && s.orders !== null) ? s.orders : {};
  const total = Number(orders.total ?? s.orders ?? s.total_orders ?? 0);
  const pending = Number(orders.pending ?? s.pending_orders ?? s.pending ?? 0);
  const completed = Number(orders.completed ?? s.completed ?? s.completed_orders ?? 0);
  const cancelled = Number(orders.cancelled ?? s.cancelled ?? s.cancelled_orders ?? 0);
  const revenue = Number(s.revenue ?? 0), cogs = Number(s.cost_of_goods ?? s.cost_of_goods_sold ?? s.cogs ?? 0);
  const gross = Number(s.gross_profit ?? s.gross ?? 0), expenses = Number(s.expenses ?? 0);
  const net = Number(s.net_profit ?? s.net ?? 0), cash = Number(s.cash_collected ?? 0);
  const aov = total > 0 ? revenue / total : 0;
  const cards = [
    { l: "Revenue", v: formatCurrency(revenue, currency) },
    { l: "Cost of goods", v: formatCurrency(cogs, currency) },
    { l: "Gross profit", v: formatCurrency(gross, currency) },
    { l: "Expenses", v: formatCurrency(expenses, currency) },
    { l: "Net profit", v: formatCurrency(net, currency), neg: net < 0 },
    { l: "Cash collected", v: formatCurrency(cash, currency) },
    { l: "Orders", v: String(total), cap: `${completed} completed / ${pending} pending / ${cancelled} cancelled` },
    { l: "Average order value", v: formatCurrency(aov, currency) },
  ];
  container.innerHTML = `<div class="row g-3">${cards.map(c => `<div class="col-md-3 col-sm-6"><div class="card border border-secondary p-3"><div class="text-muted small">${escapeHtml(c.l)}</div><div class="${c.neg ? "text-danger" : ""} fw-bold">${escapeHtml(c.v)}</div>${c.cap ? `<div class="text-muted small mt-1">${escapeHtml(c.cap)}</div>` : ""}</div></div>`).join("")}</div>`;
}

function renderTrend(rows) {
  const body = $("trend-body"), chart = $("trend-chart");
  const data = Array.isArray(rows) ? rows : [];
  const revenues = data.map(r => Number(r.revenue ?? r.total ?? 0) || 0);
  const groupBy = $("group-by")?.value || "day";
  if (body) {
    if (!data.length) body.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No completed orders in this period.</td></tr>`;
    else body.innerHTML = data.map(r => {
      const p = r.period ?? r.date ?? r.label ?? "";
      return `<tr><td data-label="Period">${formatPeriod(p, groupBy)}</td><td data-label="Orders">${Number(r.orders ?? r.count ?? r.order_count ?? 0)}</td><td data-label="Revenue">${escapeHtml(formatCurrency(Number(r.revenue ?? r.total ?? 0), currency))}</td><td data-label="Gross profit">${escapeHtml(formatCurrency(Number(r.gross_profit ?? r.profit ?? 0), currency))}</td></tr>`;
    }).join("");
  }
  if (chart) {
    if (!data.length || revenues.every(v => v === 0)) { chart.innerHTML = '<p class="panel-empty">No completed orders in this period.</p>'; return; }
    const max = Math.max(...revenues, 1), n = data.length, slot = 600 / n, barW = Math.max(slot * 0.6, 6);
    let bars = "", labels = "";
    data.forEach((r, i) => {
      const rev = revenues[i], h = (rev / max) * 190, x = i * slot + (slot - barW) / 2, y = 205 - h;
      const p = r.period ?? r.date ?? r.label ?? "", dl = formatPeriod(p, groupBy), vf = escapeHtml(formatCurrency(rev, currency));
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#4f46e5"><title>${dl}: ${vf}</title></rect>`;
      if (n <= 6 || i % Math.ceil(n / 6) === 0 || i === n - 1) labels += `<text x="${x + barW / 2}" y="218" text-anchor="middle" font-size="10">${dl}</text>`;
    });
    chart.innerHTML = `<svg viewBox="0 0 600 220" width="100%" height="220" xmlns="http://www.w3.org/2000/svg">${bars}${labels}</svg>`;
  }
}

async function init() {
  await loadCurrency();
  setDefaults();
  $("apply-btn")?.addEventListener("click", loadReports);
  $("reset-btn")?.addEventListener("click", () => { setDefaults(); loadReports(); });
  loadReports();
}

init();

async function loadReportsExtra(from, to) {
  try {
    const [topRes, expRes] = await Promise.all([
      api.get(`/api/reports/top-products?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}&limit=5`),
      api.get(`/api/reports/expenses-by-category?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`),
    ]);
    renderTopProducts(topRes?.data ?? topRes ?? []);
    renderExpenseCategories(expRes?.data ?? expRes ?? []);
  } catch (e) {
    const msg = (e && e.message) || "Failed to load reports";
    const topC = $("top-products"), expC = $("expense-categories");
    if (topC) topC.innerHTML = `<p class="text-muted mb-0">${escapeHtml(msg)}</p>`;
    if (expC) expC.innerHTML = `<p class="text-muted mb-0">${escapeHtml(msg)}</p>`;
    showToast("danger", msg);
  }
}

function renderTopProducts(rows) {
  const container = $("top-products");
  if (!container) return;
  const data = Array.isArray(rows) ? rows : [];
  if (!data.length) { container.innerHTML = `<p class="text-muted mb-0">No completed orders in this period.</p>`; return; }
  container.innerHTML = `<ol class="list-group list-group-numbered">${data.map(r => {
    const name = escapeHtml(r.product_name ?? r.name ?? r.product ?? "");
    const qty = Number(r.quantity_sold ?? r.quantity ?? r.sold ?? 0);
    const rev = formatCurrency(Number(r.revenue ?? r.total ?? 0), currency);
    return `<li class="list-group-item d-flex justify-content-between align-items-center"><span>${name}</span><span class="text-muted small">${qty} sold</span><span class="fw-bold">${escapeHtml(rev)}</span></li>`;
  }).join("")}</ol>`;
}

function renderExpenseCategories(rows) {
  const container = $("expense-categories");
  if (!container) return;
  const data = Array.isArray(rows) ? rows : [];
  if (!data.length) { container.innerHTML = `<p class="text-muted mb-0">No expenses in this period.</p>`; return; }
  const max = Math.max(...data.map(r => Number(r.amount ?? r.total ?? 0) || 0), 1);
  container.innerHTML = data.map(r => {
    const name = escapeHtml(r.category ?? r.category_name ?? r.name ?? "");
    const amt = formatCurrency(Number(r.amount ?? r.total ?? 0), currency);
    const pct = (Number(r.amount ?? r.total ?? 0) / max) * 100;
    const id = "exp-bar-" + Math.random().toString(36).slice(2);
    return `<div class="mb-2"><div class="d-flex justify-content-between"><span>${name}</span><span>${escapeHtml(amt)}</span></div><div style="height:6px;background:#e9ecef;border-radius:3px"><div id="${id}" style="height:6px;background:#4f46e5;border-radius:3px;width:0%"></div></div></div>`;
  }).join("");
  data.forEach((r, i) => {
    const pct = (Number(r.amount ?? r.total ?? 0) / max) * 100;
    const el = container.querySelectorAll("div[id^='exp-bar-']")[i];
    if (el) el.style.width = pct + "%";
  });
}
