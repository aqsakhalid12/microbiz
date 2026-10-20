// frontend/js/expenses/expenses-list.js
// Expense listing page: filters, table, pagination, summary, and row actions.
import { api } from "/js/api/client.js";
import {
  renderEmptyState,
  renderSkeleton,
  escapeHtml,
  formatCurrency,
  showToast,
  initModalFocus,
} from "/js/components/ui.js";
import { initSidebar } from "/js/components/sidebar.js";
import {
  openAddExpenseModal,
  openEditExpenseModal,
  openDeleteExpenseModal,
  initExpenseForms,
} from "/js/expenses/expenses-form.js";

const state = {
  expenses: [],
  pagination: null,
  currentPage: 1,
  filters: { search: "", category: "", dateFrom: "", dateTo: "", sort: "expense_date:desc" },
  currencyCode: "USD",
};

const elements = {};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format a YYYY-MM-DD date string as "17 Oct 2026" (timezone-safe).
 * @param {string} dateStr
 * @returns {string}
 */
function formatExpenseDate(dateStr) {
  if (!dateStr) return "—";
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return "—";
  const d = Number(parts[2]);
  const m = Number(parts[1]);
  const y = Number(parts[0]);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return "—";
  return `${d} ${MONTHS[m - 1] || ""} ${y}`;
}

function cacheElements() {
  elements.expensesContent = document.getElementById("expenses-content");
  elements.paginationControls = document.getElementById("pagination-controls");
  elements.searchInput = document.getElementById("search-input");
  elements.categoryFilter = document.getElementById("category-filter");
  elements.dateFromFilter = document.getElementById("date-from-filter");
  elements.dateToFilter = document.getElementById("date-to-filter");
  elements.sortSelect = document.getElementById("sort-select");
  elements.resetFiltersBtn = document.getElementById("reset-filters-btn");
  elements.addExpenseBtn = document.getElementById("add-expense-btn");
  elements.summaryTotal = document.getElementById("summary-total");
  elements.summaryCount = document.getElementById("summary-count");
}

function showLoading() {
  if (!elements.expensesContent) return;
  elements.expensesContent.innerHTML = "";
  renderSkeleton(elements.expensesContent, 5);
}

function showError(message) {
  if (!elements.expensesContent) return;
  elements.expensesContent.innerHTML = "";
  renderEmptyState(elements.expensesContent, {
    icon: "bi-emoji-frown",
    title: "Something went wrong",
    text: message,
    actionLabel: "Retry",
    onAction: () => loadExpenses(1),
  });
}

function showEmpty() {
  if (!elements.expensesContent) return;
  elements.expensesContent.innerHTML = "";
  renderEmptyState(elements.expensesContent, {
    icon: "bi-cash-coin",
    title: "No expenses found",
    text: "Get started by adding your first expense.",
  });
}

function renderSummary(summary) {
  if (!summary) return;
  const total = formatCurrency(summary.total_amount, state.currencyCode);
  const count = Number(summary.count) || 0;
  if (elements.summaryTotal) elements.summaryTotal.textContent = total;
  if (elements.summaryCount) elements.summaryCount.textContent = count;
}

function renderExpensesTable() {
  if (!elements.expensesContent) return;
  if (state.expenses.length === 0) { showEmpty(); return; }
  let html =
    '<div class="table-responsive"><table class="table table-hover align-middle mb-0" id="expenses-table"><thead class="table-light"><tr><th scope="col">Date</th><th scope="col">Category</th><th scope="col">Description</th><th scope="col" class="text-end">Amount</th><th scope="col" class="text-end">Actions</th></tr></thead><tbody>';
  state.expenses.forEach((expense) => {
    const date = formatExpenseDate(expense.expense_date);
    const category = escapeHtml(expense.category || "—");
    const description = escapeHtml(expense.description || "—");
    const amount = formatCurrency(expense.amount, state.currencyCode);
    html += `<tr data-expense-id="${expense.id}"><td data-label="Date" class="d-md-table-cell">${date}</td><td data-label="Category" class="d-md-table-cell">${category}</td><td data-label="Description" class="d-md-table-cell">${description}</td><td data-label="Amount" class="d-md-table-cell text-end">${amount}</td><td class="d-md-table-cell text-end" data-label="Actions"><div class="btn-group btn-group-sm d-flex gap-1" role="group" style="flex-wrap: nowrap;"><button type="button" class="btn btn-outline-primary edit-btn" title="Edit"><i class="bi bi-pencil"></i></button><button type="button" class="btn btn-outline-danger delete-btn" title="Delete"><i class="bi bi-trash"></i></button></div></td></tr>`;
  });
  html += "</tbody></table></div>";
  elements.expensesContent.innerHTML = html;
}

function renderPagination() {
  if (!elements.paginationControls || !state.pagination) return;
  const { page, totalPages } = state.pagination;
  if (totalPages <= 1) { elements.paginationControls.innerHTML = ""; return; }
  let html = '<nav aria-label="Expenses pagination"><ul class="pagination justify-content-center mb-0"><li class="page-item ' + (page <= 1 ? "disabled" : "") + '"><button class="page-link" type="button" data-action="prev">Previous</button></li>';
  for (let i = 1; i <= totalPages && i <= 5; i++) {
    html += '<li class="page-item ' + (i === page ? "active" : "") + '"><button class="page-link" type="button" data-page="' + i + '">' + i + '</button></li>';
  }
  html += '<li class="page-item ' + (page >= totalPages ? "disabled" : "") + '"><button class="page-link" type="button" data-action="next">Next</button></li></ul></nav>';
  elements.paginationControls.innerHTML = html;
}

async function loadCategoriesIntoSelect() {
  if (!elements.categoryFilter) return;
  try {
    const data = await api.get("/api/expenses/categories");
    const categories = Array.isArray(data.data) ? data.data : [];
    let html = '<option value="">All Categories</option>';
    categories.forEach((cat) => {
      html += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
    });
    elements.categoryFilter.innerHTML = html;
  } catch {
    // Keep the empty "All Categories" option.
  }
}

async function loadExpenses(page = 1) {
  showLoading();
  try {
    state.currentPage = page;
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", "10");
    if (state.filters.search) params.set("search", state.filters.search);
    if (state.filters.category) params.set("category", state.filters.category);
    if (state.filters.dateFrom) params.set("date_from", state.filters.dateFrom);
    if (state.filters.dateTo) params.set("date_to", state.filters.dateTo);
    params.set("sort", state.filters.sort);
    const data = await api.get(`/api/expenses?${params.toString()}`);
    state.expenses = data.data || [];
    state.pagination = data.pagination || null;
    state.currencyCode = data.currencyCode || "USD";
    renderSummary(data.summary || { total_amount: 0, count: 0 });
    if (state.expenses.length === 0) showEmpty(); else renderExpensesTable();
    renderPagination();
  } catch (err) {
    showError(err.message || "Failed to load expenses");
  }
}

function wireListEvents() {
  let searchTimer = null;
  if (elements.searchInput) {
    elements.searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.filters.search = elements.searchInput.value;
        loadExpenses(1);
      }, 300);
    });
  }
  if (elements.categoryFilter) {
    elements.categoryFilter.addEventListener("change", () => {
      state.filters.category = elements.categoryFilter.value;
      loadExpenses(1);
    });
  }
  if (elements.dateFromFilter) {
    elements.dateFromFilter.addEventListener("change", () => {
      state.filters.dateFrom = elements.dateFromFilter.value;
      loadExpenses(1);
    });
  }
  if (elements.dateToFilter) {
    elements.dateToFilter.addEventListener("change", () => {
      state.filters.dateTo = elements.dateToFilter.value;
      loadExpenses(1);
    });
  }
  if (elements.sortSelect) {
    elements.sortSelect.addEventListener("change", () => {
      state.filters.sort = elements.sortSelect.value;
      loadExpenses(1);
    });
  }
  if (elements.resetFiltersBtn) {
    elements.resetFiltersBtn.addEventListener("click", () => {
      if (elements.searchInput) elements.searchInput.value = "";
      if (elements.categoryFilter) elements.categoryFilter.value = "";
      if (elements.dateFromFilter) elements.dateFromFilter.value = "";
      if (elements.dateToFilter) elements.dateToFilter.value = "";
      if (elements.sortSelect) elements.sortSelect.value = "expense_date:desc";
      state.filters = { search: "", category: "", dateFrom: "", dateTo: "", sort: "expense_date:desc" };
      loadExpenses(1);
    });
  }
  if (elements.addExpenseBtn) {
    elements.addExpenseBtn.addEventListener("click", () => {
      openAddExpenseModal();
    });
  }
  if (elements.paginationControls) {
    elements.paginationControls.addEventListener("click", (e) => {
      const target = e.target.closest("button");
      if (!target || target.disabled) return;
      if (target.dataset.action === "prev") loadExpenses(state.currentPage - 1);
      else if (target.dataset.action === "next") loadExpenses(state.currentPage + 1);
      else if (target.dataset.page) loadExpenses(parseInt(target.dataset.page, 10));
    });
  }
  if (elements.expensesContent) {
    elements.expensesContent.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-expense-id]");
      if (!row) return;
      const expenseId = row.dataset.expenseId;
      const expense = state.expenses.find((x) => x.id == expenseId);
      if (e.target.closest(".edit-btn")) {
        if (expense) openEditExpenseModal(expense);
      } else if (e.target.closest(".delete-btn")) {
        if (expense) openDeleteExpenseModal(expense);
      }
    });
  }
}

/**
 * Initialize the expenses page.
 */
export function init() {
  initSidebar();
  // Restore focus to the control that opened a modal when it is closed
  initModalFocus();
  cacheElements();
  initExpenseForms({ onReload: () => loadExpenses(state.currentPage) });
  loadCategoriesIntoSelect();
  wireListEvents();
  loadExpenses(1);
}
