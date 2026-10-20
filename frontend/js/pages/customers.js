// frontend/js/pages/customers.js
import { api } from "/js/api/client.js";
import { renderEmptyState, renderSkeleton, escapeHtml, formatCurrency, showToast, setButtonLoading, showFormErrors, clearFormErrors } from "/js/components/ui.js";
import { initSidebar } from "/js/components/sidebar.js";

initSidebar();

const state = {
  customers: [],
  pagination: null,
  currentPage: 1,
  filters: { search: "", sort: "name:asc" },
  currencyCode: "USD",
  modals: {},
  currentCustomerId: null,
};

const elements = {};

function cacheElements() {
  elements.customersContent = document.getElementById("customers-content");
  elements.paginationControls = document.getElementById("pagination-controls");
  elements.searchInput = document.getElementById("search-input");
  elements.sortSelect = document.getElementById("sort-select");
  elements.resetFiltersBtn = document.getElementById("reset-filters-btn");
  elements.addCustomerBtn = document.getElementById("add-customer-btn");
}

function initModals() {
  state.modals.addCustomer = new bootstrap.Modal(document.getElementById("add-customer-modal"));
  state.modals.editCustomer = new bootstrap.Modal(document.getElementById("edit-customer-modal"));
  state.modals.viewCustomer = new bootstrap.Modal(document.getElementById("view-customer-modal"));
  state.modals.deleteCustomer = new bootstrap.Modal(document.getElementById("delete-customer-modal"));
}

function showLoading() {
  if (!elements.customersContent) return;
  elements.customersContent.innerHTML = "";
  renderSkeleton(elements.customersContent, 5);
}

function showError(message) {
  if (!elements.customersContent) return;
  elements.customersContent.innerHTML = "";
  renderEmptyState(elements.customersContent, { icon: "bi-emoji-frown", title: "Something went wrong", text: message, actionLabel: "Retry", onAction: () => loadCustomers(1) });
}

function showEmpty() {
  if (!elements.customersContent) return;
  elements.customersContent.innerHTML = "";
  renderEmptyState(elements.customersContent, { icon: "bi-people", title: "No customers found", text: "Get started by adding your first customer." });
}

function renderCustomersTable() {
  if (!elements.customersContent) return;
  if (state.customers.length === 0) { showEmpty(); return; }
  let html = '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead class="table-light"><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Phone</th><th scope="col">Orders</th><th scope="col">Total Spent</th><th scope="col" class="text-end">Actions</th></tr></thead><tbody>';
  state.customers.forEach((customer) => {
    const name = escapeHtml(customer.name || "—");
    const email = escapeHtml(customer.email || "—");
    const phone = escapeHtml(customer.phone || "—");
    const ordersCount = customer.order_count;
    const totalSpent = formatCurrency(customer.total_spent, state.currencyCode);
    html += `<tr data-customer-id="${customer.id}"><td data-label="Name">${name}</td><td data-label="Email">${email}</td><td data-label="Phone">${phone}</td><td data-label="Orders">${ordersCount}</td><td data-label="Total Spent">${totalSpent}</td><td class="text-end" data-label="Actions"><div class="btn-group btn-group-sm d-flex gap-1" role="group" style="flex-wrap: nowrap;"><button type="button" class="btn btn-outline-secondary view-btn" title="View"><i class="bi bi-eye"></i></button><button type="button" class="btn btn-outline-primary edit-btn" title="Edit"><i class="bi bi-pencil"></i></button><button type="button" class="btn btn-outline-danger delete-btn" title="Delete"><i class="bi bi-trash"></i></button></div></td></tr>`;
  });
  html += '</tbody></table></div>';
  elements.customersContent.innerHTML = html;
}

function renderPagination() {
  if (!elements.paginationControls || !state.pagination) return;
  const { page, totalPages } = state.pagination;
  if (totalPages <= 1) { elements.paginationControls.innerHTML = ""; return; }
  let html = '<nav aria-label="Customers pagination"><ul class="pagination justify-content-center mb-0"><li class="page-item ' + (page <= 1 ? "disabled" : "") + '"><button class="page-link" type="button" data-action="prev">Previous</button></li>';
  for (let i = 1; i <= totalPages && i <= 5; i++) {
    html += '<li class="page-item ' + (i === page ? "active" : "") + '"><button class="page-link" type="button" data-page="' + i + '">' + i + '</button></li>';
  }
  html += '<li class="page-item ' + (page >= totalPages ? "disabled" : "") + '"><button class="page-link" type="button" data-action="next">Next</button></li></ul></nav>';
  elements.paginationControls.innerHTML = html;
}

async function loadCustomers(page = 1) {
  showLoading();
  try {
    state.currentPage = page;
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", "10");
    if (state.filters.search) params.set("search", state.filters.search);
    params.set("sort", state.filters.sort);
    const data = await api.get(`/api/customers?${params.toString()}`);
    state.customers = data.data || [];
    state.pagination = data.pagination || null;
    state.currencyCode = data.currency_code || data.currencyCode || "USD";
    if (state.customers.length === 0) showEmpty(); else renderCustomersTable();
    renderPagination();
  } catch (err) {
    showError(err.message || "Failed to load customers");
  }
}
function wireEvents() {
  let searchTimer = null;
  if (elements.searchInput) {
    elements.searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.filters.search = elements.searchInput.value; loadCustomers(1); }, 300);
    });
  }
  if (elements.sortSelect) {
    elements.sortSelect.addEventListener("change", () => { state.filters.sort = elements.sortSelect.value; loadCustomers(1); });
  }
  if (elements.resetFiltersBtn) {
    elements.resetFiltersBtn.addEventListener("click", () => {
      if (elements.searchInput) elements.searchInput.value = "";
      if (elements.sortSelect) elements.sortSelect.value = "name:asc";
      state.filters.search = ""; state.filters.sort = "name:asc";
      loadCustomers(1);
    });
  }
  if (elements.addCustomerBtn) {
    elements.addCustomerBtn.addEventListener("click", () => {
      const form = document.getElementById("add-customer-form");
      if (form) { form.reset(); clearFormErrors(form); }
      state.modals.addCustomer.show();
    });
  }
  const addForm = document.getElementById("add-customer-form");
  if (addForm) {
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormErrors(addForm);
      const submitBtn = document.getElementById("add-customer-submit");
      setButtonLoading(submitBtn, true);
      const formData = new FormData(addForm);
      const data = { name: formData.get("name"), email: formData.get("email"), phone: formData.get("phone"), address: formData.get("address"), notes: formData.get("notes") };
      try {
        await api.post("/api/customers", data);
        showToast("success", "Customer added");
        state.modals.addCustomer.hide(); addForm.reset(); loadCustomers(1);
      } catch (err) {
        if (err.details && err.details.fields) showFormErrors(addForm, err.details); else showToast("danger", err.message || "Failed to add customer");
      } finally { setButtonLoading(submitBtn, false); }
    });
  }
  const editForm = document.getElementById("edit-customer-form");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormErrors(editForm);
      const submitBtn = document.getElementById("edit-customer-submit");
      setButtonLoading(submitBtn, true);
      const formData = new FormData(editForm);
      const data = { name: formData.get("name"), email: formData.get("email") || "", phone: formData.get("phone") || "", address: formData.get("address") || "", notes: formData.get("notes") || "" };
      Object.keys(data).forEach((k) => { if (k !== "name" && (data[k] === "" || data[k] == null)) data[k] = null; });
      try {
        await api.put(`/api/customers/${state.currentCustomerId}`, data);
        showToast("success", "Customer updated");
        state.modals.editCustomer.hide(); loadCustomers(state.currentPage);
      } catch (err) {
        if (err.details && err.details.fields) showFormErrors(editForm, err.details); else showToast("danger", err.message || "Failed to update customer");
      } finally { setButtonLoading(submitBtn, false); }
    });
  }
  const deleteForm = document.getElementById("delete-customer-form");
  if (deleteForm) {
    deleteForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("delete-customer-submit");
      setButtonLoading(submitBtn, true);
      try {
        await api.delete(`/api/customers/${state.currentCustomerId}`);
        showToast("success", "Customer deleted");
        state.modals.deleteCustomer.hide(); loadCustomers(state.currentPage);
      } catch (err) { showToast("danger", err.message || "Failed to delete customer"); } finally { setButtonLoading(submitBtn, false); }
    });
  }
  if (elements.paginationControls) {
    elements.paginationControls.addEventListener("click", (e) => {
      const target = e.target.closest("button");
      if (!target || target.disabled) return;
      if (target.dataset.action === "prev") loadCustomers(state.currentPage - 1);
      else if (target.dataset.action === "next") loadCustomers(state.currentPage + 1);
      else if (target.dataset.page) loadCustomers(parseInt(target.dataset.page, 10));
    });
  }
  if (elements.customersContent) {
    elements.customersContent.addEventListener("click", async (e) => {
      const row = e.target.closest("tr[data-customer-id]");
      if (!row) return;
      const customerId = row.dataset.customerId;
      if (e.target.closest(".view-btn")) { state.currentCustomerId = customerId; await openViewModal(customerId); }
      if (e.target.closest(".edit-btn")) { state.currentCustomerId = customerId; openEditModal(customerId); }
      if (e.target.closest(".delete-btn")) {
        state.currentCustomerId = customerId;
        const customer = state.customers.find((c) => c.id == customerId);
        const deleteNameEl = document.getElementById("delete-customer-name");
        if (deleteNameEl) deleteNameEl.textContent = customer ? customer.name : customerId;
        state.modals.deleteCustomer.show();
      }
    });
  }
}

function openEditModal(customerId) {
  const customer = state.customers.find((c) => c.id == customerId);
  if (!customer) return;
  document.getElementById("edit-customer-id").value = customer.id;
  document.getElementById("edit-name").value = customer.name || "";
  document.getElementById("edit-email").value = customer.email || "";
  document.getElementById("edit-phone").value = customer.phone || "";
  document.getElementById("edit-address").value = customer.address || "";
  document.getElementById("edit-notes").value = customer.notes || "";
  const form = document.getElementById("edit-customer-form");
  if (form) clearFormErrors(form);
  state.modals.editCustomer.show();
}

async function openViewModal(customerId) {
  try {
    const customerData = await api.get(`/api/customers/${customerId}`);
    const ordersData = await api.get(`/api/customers/${customerId}/orders?page=1&limit=10`);
    const customer = customerData.data;
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || "—"; };
    setText("view-name", customer.name);
    setText("view-email", customer.email);
    setText("view-phone", customer.phone);
    setText("view-address", customer.address);
    setText("view-notes", customer.notes);
    setText("view-orders-count", customer.order_count);
    setText("view-total-spent", formatCurrency(customer.total_spent || 0, state.currencyCode));
    const orders = ordersData.data || [];
    const historyContent = document.getElementById("order-history-content");
    if (!historyContent) return;
    if (orders.length === 0) {
      historyContent.innerHTML = '<div class="text-muted">No orders yet</div>';
    } else {
      let html = '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead class="table-light"><tr><th>Order #</th><th>Status</th><th>Payment</th><th>Total</th><th>Date</th></tr></thead><tbody>';
orders.forEach((order) => {
        const statusBadge = order.status === "Completed" ? '<span class="badge bg-success">Completed</span>' : order.status === "Cancelled" ? '<span class="badge bg-secondary">Cancelled</span>' : order.status === "Confirmed" || order.status === "Processing" ? `<span class="badge bg-primary">${escapeHtml(order.status)}</span>` : `<span class="badge bg-warning text-dark">${escapeHtml(order.status)}</span>`;
        const orderDate = order.order_date ? new Date(order.order_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
        const paymentBadge = order.payment_status === "Paid" ? '<span class="badge bg-success">Paid</span>' : order.payment_status === "Partially Paid" ? '<span class="badge bg-info text-dark">Partially Paid</span>' : '<span class="badge bg-secondary">Unpaid</span>';
        html += `<tr><td data-label="Order #">${escapeHtml(order.order_number)}</td><td data-label="Status">${statusBadge}</td><td data-label="Payment">${paymentBadge}</td><td data-label="Total">${formatCurrency(order.total, state.currencyCode)}</td><td data-label="Date">${orderDate}</td></tr>`;
      });
      html += '</tbody></table></div>';
      historyContent.innerHTML = html;
    }
    state.modals.viewCustomer.show();
  } catch (err) { showToast("danger", err.message || "Failed to load customer details"); }
}

function init() {
  cacheElements(); initModals(); wireEvents(); loadCustomers(1);
}
init();
