// frontend/js/pages/inventory.js
// Inventory movement history with filtering and pagination.
import { api } from "/js/api/client.js";
import { renderEmptyState, renderSkeleton, escapeHtml, showToast } from "/js/components/ui.js";
import { initSidebar } from "/js/components/sidebar.js";

// Initialize the app shell (sidebar/topbar)
initSidebar();

// Application state
const state = {
  movements: [],
  pagination: null,
  currentPage: 1,
  filters: {
    productId: "",
    type: "",
  },
  currencyCode: "USD",
  products: [],
};

// DOM elements (cached after init)
const elements = {};

/**
 * Cache DOM elements for repeated access.
 */
function cacheElements() {
  elements.inventoryContent = document.getElementById("inventory-content");
  elements.paginationControls = document.getElementById("pagination-controls");
  elements.productFilter = document.getElementById("product-filter");
  elements.typeFilter = document.getElementById("type-filter");
  elements.resetFiltersBtn = document.getElementById("reset-filters-btn");
}

/**
 * Show skeleton loading state.
 */
function showLoading() {
  if (!elements.inventoryContent) return;
  elements.inventoryContent.innerHTML = "";
  renderSkeleton(elements.inventoryContent, 5);
}

/**
 * Show error state.
 * @param {string} message
 */
function showError(message) {
  if (!elements.inventoryContent) return;
  elements.inventoryContent.innerHTML = "";
  renderEmptyState(elements.inventoryContent, {
    icon: "bi-emoji-frown",
    title: "Something went wrong",
    text: message,
  });
}

/**
 * Show empty state.
 */
function showEmpty() {
  if (!elements.inventoryContent) return;
  elements.inventoryContent.innerHTML = "";
  renderEmptyState(elements.inventoryContent, {
    icon: "bi-box-seam",
    title: "No movements found",
    text: "No inventory movements have been recorded.",
  });
}

/**
 * Get badge class for movement type.
 * @param {string} type
 * @returns {string}
 */
function getTypeBadgeClass(type) {
  switch (type) {
    case "initial_stock": return "bg-info";
    case "purchase": return "bg-success";
    case "sale": return "bg-warning text-dark";
    case "adjustment": return "bg-primary";
    case "cancellation_restore": return "bg-success";
    default: return "bg-secondary";
  }
}

/**
 * Format movement type as human-readable.
 * @param {string} type
 * @returns {string}
 */
function formatMovementType(type) {
  return type.replace("_", " ");
}

/**
 * Format a date as YYYY-MM-DD.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}

/**
 * Format time as HH:MM.
 * @param {string} dateStr
 * @returns {string}
 */
function formatTime(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/**
 * Render the inventory movements table.
 */
function renderMovementsTable() {
  if (!elements.inventoryContent) return;

  if (state.movements.length === 0) {
    showEmpty();
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0 inventory-table">
        <thead class="table-light">
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Product</th>
            <th scope="col">Type</th>
            <th scope="col" class="text-end">Change</th>
            <th scope="col" class="text-end">Stock After</th>
            <th scope="col" class="reason-column">Reason</th>
          </tr>
        </thead>
        <tbody>
  `;

  state.movements.forEach((m) => {
    const date = formatDate(m.created_at);
    const time = formatTime(m.created_at);
    const productName = escapeHtml(m.product_name || "Unknown product");
    const change = m.quantity_change > 0 ? `+${m.quantity_change}` : `${m.quantity_change}`;
    const changeClass = m.quantity_change > 0 ? "text-success" : "text-danger";
    const typeBadgeClass = getTypeBadgeClass(m.movement_type);
    const typeLabel = escapeHtml(formatMovementType(m.movement_type));
    const reason = escapeHtml(m.reason) || "‐";

     html += `
      <tr>
        <td class="inventory-tcell">
          <div>${escapeHtml(date)}</div>
          <small class="text-muted">${escapeHtml(time)}</small>
        </td>
        <td class="inventory-tcell">${productName}</td>
        <td class="inventory-tcell"><span class="badge ${typeBadgeClass}">${typeLabel}</span></td>
        <td class="inventory-tcell text-end ${changeClass} fw-medium">${change}</td>
        <td class="inventory-tcell text-end">${escapeHtml(m.stock_after)}</td>
        <td class="reason-column inventory-tcell text-muted small">${reason}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  elements.inventoryContent.innerHTML = html;
}

/**
 * Render pagination controls.
 */
function renderPagination() {
  if (!elements.paginationControls || !state.pagination) return;

  const { page, totalPages, limit, total } = state.pagination;
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  elements.paginationControls.innerHTML = "";

  if (total === 0) return;

  let html = `
    <div class="d-flex justify-content-between align-items-center">
      <div class="text-muted small">
        Showing ${startItem}-${endItem} of ${total} movements
      </div>
      <nav>
        <ul class="pagination mb-0">
  `;

  const getPageClass = (pageNum) => (pageNum === page ? "active" : "");

  // Previous button
  html += `<li class="page-item ${page === 1 ? "disabled" : ""}">`;
  html += `<button type="button" class="page-link" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>«</button></li>`;

  // Page numbers (show up to 5)
  const maxPages = 5;
  let startPage = Math.max(1, page - Math.floor(maxPages / 2));
  let endPage = Math.min(totalPages, startPage + maxPages - 1);
  startPage = Math.max(1, endPage - maxPages + 1);

  for (let i = startPage; i <= endPage; i++) {
    html += `<li class="page-item ${getPageClass(i)}">`;
    html += `<button type="button" class="page-link" data-page="${i}">${i}</button></li>`;
  }

  // Next button
  html += `<li class="page-item ${page === totalPages ? "disabled" : ""}">`;
  html += `<button type="button" class="page-link" data-page="${page + 1}" ${page === totalPages ? "disabled" : ""}>»</button></li>`;

  html += `
        </ul>
      </nav>
    </div>
  `;

  elements.paginationControls.innerHTML = html;

  // Wire pagination buttons
  elements.paginationControls.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const newPage = parseInt(btn.dataset.page, 10);
      if (newPage >= 1 && newPage <= totalPages) {
        state.currentPage = newPage;
        loadMovements();
      }
    });
  });
}

/**
 * Load movements from the API.
 */
async function loadMovements() {
  showLoading();

  const params = new URLSearchParams({
    page: state.currentPage,
    limit: 10,
  });

  if (state.filters.productId) params.set("product_id", state.filters.productId);
  if (state.filters.type) params.set("type", state.filters.type);

  try {
    const data = await api.get(`/api/inventory/movements?${params.toString()}`);
    state.movements = data.data || [];
    state.pagination = {
      page: state.currentPage,
      limit: 10,
      total: data.pagination?.total || 0,
      totalPages: data.pagination?.totalPages || 0,
    };
    renderMovementsTable();
    renderPagination();
  } catch (err) {
    showError(err.message || "Failed to load movements");
  }
}

/**
 * Load products and populate the product filter dropdown.
 */
async function loadProducts() {
  try {
    const params = new URLSearchParams({
      page: 1,
      limit: 100,
    });
    const data = await api.get(`/api/products?${params.toString()}`);
    state.products = data.data || [];

    if (elements.productFilter) {
      elements.productFilter.innerHTML = '<option value="">All Products</option>';
      state.products.forEach((product) => {
        const escapedName = escapeHtml(product.name);
        const escapedSku = escapeHtml(product.sku || "");
        const label = escapedSku ? `${escapedName} (${escapedSku})` : escapedName;
        elements.productFilter.innerHTML += `<option value="${product.id}">${label}</option>`;
      });
    }
  } catch (err) {
    // Products are optional; don't block movement loading
  }
}

/**
 * Apply filters and reset to first page.
 */
function applyFilters() {
  state.currentPage = 1;
  loadMovements();
}

/**
 * Load user profile for currency info.
 */
async function loadUserProfile() {
  try {
    const data = await api.get("/api/auth/me");
    const user = data.user || {};
    state.currencyCode = user.currency_code || "USD";
  } catch {
    // Use default
  }
}

/**
 * Wire up all event listeners.
 */
function wireEvents() {
  // Product filter
  elements.productFilter?.addEventListener("change", (e) => {
    state.filters.productId = e.target.value;
    applyFilters();
  });

  // Type filter
  elements.typeFilter?.addEventListener("change", (e) => {
    state.filters.type = e.target.value;
    applyFilters();
  });

  // Reset filters
  elements.resetFiltersBtn?.addEventListener("click", () => {
    state.filters = { productId: "", type: "" };
    elements.productFilter.value = "";
    elements.typeFilter.value = "";
    applyFilters();
  });
}

/**
 * Main initialization.
 */
async function init() {
  cacheElements();
  wireEvents();
  await loadUserProfile();
  await loadProducts();
  loadMovements();
}

init();