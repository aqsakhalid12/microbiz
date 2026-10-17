// frontend/js/orders/orders-form.js
// New/Edit order modal form. Display-only totals in integer cents; the server
// recalculates and the client never sends prices, totals, or user_id.
import { api } from "/js/api/client.js";
import { escapeHtml, formatCurrency, showToast, setButtonLoading, showFormErrors, clearFormErrors } from "/js/components/ui.js";

const state = { currencyCode: "USD", customers: [], products: [], mode: "new", orderId: null, onSaved: null, modal: null, loaded: false };
const els = {};

function cacheElements() {
  els.modalEl = document.getElementById("order-modal"); els.form = document.getElementById("order-form");
  els.orderIdInput = document.getElementById("order-id"); els.modeInput = document.getElementById("order-mode");
  els.titleEl = document.getElementById("order-modal-label"); els.customerSelect = document.getElementById("order-customer");
  els.addLineBtn = document.getElementById("add-line-btn"); els.lineContainer = document.getElementById("line-items-container");
  els.itemsFeedback = document.getElementById("items-feedback"); els.discountInput = document.getElementById("order-discount");
  els.notesInput = document.getElementById("order-notes"); els.subtotalDisplay = document.getElementById("subtotal-display");
  els.discountDisplay = document.getElementById("discount-display"); els.totalDisplay = document.getElementById("total-display");
  els.submitBtn = document.getElementById("order-submit");
}

function currencyText(cents) { return formatCurrency(cents / 100, state.currencyCode); }

async function loadReferenceData() {
  if (state.loaded) return;
  await Promise.all([
    api.get("/api/customers?limit=50").then((r) => { state.customers = ((r && r.data) || []).map((c) => ({ id: c.id, name: c.name })); }),
    api.get("/api/products?limit=50").then((r) => { state.products = ((r && r.data) || []).map((p) => ({ id: p.id, name: p.name, stock: Number(p.stock_quantity || 0), priceCents: Math.round(Number(p.selling_price || 0) * 100) })); }),
    api.get("/api/auth/me").catch(() => null).then((r) => { const c = r?.user?.currency_code || r?.currency_code; if (c) state.currencyCode = c; }),
  ]);
  state.loaded = true;
  renderCustomerSelect();
}

function renderCustomerSelect() {
  els.customerSelect.innerHTML = "";
  const walkIn = document.createElement("option"); walkIn.value = ""; walkIn.textContent = "Walk-in customer";
  els.customerSelect.appendChild(walkIn);
  state.customers.forEach((c) => { const o = document.createElement("option"); o.value = String(c.id); o.textContent = escapeHtml(c.name); els.customerSelect.appendChild(o); });
}

function selectedPrice(selectEl) { if (!selectEl || !selectEl.selectedOptions) return 0; const opt = selectEl.selectedOptions[0]; return opt ? Number(opt.dataset.priceCents || 0) : 0; }

function productOptionsHtml(selectedId) {
  let html = '<option value="">Select product</option>';
  state.products.forEach((p) => { const sel = String(p.id) === selectedId ? " selected" : ""; html += `<option value="${p.id}" data-price-cents="${p.priceCents}" data-stock="${p.stock}"${sel}>${escapeHtml(p.name)} — Stock: ${p.stock}</option>`; });
  return html;
}

function buildLineItem(productId = "", quantity = 1) {
  const row = document.createElement("div");
  row.className = "row g-2 align-items-end line-item mb-2";
  row.dataset.lineId = String(Date.now()) + "-" + String(Math.floor(Math.random() * 1e9));
  const product = state.products.find((p) => String(p.id) === String(productId));
  const qty = Number.isFinite(Number(quantity)) && Number(quantity) >= 1 ? Number(quantity) : 1;
  row.innerHTML = `<div class="col-md-4"><select class="form-select product-select">${productOptionsHtml(String(productId))}</select><div class="invalid-feedback"></div></div><div class="col-md-3"><input type="number" class="form-control quantity-input" min="1" step="1" value="${qty}"><div class="invalid-feedback"></div></div><div class="col-md-3 d-flex align-items-end"><strong class="line-total w-100 text-end">${currencyText(0)}</strong></div><div class="col-md-2 d-flex align-items-end"><button type="button" class="btn btn-outline-danger btn-sm remove-line w-100" title="Remove line"><i class="bi bi-trash"></i></button></div>`;
  const sel = row.querySelector(".product-select"); const lt = row.querySelector(".line-total");
  if (sel && lt) lt.textContent = currencyText(selectedPrice(sel) * qty);
  els.lineContainer.appendChild(row);
  return row;
}

function reindexLines() {
  els.lineContainer.querySelectorAll(".line-item").forEach((row, i) => {
    row.querySelector(".product-select").name = `items[${i}].product_id`;
    row.querySelector(".quantity-input").name = `items[${i}].quantity`;
  });
}

function computeTotals() {
  let subtotalCents = 0;
  els.lineContainer.querySelectorAll(".line-item").forEach((row) => {
    const sel = row.querySelector(".product-select"); const input = row.querySelector(".quantity-input");
    const priceCents = selectedPrice(sel);
    const qty = Number.isFinite(Number(input.value)) && Number(input.value) >= 1 ? Math.trunc(Number(input.value)) : 0;
    const total = priceCents * Math.max(1, qty); subtotalCents += total;
    const display = row.querySelector(".line-total");
    if (display) display.textContent = currencyText(total);
  });
  const discountNum = els.discountInput.value.trim() === "" ? 0 : parseFloat(els.discountInput.value);
  const discountCents = Number.isFinite(discountNum) && discountNum >= 0 ? Math.round(discountNum * 100) : 0;
  els.subtotalDisplay.textContent = currencyText(subtotalCents);
  els.discountDisplay.textContent = currencyText(discountCents);
  els.totalDisplay.textContent = currencyText(Math.max(0, subtotalCents - discountCents));
  return { subtotalCents, discountCents };
}

function setFieldError(input, message) {
  const fb = input.parentElement.querySelector(".invalid-feedback");
  input.classList.toggle("is-invalid", !!message); if (fb) fb.textContent = message || "";
}

function validateClient() {
  const totals = computeTotals(); const errors = {};
  els.lineContainer.querySelectorAll(".line-item").forEach((row, i) => {
    const sel = row.querySelector(".product-select"); const input = row.querySelector(".quantity-input"); const prefix = `items[${i}]`;
    if (!sel.value) { errors[`${prefix}.product_id`] = "Select a product."; sel.classList.add("is-invalid"); const fb = sel.parentElement.querySelector(".invalid-feedback"); if (fb) fb.textContent = errors[`${prefix}.product_id`]; }
    const qty = Number(input.value);
    if (!Number.isInteger(qty) || qty < 1) { errors[`${prefix}.quantity`] = "Quantity must be a whole number of 1 or more."; input.classList.add("is-invalid"); const fb = input.parentElement.querySelector(".invalid-feedback"); if (fb) fb.textContent = errors[`${prefix}.quantity`]; }
  });
  if (!els.lineContainer.querySelector(".line-item")) { errors.items = "Add at least one line item."; els.itemsFeedback.textContent = errors.items; } else els.itemsFeedback.textContent = "";
  const discountNum = els.discountInput.value.trim() === "" ? 0 : parseFloat(els.discountInput.value);
  if (!Number.isFinite(discountNum) || discountNum < 0) errors.discount = "Discount must be a number >= 0.";
  else if (Math.round(discountNum * 100) > totals.subtotalCents) errors.discount = "Discount cannot exceed subtotal.";
  setFieldError(els.discountInput, errors.discount || "");
  return Object.keys(errors).length === 0;
}

function applyServerErrors(fields) {
  clearFormErrors(els.form); showFormErrors(els.form, { fields });
  for (const [key, message] of Object.entries(fields || {})) {
    const input = Array.from(els.form.elements).find((el) => el.name === key);
    if (!input || input.classList.contains("is-invalid")) continue;
    const fb = input.parentElement.querySelector(".invalid-feedback");
    if (fb) { input.classList.add("is-invalid"); fb.textContent = message; }
  }
}

function buildBody() {
  const items = [];
  els.lineContainer.querySelectorAll(".line-item").forEach((row) => {
    const sel = row.querySelector(".product-select"); const input = row.querySelector(".quantity-input");
    items.push({ product_id: Number(sel.value), quantity: Number(input.value) });
  });
  const customerId = els.customerSelect.value.trim();
  const body = { items, discount: Number(els.discountInput.value || 0), notes: String(els.notesInput.value.trim()) };
  if (customerId) body.customer_id = Number(customerId);
  return body;
}

async function openOrderForm(orderId) {
  await loadReferenceData(); clearFormErrors(els.form); els.lineContainer.innerHTML = ""; els.itemsFeedback.textContent = "";
  state.mode = "new"; state.orderId = null; els.titleEl.textContent = "New order";
  els.orderIdInput.value = ""; els.modeInput.value = "new"; els.discountInput.value = "0.00"; els.notesInput.value = "";
  if (orderId) {
    state.mode = "edit"; state.orderId = Number(orderId); els.titleEl.textContent = "Edit order";
    els.orderIdInput.value = String(state.orderId); els.modeInput.value = "edit";
    try {
      const data = await api.get(`/api/orders/${state.orderId}`); const order = data && data.data;
      if (!order) throw new Error("Order not found");
      if (order.status !== "Pending") { showToast("warning", "Only Pending orders can be edited."); return; }
      if (order.customer_id) els.customerSelect.value = String(order.customer_id);
      els.notesInput.value = order.notes || ""; els.discountInput.value = String(order.discount || "0.00");
      const items = order.items || [];
      if (items.length) items.forEach((it) => buildLineItem(it.product_id, it.quantity)); else buildLineItem();
      reindexLines(); computeTotals();
    } catch (err) { showToast("danger", err.message || "Failed to load order"); return; }
  } else { buildLineItem(); reindexLines(); computeTotals(); }
  if (!els.modal) els.modal = bootstrap.Modal.getOrCreateInstance(els.modalEl);
  els.modal.show();
}

export function initOrderForm({ onSaved } = {}) {
  state.onSaved = typeof onSaved === "function" ? onSaved : null; cacheElements(); els.modal = bootstrap.Modal.getOrCreateInstance(els.modalEl);
  els.addLineBtn.addEventListener("click", () => { buildLineItem(); reindexLines(); computeTotals(); });
  els.lineContainer.addEventListener("click", (e) => { const btn = e.target.closest(".remove-line"); if (!btn) return; const lineId = btn.dataset.lineId; const row = Array.from(els.lineContainer.querySelectorAll(".line-item")).find((r) => r.dataset.lineId === lineId); if (row) row.remove(); reindexLines(); computeTotals(); });
  els.lineContainer.addEventListener("input", (e) => { if (e.target.classList.contains("product-select") || e.target.classList.contains("quantity-input")) computeTotals(); });
  els.discountInput.addEventListener("input", computeTotals);
  els.form.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!validateClient()) return;
    setButtonLoading(els.submitBtn, true);
    try {
      const body = buildBody();
      if (state.mode === "edit") { await api.put(`/api/orders/${state.orderId}`, body); showToast("success", "Order updated"); }
      else { await api.post("/api/orders", body); showToast("success", "Order created"); }
      if (!els.modal) els.modal = bootstrap.Modal.getOrCreateInstance(els.modalEl);
      els.modal.hide(); els.form.reset(); if (state.onSaved) state.onSaved();
    } catch (err) { if (err.details && err.details.fields) applyServerErrors(err.details.fields); else showToast("danger", err.message || "Failed to save order"); }
    finally { setButtonLoading(els.submitBtn, false); }
  });
  els.modalEl.addEventListener("hidden.bs.modal", () => { clearFormErrors(els.form); els.lineContainer.innerHTML = ""; els.itemsFeedback.textContent = ""; });
  loadReferenceData().catch(() => {});
}

export { openOrderForm };
