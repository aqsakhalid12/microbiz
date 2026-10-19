// frontend/js/orders/orders-list.js
import { api } from "/js/api/client.js";
import {
  renderEmptyState,
  renderSkeleton,
  escapeHtml,
  formatCurrency,
  showToast,
} from "/js/components/ui.js";

const state = {
  orders: [],
  pagination: null,
  currentPage: 1,
  filters: { search: "", status: "", payment: "", dateFrom: "", dateTo: "", sort: "order_date:desc" },
  currencyCode: "USD",
  onView: null,
  onEdit: null,
};

const elements = {};

function cacheElements() {
  elements.ordersContent = document.getElementById("orders-content");
  elements.paginationControls = document.getElementById("pagination-controls");
  elements.searchInput = document.getElementById("search-input");
  elements.statusSelect = document.getElementById("status-select");
  elements.paymentSelect = document.getElementById("payment-status-select");
  elements.dateFrom = document.getElementById("date-from");
  elements.dateTo = document.getElementById("date-to");
  elements.sortSelect = document.getElementById("sort-select");
  elements.resetBtn = document.getElementById("reset-filters-btn");
}

function safe(id) { return document.getElementById(id); }

function statusBadge(status) {
  const s = escapeHtml(status);
  if (status === "Completed") return '<span class="badge bg-success">Completed</span>';
  if (status === "Cancelled") return '<span class="badge bg-secondary">Cancelled</span>';
  if (status === "Confirmed" || status === "Processing") return `<span class="badge bg-primary">${s}</span>`;
  return `<span class="badge bg-warning text-dark">${s}</span>`;
}

function paymentBadge(ps) {
  if (ps === "Paid") return '<span class="badge bg-success">Paid</span>';
  if (ps === "Partially Paid") return '<span class="badge bg-info text-dark">Partially Paid</span>';
  return '<span class="badge bg-secondary">Unpaid</span>';
}

function showLoading() {
  if (!elements.ordersContent) return;
  elements.ordersContent.innerHTML = "";
  renderSkeleton(elements.ordersContent, 5);
}

function showError(message) {
  if (!elements.ordersContent) return;
  elements.ordersContent.innerHTML = "";
  renderEmptyState(elements.ordersContent, { icon: "bi-exclamation-triangle", title: "Something went wrong", text: message, actionLabel: "Retry", onAction: () => loadOrders(1) });
}

function showEmpty() {
  if (!elements.ordersContent) return;
  elements.ordersContent.innerHTML = "";
  renderEmptyState(elements.ordersContent, { icon: "bi-cart", title: "No orders found", text: "No orders match your filters." });
}

function renderOrders() {
  if (!elements.ordersContent) return;
  if (!state.orders.length) { showEmpty(); return; }
  let html = '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead class="table-light"><tr><th scope="col">Order #</th><th scope="col">Customer</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col">Payment</th><th scope="col">Items</th><th scope="col">Total</th><th scope="col" class="text-end">Actions</th></tr></thead><tbody>';
  state.orders.forEach((o) => {
    const orderNumber = escapeHtml(o.order_number);
    const customer = escapeHtml(o.customer_name || "Walk-in");
    const date = escapeHtml(o.order_date || "");
    const total = formatCurrency(o.total, state.currencyCode);
    html += `<tr data-order-id="${o.id}" data-label="">
      <td data-label="Order #">${orderNumber}</td>
      <td data-label="Customer">${customer}</td>
      <td data-label="Date">${date}</td>
      <td data-label="Status">${statusBadge(o.status)}</td>
      <td data-label="Payment">${paymentBadge(o.payment_status)}</td>
      <td data-label="Items">${o.item_count}</td>
      <td data-label="Total">${total}</td>
      <td class="text-end" data-label="Actions"><button type="button" class="btn btn-sm btn-outline-secondary view-btn" title="View"><i class="bi bi-eye"></i></button>${o.status === "Pending" ? ' <button type="button" class="btn btn-sm btn-outline-primary edit-btn" title="Edit"><i class="bi bi-pencil"></i></button>' : ""}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  elements.ordersContent.innerHTML = html;
}

function renderPagination() {
  if (!elements.paginationControls || !state.pagination) return;
  const { page, totalPages } = state.pagination;
  if (totalPages <= 1) { elements.paginationControls.innerHTML = ""; return; }
  let html = '<nav aria-label="Orders pagination"><ul class="pagination justify-content-center mb-0"><li class="page-item ' + (page <= 1 ? "disabled" : "") + '"><button class="page-link" type="button" data-action="prev">Previous</button></li>';
  for (let i = 1; i <= totalPages && i <= 5; i++) {
    html += '<li class="page-item ' + (i === page ? "active" : "") + '"><button class="page-link" type="button" data-page="' + i + '">' + i + '</button></li>';
  }
  html += '<li class="page-item ' + (page >= totalPages ? "disabled" : "") + '"><button class="page-link" type="button" data-action="next">Next</button></li></ul></nav>';
  elements.paginationControls.innerHTML = html;
}

export async function reloadOrders() {
  await loadOrders(state.currentPage);
}

async function loadOrders(page = 1) {
  showLoading();
  try {
    state.currentPage = page;
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", "10");
    if (state.filters.search) params.set("search", state.filters.search);
    if (state.filters.status) params.set("status", state.filters.status);
    if (state.filters.payment) params.set("payment_status", state.filters.payment);
    if (state.filters.dateFrom) params.set("date_from", state.filters.dateFrom);
    if (state.filters.dateTo) params.set("date_to", state.filters.dateTo);
    params.set("sort", state.filters.sort);
    const data = await api.get(`/api/orders?${params.toString()}`);
    state.orders = data.data || [];
    state.pagination = data.pagination || null;
    if (!state.currencyCode || state.currencyCode === "USD") {
      try {
        const me = await api.get("/api/auth/me");
        const c = me?.user?.currency_code || me?.currency_code;
        if (c) state.currencyCode = c;
      } catch (e) { /* keep */ }
    }
    if (state.orders.length === 0) showEmpty(); else renderOrders();
    renderPagination();
  } catch (err) {
    showError(err.message || "Failed to load orders");
  }
}

function wireEvents() {
  let searchTimer = null;
  if (elements.searchInput) {
    elements.searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.filters.search = elements.searchInput.value; loadOrders(1); }, 300);
    });
  }
  if (elements.statusSelect) {
    elements.statusSelect.addEventListener("change", () => { state.filters.status = elements.statusSelect.value; loadOrders(1); });
  }
  if (elements.paymentSelect) {
    elements.paymentSelect.addEventListener("change", () => { state.filters.payment = elements.paymentSelect.value; loadOrders(1); });
  }
  if (elements.dateFrom) {
    elements.dateFrom.addEventListener("change", () => { state.filters.dateFrom = elements.dateFrom.value; loadOrders(1); });
  }
  if (elements.dateTo) {
    elements.dateTo.addEventListener("change", () => { state.filters.dateTo = elements.dateTo.value; loadOrders(1); });
  }
  if (elements.sortSelect) {
    elements.sortSelect.addEventListener("change", () => { state.filters.sort = elements.sortSelect.value; loadOrders(1); });
  }
  if (elements.resetBtn) {
    elements.resetBtn.addEventListener("click", () => {
      if (elements.searchInput) elements.searchInput.value = "";
      if (elements.statusSelect) elements.statusSelect.value = "";
      if (elements.paymentSelect) elements.paymentSelect.value = "";
      if (elements.dateFrom) elements.dateFrom.value = "";
      if (elements.dateTo) elements.dateTo.value = "";
      if (elements.sortSelect) elements.sortSelect.value = "order_date:desc";
      state.filters = { search: "", status: "", payment: "", dateFrom: "", dateTo: "", sort: "order_date:desc" };
      loadOrders(1);
    });
  }
  if (elements.paginationControls) {
    elements.paginationControls.addEventListener("click", (e) => {
      const target = e.target.closest("button");
      if (!target || target.disabled) return;
      if (target.dataset.action === "prev") loadOrders(state.currentPage - 1);
      else if (target.dataset.action === "next") loadOrders(state.currentPage + 1);
      else if (target.dataset.page) loadOrders(parseInt(target.dataset.page, 10));
    });
  }
  if (elements.ordersContent) {
    elements.ordersContent.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-order-id]");
      if (!row) return;
      const orderId = row.dataset.orderId;
      const order = state.orders.find((o) => o.id == orderId);
      if (e.target.closest(".view-btn")) { if (state.onView) state.onView(order); }
      if (e.target.closest(".edit-btn")) { if (state.onEdit) state.onEdit(order); }
    });
  }
}

export function initOrdersList({ onView, onEdit } = {}) {
  state.onView = onView || null;
  state.onEdit = onEdit || null;
  cacheElements();
  wireEvents();
  loadOrders(1);
}
void safe;
