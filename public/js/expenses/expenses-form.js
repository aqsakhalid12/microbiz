// frontend/js/expenses/expenses-form.js
// Add / Edit / Delete expense modals and form handling.
// Communicates with the list module via the onReload callback.
import { api } from "/js/api/client.js";
import {
  escapeHtml,
  formatCurrency,
  showToast,
  setButtonLoading,
  showFormErrors,
  clearFormErrors,
} from "/js/components/ui.js";

const state = {
  modals: {},
  currentExpenseId: null,
  currencyCode: "USD",
  onReload: null,
};

const elements = {};

const DEFAULT_CATEGORIES = [
  "Rent",
  "Utilities",
  "Supplies",
  "Marketing",
  "Transport",
  "Salary",
  "Other",
];

function cacheElements() {
  elements.addExpenseModalEl = document.getElementById("add-expense-modal");
  elements.editExpenseModalEl = document.getElementById("edit-expense-modal");
  elements.deleteExpenseModalEl = document.getElementById("delete-expense-modal");
  elements.addExpenseForm = document.getElementById("add-expense-form");
  elements.editExpenseForm = document.getElementById("edit-expense-form");
  elements.deleteExpenseForm = document.getElementById("delete-expense-form");
  elements.addExpenseSubmit = document.getElementById("add-expense-submit");
  elements.editExpenseSubmit = document.getElementById("edit-expense-submit");
  elements.deleteExpenseSubmit = document.getElementById("delete-expense-submit");
  elements.categoryDatalist = document.getElementById("expense-category-list");
}

function initModals() {
  if (elements.addExpenseModalEl) {
    state.modals.addExpense = new bootstrap.Modal(elements.addExpenseModalEl);
  }
  if (elements.editExpenseModalEl) {
    state.modals.editExpense = new bootstrap.Modal(elements.editExpenseModalEl);
  }
  if (elements.deleteExpenseModalEl) {
    state.modals.deleteExpense = new bootstrap.Modal(elements.deleteExpenseModalEl);
  }
}

/**
 * Set the max date (today) and default value (today) on a date input.
 * @param {HTMLInputElement} input
 */
function setDateToday(input) {
  if (!input) return;
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  input.max = `${yyyy}-${mm}-${dd}`;
  if (!input.value) input.value = `${yyyy}-${mm}-${dd}`;
}

/**
 * Populate the category datalist with defaults plus categories from the API.
 */
async function loadCategories() {
  if (!elements.categoryDatalist) return;
  // Start with hardcoded defaults.
  const categories = [...DEFAULT_CATEGORIES];
  try {
    const data = await api.get("/api/expenses/categories");
    const apiCategories = Array.isArray(data.data) ? data.data : [];
    for (const cat of apiCategories) {
      if (cat && !categories.includes(cat)) categories.push(cat);
    }
  } catch {
    // Ignore API errors; defaults still available.
  }
  elements.categoryDatalist.innerHTML = categories
    .map((cat) => `<option value="${escapeHtml(cat)}"></option>`)
    .join("");
}

function openAddExpenseModal() {
  if (!elements.addExpenseForm) return;
  elements.addExpenseForm.reset();
  clearFormErrors(elements.addExpenseForm);
  setDateToday(document.getElementById("add-expense-date"));
  state.modals.addExpense.show();
}

function openEditExpenseModal(expense) {
  if (!expense) return;
  state.currentExpenseId = expense.id;
  document.getElementById("edit-expense-id").value = expense.id;
  document.getElementById("edit-category").value = expense.category || "";
  document.getElementById("edit-expense-date").value = expense.expense_date || "";
  document.getElementById("edit-amount").value = expense.amount !== null && expense.amount !== undefined ? expense.amount : "";
  document.getElementById("edit-description").value = expense.description || "";
  document.getElementById("edit-notes").value = expense.notes || "";
  const form = document.getElementById("edit-expense-form");
  if (form) clearFormErrors(form);
  state.modals.editExpense.show();
}

function openDeleteExpenseModal(expense) {
  if (!expense) return;
  state.currentExpenseId = expense.id;
  document.getElementById("delete-expense-id").value = expense.id;
  const nameEl = document.getElementById("delete-expense-name");
  if (nameEl) nameEl.textContent = escapeHtml(expense.category || expense.id);
  state.modals.deleteExpense.show();
}

function wireFormEvents() {
  // Add expense form
  if (elements.addExpenseForm) {
    elements.addExpenseForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormErrors(elements.addExpenseForm);
      setButtonLoading(elements.addExpenseSubmit, true);
      const formData = new FormData(elements.addExpenseForm);
      const data = {
        category: formData.get("category"),
        description: formData.get("description") || null,
        amount: formData.get("amount"),
        expense_date: formData.get("expense_date"),
        notes: formData.get("notes") || null,
      };
      try {
        await api.post("/api/expenses", data);
        showToast("success", "Expense added");
        state.modals.addExpense.hide();
        elements.addExpenseForm.reset();
        if (state.onReload) state.onReload();
      } catch (err) {
        if (err.details && err.details.fields) {
          showFormErrors(elements.addExpenseForm, err.details);
        } else {
          showToast("danger", err.message || "Failed to add expense");
        }
      } finally {
        setButtonLoading(elements.addExpenseSubmit, false);
      }
    });
  }

  // Edit expense form
  if (elements.editExpenseForm) {
    elements.editExpenseForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearFormErrors(elements.editExpenseForm);
      setButtonLoading(elements.editExpenseSubmit, true);
      const formData = new FormData(elements.editExpenseForm);
      const data = {
        category: formData.get("category"),
        description: formData.get("description") || null,
        amount: formData.get("amount"),
        expense_date: formData.get("expense_date"),
        notes: formData.get("notes") || null,
      };
      try {
        await api.put(`/api/expenses/${state.currentExpenseId}`, data);
        showToast("success", "Expense updated");
        state.modals.editExpense.hide();
        if (state.onReload) state.onReload();
      } catch (err) {
        if (err.details && err.details.fields) {
          showFormErrors(elements.editExpenseForm, err.details);
        } else {
          showToast("danger", err.message || "Failed to update expense");
        }
      } finally {
        setButtonLoading(elements.editExpenseSubmit, false);
      }
    });
  }

  // Delete confirmation form
  if (elements.deleteExpenseForm) {
    elements.deleteExpenseForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setButtonLoading(elements.deleteExpenseSubmit, true);
      try {
        await api.delete(`/api/expenses/${state.currentExpenseId}`);
        showToast("success", "Expense deleted");
        state.modals.deleteExpense.hide();
        if (state.onReload) state.onReload();
      } catch (err) {
        showToast("danger", err.message || "Failed to delete expense");
      } finally {
        setButtonLoading(elements.deleteExpenseSubmit, false);
      }
    });
  }
}

/**
 * Initialize the expense forms/modals.
 * @param {{onReload: Function}} opts
 */
export function initExpenseForms({ onReload } = {}) {
  state.onReload = onReload || null;
  cacheElements();
  initModals();
  loadCategories();
  // Set today's date on the date inputs once they exist.
  setDateToday(document.getElementById("add-expense-date"));
  setDateToday(document.getElementById("edit-expense-date"));
  wireFormEvents();
}

export { openAddExpenseModal, openEditExpenseModal, openDeleteExpenseModal };
