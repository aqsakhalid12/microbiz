// frontend/js/orders/orders-view.js
// View order modal: order details, status transitions, payment recording.
import { api } from "/js/api/client.js";
import { escapeHtml, formatCurrency, showToast, setButtonLoading } from "/js/components/ui.js";

const MODAL_ID = "view-order-modal";
const CONFIRM_ID = "confirm-action-modal";

const state = {
  currencyCode: "USD",
  orderId: null,
  order: null,
  pendingAction: null,
  loading: false,
  onChanged: null,
};

const ACTIONS = {
  confirm: { status: "Confirmed", label: "Confirm order" },
  processing: { status: "Processing", label: "Mark as processing" },
  complete: { status: "Completed", label: "Mark as completed" },
  cancel: { status: "Cancelled", label: "Cancel order" },
};
const ALLOWED_BY_STATUS = {
  Pending: ["confirm", "cancel"],
  Confirmed: ["processing", "complete", "cancel"],
  Processing: ["complete", "cancel"],
  Completed: [],
  Cancelled: [],
};
const CONFIRM_REQUIRED = new Set(["complete", "cancel"]);

const elements = {};

function cacheElements() {
  elements.modalEl = document.getElementById(MODAL_ID);
  elements.orderNumber = document.getElementById("view-order-number");
  elements.orderDate = document.getElementById("view-order-date");
  elements.orderStatus = document.getElementById("view-order-status");
  elements.paymentStatus = document.getElementById("view-payment-status");
  elements.customer = document.getElementById("view-customer");
  elements.notes = document.getElementById("view-notes");
  elements.itemsContainer = document.getElementById("view-items-container");
  elements.subtotal = document.getElementById("view-subtotal");
  elements.discount = document.getElementById("view-discount");
  elements.total = document.getElementById("view-total");
  elements.amountPaid = document.getElementById("view-amount-paid");
  elements.balanceDue = document.getElementById("view-balance-due");
  elements.statusActions = document.getElementById("status-actions-container");
  elements.paymentContainer = document.getElementById("payment-container");
  elements.confirmModalEl = document.getElementById(CONFIRM_ID);
  elements.confirmText = document.getElementById("confirm-action-text");
  elements.confirmBtn = document.getElementById("confirm-action-btn");
}

function moneyCents(value) { return Math.round(Number(value || 0) * 100); }
function moneyText(cents) { return formatCurrency(cents / 100, state.currencyCode); }

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

function renderHeader(order) {
  elements.orderNumber.textContent = escapeHtml(order.order_number);
  elements.orderDate.textContent = order.order_date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(order.order_date)) : "—";
  elements.orderStatus.innerHTML = statusBadge(order.status);
  elements.paymentStatus.innerHTML = paymentBadge(order.payment_status);
  elements.customer.textContent = order.customer ? escapeHtml(order.customer.name) : "Walk-in";
  elements.notes.textContent = order.notes ? escapeHtml(order.notes) : "—";
}

function renderItems(order) {
  const items = order.items || [];
  if (!items.length) { elements.itemsContainer.innerHTML = '<div class="text-muted">No items.</div>'; return; }
  let html = '<table class="table table-sm align-middle" id="view-items-table"><thead><tr><th>Product</th><th>SKU</th><th class="text-end">Qty</th><th class="text-end">Unit price</th><th class="text-end">Line total</th></tr></thead><tbody>';
  items.forEach((it) => {
    html += `<tr>
      <td class="product-cell" data-label="Product">${escapeHtml(it.product_name)}</td>
      <td data-label="SKU">${escapeHtml(it.sku)}</td>
      <td class="text-end" data-label="Qty">${escapeHtml(it.quantity)}</td>
      <td class="text-end" data-label="Unit price">${moneyText(moneyCents(it.unit_price))}</td>
      <td class="text-end" data-label="Line total">${moneyText(moneyCents(it.line_total))}</td>
    </tr>`;
  });
  elements.itemsContainer.innerHTML = html + "</tbody></table>";
}

function renderTotals(order) {
  const subtotalCents = moneyCents(order.subtotal);
  const discountCents = moneyCents(order.discount);
  const totalCents = moneyCents(order.total);
  const amountPaidCents = moneyCents(order.amount_paid);
  const balanceCents = totalCents - amountPaidCents;
  elements.subtotal.textContent = moneyText(subtotalCents);
  elements.discount.textContent = moneyText(discountCents);
  elements.total.textContent = moneyText(totalCents);
  elements.amountPaid.textContent = moneyText(amountPaidCents);
  elements.balanceDue.textContent = moneyText(balanceCents);
  return { totalCents, amountPaidCents, balanceCents };
}

function renderStatusButtons(order) {
  const allowed = ALLOWED_BY_STATUS[order.status] || [];
  const html = allowed.map((action) => {
    const { status, label } = ACTIONS[action];
    const btnClass = action === "cancel" ? "btn-outline-danger" : "btn-outline-primary";
    return `<button type="button" class="btn btn-sm ${btnClass} w-auto me-2 mb-2 view-action" data-action="${action}">${escapeHtml(label)}</button>`;
  }).join("");
  elements.statusActions.innerHTML = html || '<span class="text-muted">No status actions available for this order.</span>';
}

function renderPayment(order, totals) {
  const { totalCents, balanceCents } = totals;
  if (order.status === "Cancelled") { elements.paymentContainer.innerHTML = ""; return; }
  elements.paymentContainer.innerHTML = `
    <div class="row g-3 align-items-end">
      <div class="col-md-5">
        <label class="form-label">Total amount paid so far</label>
        <input type="number" class="form-control" id="view-payment-amount" step="0.01" min="0" max="${Number(order.total).toFixed(2)}" value="${Number(order.amount_paid || 0).toFixed(2)}" />
        <div class="invalid-feedback" id="view-payment-feedback"></div>
        <div class="form-text">Enter the new total amount paid (not an increment). Max is the order total.</div>
      </div>
      <div class="col-md-3">
        <button type="button" class="btn btn-outline-primary w-100" id="view-btn-pay-full">Pay full balance (${moneyText(balanceCents) || moneyText(0)})</button>
      </div>
      <div class="col-md-3 d-grid">
        <button type="button" class="btn btn-primary w-100" id="view-btn-save-payment">Record payment</button>
      </div>
      <div class="col-md-1">
        <div class="form-text d-block text-muted small">Balance due</div>
        <div class="form-text fw-bold">${moneyText(balanceCents)}</div>
      </div>
    </div>`;
}

function render(order) {
  state.order = order;
  renderHeader(order);
  renderItems(order);
  const totals = renderTotals(order);
  renderStatusButtons(order);
  renderPayment(order, totals);
}

async function loadCurrency() {
  try {
    const me = await api.get("/api/auth/me");
    const c = me?.user?.currency_code || me?.currency_code;
    if (c) state.currencyCode = c;
  } catch { /* keep USD */ }
}

async function executeStatusChange(action) {
  const { status } = ACTIONS[action];
  const btn = elements.statusActions.querySelector(`[data-action="${action}"]`);
  state.loading = true;
  setButtonLoading(btn, true);
  try {
    await api.patch(`/api/orders/${state.orderId}/status`, { status });
    showToast("success", `Order marked as ${escapeHtml(status.toLowerCase())}.`);
    await openOrderView(state.orderId);
    if (typeof state.onChanged === "function") state.onChanged();
  } catch (err) {
    showToast("danger", err.message || "Failed to update order status.");
  } finally {
    setButtonLoading(btn, false);
    state.loading = false;
  }
}

async function executePayment() {
  const input = document.getElementById("view-payment-amount");
  const feedback = document.getElementById("view-payment-feedback");
  const btn = document.getElementById("view-btn-save-payment");
  input.classList.remove("is-invalid"); feedback.textContent = "";

  const raw = input.value.trim();
  const totalCents = moneyCents(state.order.total);
  const amountCents = moneyCents(raw);
  if (!raw || !/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) < 0 || amountCents > totalCents) {
    input.classList.add("is-invalid");
    feedback.textContent = !raw || !/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) < 0
      ? "Enter a valid amount (2 decimals max)."
      : `Amount paid cannot exceed the order total (${moneyText(totalCents)}).`;
    input.focus();
    return;
  }

  state.loading = true;
  setButtonLoading(btn, true);
  try {
    await api.patch(`/api/orders/${state.orderId}/payment`, { amount_paid: Number(raw) });
    showToast("success", "Payment recorded.");
    await openOrderView(state.orderId);
    if (typeof state.onChanged === "function") state.onChanged();
  } catch (err) {
    if (err.details && err.details.fields && err.details.fields.amount_paid) {
      input.classList.add("is-invalid");
      feedback.textContent = escapeHtml(err.details.fields.amount_paid);
    } else {
      showToast("danger", err.message || "Failed to record payment.");
    }
  } finally {
    setButtonLoading(btn, false);
    state.loading = false;
  }
}

function wireEvents() {
  elements.statusActions.addEventListener("click", (e) => {
    const btn = e.target.closest(".view-action");
    if (!btn || state.loading) return;
    const action = btn.dataset.action;
    if (!ACTIONS[action]) return;
    if (CONFIRM_REQUIRED.has(action)) {
      const { status, label } = ACTIONS[action];
      const text = action === "cancel"
        ? `Cancel order ${escapeHtml(state.order.order_number)}? Stock will be restored to the products if it was already deducted. This cannot be undone.`
        : `Mark order ${escapeHtml(state.order.order_number)} as Completed? This is final and the status cannot be changed afterward.`;
      elements.confirmText.textContent = text;
      elements.confirmBtn.textContent = `Confirm ${escapeHtml(label)}`;
      state.pendingAction = action;
      bootstrap.Modal.getOrCreateInstance(elements.confirmModalEl).show();
      return;
    }
    executeStatusChange(action);
  });

  elements.confirmBtn.addEventListener("click", () => {
    const action = state.pendingAction;
    if (!action) return;
    state.pendingAction = null;
    bootstrap.Modal.getOrCreateInstance(elements.confirmModalEl).hide();
    executeStatusChange(action);
  });

  elements.paymentContainer.addEventListener("click", (e) => {
    const btn = e.target.closest("#view-btn-pay-full, #view-btn-save-payment");
    if (!btn) return;
    if (btn.id === "view-btn-save-payment") { executePayment(); return; }
    const input = document.getElementById("view-payment-amount");
    if (input) input.value = String((moneyCents(state.order.total) - moneyCents(state.order.amount_paid)) / 100);
  });

  elements.modalEl.addEventListener("hidden.bs.modal", () => {
    state.pendingAction = null;
    state.orderId = null;
    state.order = null;
  });
}

async function openOrderView(orderId) {
  state.orderId = Number(orderId);
  const modal = bootstrap.Modal.getOrCreateInstance(elements.modalEl);
  // Loading state that does NOT destroy the render targets: every element
  // render() writes to lives inside .modal-body, so wiping .modal-body here
  // detached those nodes and left the modal stuck on "Loading order…".
  elements.itemsContainer.innerHTML = '<div class="text-center py-3"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> <span>Loading order…</span></div>';
  elements.statusActions.innerHTML = "";
  elements.paymentContainer.innerHTML = "";
  elements.orderNumber.textContent = "—";
  elements.orderDate.textContent = "—";
  elements.orderStatus.innerHTML = "";
  elements.paymentStatus.innerHTML = "";
  elements.customer.textContent = "—";
  elements.notes.textContent = "—";
  elements.subtotal.textContent = "$0.00";
  elements.discount.textContent = "$0.00";
  elements.total.textContent = "$0.00";
  elements.amountPaid.textContent = "$0.00";
  elements.balanceDue.textContent = "$0.00";
  modal.show();
  try {
    const data = await api.get(`/api/orders/${state.orderId}`);
    render(data && data.data);
  } catch (err) {
    showToast("danger", err.message || "Failed to load order.");
    elements.itemsContainer.innerHTML = '<div class="text-danger">Failed to load order. Please try again.</div>';
  }
}

export function initOrderView({ onChanged } = {}) {
  state.onChanged = typeof onChanged === "function" ? onChanged : null;
  cacheElements();
  loadCurrency();
  wireEvents();
}

export { openOrderView };
