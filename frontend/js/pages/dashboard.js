import { api } from "/js/api/client.js";
import { formatCurrency, showToast, escapeHtml } from "/js/components/ui.js";
import { initSidebar } from "/js/components/sidebar.js";

initSidebar();

const $ = (id) => document.getElementById(id);

let currency = "USD";
let businessName = "";

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangeDates(key) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  let from;
  if (key === "this_month") {
    from = new Date(y, m, 1);
  } else if (key === "last_30") {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    from = d;
  } else if (key === "last_3m") {
    from = new Date(y, m - 2, 1);
  } else if (key === "this_year") {
    from = new Date(y, 0, 1);
  } else {
    from = new Date(y, m, 1);
  }
  return { from: toYMD(from), to: toYMD(today) };
}

async function loadSummary() {
  const key = $("range-select")?.value || "this_month";
  const { from, to } = rangeDates(key);
  const vals = ["stat-revenue", "stat-gross", "stat-expenses", "stat-net", "stat-orders", "stat-pending"];
  vals.forEach((id) => { const el = $(id); if (el) el.textContent = "..."; });
  try {
    const data = await api.get(`/api/reports/summary?date_from=${from}&date_to=${to}`);
    const d = data?.data || data || {};
    const revenue = d.revenue ?? 0;
    const gross = d.gross_profit ?? d.gross ?? 0;
    const expenses = d.expenses ?? 0;
    const net = d.net_profit ?? d.net ?? 0;
    const ordersObj = (typeof d.orders === "object" && d.orders !== null) ? d.orders : null;
    const orders = ordersObj ? (ordersObj.total ?? 0) : (d.orders ?? d.total_orders ?? 0);
    const pending = ordersObj ? (ordersObj.pending ?? 0) : (d.pending_orders ?? d.pending ?? 0);
    const completed = ordersObj ? (ordersObj.completed ?? 0) : (d.completed ?? d.completed_orders ?? 0);
    const cancelled = ordersObj ? (ordersObj.cancelled ?? 0) : (d.cancelled ?? d.cancelled_orders ?? 0);
    const lowStock = d.low_stock_count ?? 0;
    const cashCollected = d.cash_collected ?? 0;

    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set("stat-revenue", formatCurrency(revenue, currency));
    set("stat-gross", formatCurrency(gross, currency));
    set("stat-expenses", formatCurrency(expenses, currency));
    set("stat-net", formatCurrency(net, currency));
    set("stat-orders", orders);
    set("stat-pending", pending);

    set("cap-revenue", `Cash collected: ${formatCurrency(cashCollected, currency)}`);
    set("cap-gross", "Revenue minus cost of goods");
    set("cap-expenses", "In selected period");
    set("cap-net", "Gross profit minus expenses");
    set("cap-orders", `${completed} completed, ${cancelled} cancelled`);
    set("cap-pending", `${lowStock} low-stock items`);

    const netEl = $("stat-net");
    if (netEl) netEl.classList.toggle("danger", Number(net) < 0);
    const capPending = $("cap-pending");
    if (capPending) capPending.classList.toggle("text-danger", Number(lowStock) > 0);
  } catch (e) {
    vals.forEach((id) => { const el = $(id); if (el) el.textContent = "-"; });
    showToast("danger", (e && e.message) || "Failed to load summary");
  }
}

function setSubtitle() {
  const el = $("dash-subtitle");
  if (!el) return;
  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  el.textContent = `${businessName} - ${dateStr}`;
}

function statusBadge(status) {
  const s = escapeHtml(status);
  if (status === "Completed") return '<span class="badge bg-success">Completed</span>';
  if (status === "Cancelled") return '<span class="badge bg-secondary">Cancelled</span>';
  if (status === "Confirmed" || status === "Processing") return `<span class="badge bg-primary">${s}</span>`;
  return `<span class="badge bg-warning text-dark">${s}</span>`;
}

function renderSalesChart(rows) {
  const el = $("sales-chart");
  if (!el) return;
  const data = Array.isArray(rows) ? rows : [];
  const revenues = data.map((r) => Number(r.revenue ?? r.total ?? 0) || 0);
  if (data.length === 0 || revenues.every((v) => v === 0)) {
    el.innerHTML = '<p class="panel-empty">No completed orders in this period.</p>';
    return;
  }
  const max = Math.max(...revenues, 1);
  const n = data.length;
  const slot = 600 / n;
  const barW = Math.max(slot * 0.6, 6);
  let bars = "";
  let labels = "";
  data.forEach((r, i) => {
    const rev = revenues[i];
    const h = (rev / max) * 190;
    const x = i * slot + (slot - barW) / 2;
    const y = 205 - h;
    const d = r.period ?? r.date ?? r.label ?? "";
    const dateLabel = (() => {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return escapeHtml(String(d));
      return escapeHtml(dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }));
    })();
    const revFmt = escapeHtml(formatCurrency(rev, currency));
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#4f46e5"><title>${dateLabel}: ${revFmt}</title></rect>`;
    const showLabel = n <= 6 || i % Math.ceil(n / 6) === 0 || i === n - 1;
    if (showLabel) {
      labels += `<text x="${x + barW / 2}" y="218" text-anchor="middle" font-size="10">${dateLabel}</text>`;
    }
  });
  el.innerHTML = `<svg viewBox="0 0 600 220" width="100%" height="220" xmlns="http://www.w3.org/2000/svg">${bars}${labels}</svg>`;
}

function renderLowStock(rows) {
  const el = $("low-stock-list");
  if (!el) return;
  const data = Array.isArray(rows) ? rows : [];
  if (data.length === 0) {
    el.innerHTML = '<p class="panel-empty">All products are well stocked.</p>';
    return;
  }
  const items = data.map((r) => {
    const name = escapeHtml(r.name ?? r.product_name ?? "");
    const stock = Number(r.stock_quantity ?? r.stock ?? r.quantity ?? 0);
    const cls = stock === 0 ? "text-danger" : "";
    return `<li class="low-stock-item"><span>${name}</span><span class="${cls}">${stock} left</span></li>`;
  }).join("");
  el.innerHTML = `<ul class="low-stock-list">${items}</ul>`;
}

function renderRecentOrders(rows) {
  const el = $("recent-orders");
  if (!el) return;
  const data = Array.isArray(rows) ? rows : [];
  if (data.length === 0) {
    el.innerHTML = '<p class="panel-empty">No orders yet.</p>';
    return;
  }
  const rowsHtml = data.map((r) => {
    const order = escapeHtml(r.order_number ?? r.id ?? "");
    const customer = escapeHtml(r.customer_name || "Walk-in");
    const status = statusBadge(r.status);
    const total = escapeHtml(formatCurrency(r.total ?? r.amount ?? 0, currency));
    const d = new Date(r.order_date ?? r.date ?? r.created_at);
    const dateStr = isNaN(d.getTime()) ? escapeHtml(String(r.order_date ?? r.date ?? "")) : escapeHtml(d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }));
    return `<tr>
      <td data-label="Order">${order}</td>
      <td data-label="Customer">${customer}</td>
      <td data-label="Status">${status}</td>
      <td data-label="Total">${total}</td>
      <td data-label="Date">${dateStr}</td>
    </tr>`;
  }).join("");
  el.innerHTML = `<div class="table-responsive"><table class="orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

async function loadCharts() {
  const key = $("range-select")?.value || "this_month";
  const { from, to } = rangeDates(key);
  try {
    const [salesRes, lowRes, recentRes] = await Promise.all([
      api.get(`/api/reports/sales-trend?date_from=${from}&date_to=${to}`),
      api.get(`/api/reports/low-stock?limit=6`),
      api.get(`/api/reports/recent-orders?limit=5`),
    ]);
    renderSalesChart(salesRes?.data ?? salesRes ?? []);
    renderLowStock(lowRes?.data ?? lowRes ?? []);
    renderRecentOrders(recentRes?.data ?? recentRes ?? []);
  } catch (e) {
    showToast("danger", (e && e.message) || "Failed to load charts");
    const msg = '<p class="text-muted">Failed to load.</p>';
    ["sales-chart", "low-stock-list", "recent-orders"].forEach((id) => { const el = $(id); if (el) el.innerHTML = msg; });
  }
}

async function init() {
  const meRes = await api.get("/api/auth/me").catch(() => null);
  const me = meRes?.data || meRes || {};
  const user = (me.data && me.data.user) ? me.data.user : (me.user || me.data || me);
  businessName = user.business_name || user.businessName || me.business_name || me.businessName || "";
  currency = user.currency || currency;

  setSubtitle();
  await loadSummary();
  loadCharts();

  const rs = $("range-select");
  if (rs) rs.addEventListener("change", () => { loadSummary(); loadCharts(); });
}

init();
