// frontend/js/pages/products.js
// Product listing, filtering, sorting, pagination, and modal interactions.
import { api } from "/js/api/client.js";
import { renderEmptyState, renderSkeleton, escapeHtml, formatCurrency, showToast, setButtonLoading, initModalFocus } from "/js/components/ui.js";
import { initSidebar } from "/js/components/sidebar.js";

// Initialize the app shell (sidebar/topbar)
initSidebar();

// Restore focus to the control that opened a modal when it is closed
initModalFocus();

// Application state
const state = {
  products: [],
  pagination: null,
  currentPage: 1,
  filters: {
    search: "",
    category: "",
    stock: "",
    sort: "name:asc",
  },
  currencyCode: "USD",
  categories: [],
  // Bootstrap modal instances
  modals: {},
};

// DOM elements (cached after init)
const elements = {};

/**
 * Cache DOM elements for repeated access.
 */
function cacheElements() {
  elements.productsContent = document.getElementById("products-content");
  elements.paginationControls = document.getElementById("pagination-controls");
  elements.searchInput = document.getElementById("search-input");
  elements.categoryFilter = document.getElementById("category-filter");
  elements.stockFilter = document.getElementById("stock-filter");
  elements.sortSelect = document.getElementById("sort-select");
  elements.resetFiltersBtn = document.getElementById("reset-filters-btn");
  elements.addProductBtn = document.getElementById("add-product-btn");
}

/**
 * Initialize Bootstrap modals.
 */
function initModals() {
  state.modals.addProduct = new bootstrap.Modal(document.getElementById("add-product-modal"));
  state.modals.editProduct = new bootstrap.Modal(document.getElementById("edit-product-modal"));
  state.modals.adjustStock = new bootstrap.Modal(document.getElementById("adjust-stock-modal"));
  state.modals.stockHistory = new bootstrap.Modal(document.getElementById("stock-history-modal"));
  state.modals.deleteProduct = new bootstrap.Modal(document.getElementById("delete-product-modal"));
}

/**
 * Show skeleton loading state.
 */
function showLoading() {
  if (!elements.productsContent) return;
  elements.productsContent.innerHTML = "";
  renderSkeleton(elements.productsContent, 5);
}

/**
 * Show error state.
 * @param {string} message
 */
function showError(message) {
  if (!elements.productsContent) return;
  elements.productsContent.innerHTML = "";
  renderEmptyState(elements.productsContent, {
    icon: "bi-emoji-frown",
    title: "Something went wrong",
    text: message,
    actionLabel: "Retry",
    onAction: loadProducts,
  });
}

/**
 * Show empty state.
 */
function showEmpty() {
  if (!elements.productsContent) return;
  elements.productsContent.innerHTML = "";
  renderEmptyState(elements.productsContent, {
    icon: "bi-box-seam",
    title: "No products found",
    text: "Get started by adding your first product.",
  });
}

/**
 * Render the stock status badge for a product.
 * @param {Object} product
 * @returns {string}
 */
function stockBadge(product) {
  const stock = product.stock_quantity;
  const threshold = product.low_stock_threshold;

  if (stock === 0) {
    return '<span class="badge bg-secondary">Out of stock</span>';
  }
  if (stock <= threshold) {
    return '<span class="badge bg-warning text-dark">Low stock</span>';
  }
  return '<span class="badge bg-success">In stock</span>';
}

/**
 * Render the products table.
 */
function renderProductsTable() {
  if (!elements.productsContent) return;

  if (state.products.length === 0) {
    showEmpty();
    return;
  }

  let html = "";

  // Desktop table version
  html += `
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th scope="col">Product</th>
            <th scope="col">SKU</th>
            <th scope="col">Category</th>
            <th scope="col">Selling Price</th>
            <th scope="col">Cost Price</th>
            <th scope="col">Stock</th>
            <th scope="col" class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
  `;

  state.products.forEach((product) => {
    const name = escapeHtml(product.name || "—");
    const sku = escapeHtml(product.sku || "—");
    const category = escapeHtml(product.category || "—");
    const sellingPrice = formatCurrency(product.selling_price, state.currencyCode);
    const costPrice = formatCurrency(product.cost_price, state.currencyCode);
    const stock = product.stock_quantity;
    const badge = stockBadge(product);
    const imageUrl = product.image_url ? escapeHtml(product.image_url) : "";
    const hasImage = !!product.image_url;
    const thumbBtnAttrs = hasImage
      ? `type="button" class="product-thumb-btn" data-image-url="${imageUrl}" data-product-name="${name}" aria-label="View image of ${name}"`
      : "";
    const thumbContent = hasImage
      ? `<img src="${imageUrl}" alt="" loading="lazy" referrerpolicy="no-referrer" class="product-img" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px; background: #f8f9fa;">`
      : '<i class="bi bi-image" style="font-size: 1.5rem; color: #6c757d;"></i>';

    html += `
      <tr data-product-id="${product.id}">
        <td data-label="Product">
          <div class="d-flex align-items-center">
            <div class="me-3">
              <button ${thumbBtnAttrs} style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border: none; background: #f8f9fa; border-radius: 10px; padding: 0; cursor: ${hasImage ? "pointer" : "default"}; transition: transform 150ms ease;">${thumbContent}</button>
            </div>
            <div>
              <div class="fw-medium">${name}</div>
              <span class="text-muted small">${sku}</span>
            </div>
          </div>
        </td>
        <td data-label="SKU" class="d-none d-md-table-cell"><span>${sku}</span></td>
        <td data-label="Category">${category}</td>
        <td data-label="Selling Price">${sellingPrice}</td>
        <td data-label="Cost Price">${costPrice}</td>
        <td data-label="Stock">
          <div>${badge}</div>
          <small class="text-muted">${stock} units</small>
        </td>
        <td class="text-end" data-label="Actions">
          <div class="btn-group btn-group-sm d-flex gap-1" role="group" style="flex-wrap: nowrap;">
            <button type="button" class="btn btn-outline-secondary edit-btn" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button type="button" class="btn btn-outline-primary adjust-btn flex-shrink-0" title="Adjust stock">
              <i class="bi bi-arrow-left-right"></i>
            </button>
            <button type="button" class="btn btn-outline-info history-btn flex-shrink-0" title="View history">
              <i class="bi bi-clock-history"></i>
            </button>
            <button type="button" class="btn btn-outline-danger delete-btn flex-shrink-0" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  // Mobile stacked cards handled by CSS below 768px

  elements.productsContent.innerHTML = html;

  // Attach error handlers for product images (fallback to placeholder)
  elements.productsContent.querySelectorAll(".product-img").forEach((img) => {
    img.addEventListener("error", () => {
      img.outerHTML = '<i class="bi bi-image" style="font-size: 1.5rem; color: #6c757d;"></i>';
    });
  });

  // Image lightbox: event delegation on thumbnail buttons
  elements.productsContent.querySelectorAll(".product-thumb-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const imageUrl = btn.dataset.imageUrl;
      const productName = btn.dataset.productName;
      openImageModal(imageUrl, productName);
    });
    // Hover zoom effect
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "scale(1.05)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "scale(1)";
    });
  });

  // Wire action buttons
  wireActionButtons();
}

/**
 * Wire click handlers for action buttons in the products table/cards.
 */
function wireActionButtons() {
  elements.productsContent.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const row = e.target.closest("[data-product-id]");
      const id = parseInt(row.dataset.productId, 10);
      openEditModal(id);
    });
  });

  elements.productsContent.querySelectorAll(".adjust-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const row = e.target.closest("[data-product-id]");
      const id = parseInt(row.dataset.productId, 10);
      openAdjustStockModal(id);
    });
  });

  elements.productsContent.querySelectorAll(".history-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const row = e.target.closest("[data-product-id]");
      const id = parseInt(row.dataset.productId, 10);
      openStockHistoryModal(id);
    });
  });

  elements.productsContent.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const row = e.target.closest("[data-product-id]");
      const id = parseInt(row.dataset.productId, 10);
      openDeleteModal(id);
    });
  });
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
        Showing ${startItem}-${endItem} of ${total} products
      </div>
      <nav>
        <ul class="pagination mb-0">
  `;

  const getPageClass = (pageNum) => (pageNum === page ? "active" : "");
  const createPageBtn = (pageNum, label) => {
    const disabled = pageNum === page || pageNum < 1 || pageNum > totalPages;
    return `
      <li class="page-item ${getPageClass(pageNum)} ${disabled ? "disabled" : ""}">
        <button type="button" class="page-link" data-page="${pageNum}" ${disabled ? "disabled" : ""}>
          ${label}
        </button>
      </li>
    `;
  };

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
        loadProducts();
      }
    });
  });
}

/**
 * Load products from the API.
 */
async function loadProducts() {
  showLoading();

  const params = new URLSearchParams({
    page: state.currentPage,
    limit: 10,
    sort: state.filters.sort,
  });

  if (state.filters.search) params.set("search", state.filters.search);
  if (state.filters.category) params.set("category", state.filters.category);
  if (state.filters.stock) params.set("stock", state.filters.stock);

  try {
    const data = await api.get(`/api/products?${params.toString()}`);
    state.products = data.data || [];
    state.pagination = {
      page: state.currentPage,
      limit: 10,
      total: data.pagination?.total || 0,
      totalPages: data.pagination?.totalPages || 0,
    };
    renderProductsTable();
    renderPagination();
  } catch (err) {
    showError(err.message || "Failed to load products");
  }
}

/**
 * Load categories and populate the category filter dropdown.
 */
async function loadCategories() {
  try {
    const data = await api.get("/api/products/categories");
    state.categories = data.data || [];

    if (elements.categoryFilter) {
      elements.categoryFilter.innerHTML = '<option value="">All Categories</option>';
      state.categories.forEach((cat) => {
        const escapedCat = escapeHtml(cat);
        elements.categoryFilter.innerHTML += `<option value="${escapedCat}">${escapedCat}</option>`;
      });
    }
  } catch (err) {
    // Categories are optional; don't block product loading
  }
}

/**
 * Apply filters and reset to first page.
 */
function applyFilters() {
  state.currentPage = 1;
  loadProducts();
}

// --- Modal actions ---

/**
 * Open the Add Product modal and reset form.
 */
function openAddProductModal() {
  const form = document.getElementById("add-product-form");
  if (!form) return;
  form.reset();
  clearFormErrors(form);
  // Reset image preview
  resetImagePreview("add");
  state.modals.addProduct.show();
}

/**
 * Update image preview for Add/Edit modal.
 * @param {string} prefix - "add" or "edit"
 * @param {string} url - image URL
 */
function updateImagePreview(prefix, url) {
  const previewContainer = document.getElementById(`${prefix}-image-preview`);
  const previewImg = document.getElementById(`${prefix}-image-preview-img`);
  const placeholder = document.getElementById(`${prefix}-image-preview-placeholder`);

  if (!previewContainer || !previewImg || !placeholder) return;

  if (url && url.trim()) {
    previewContainer.style.display = "block";
    previewImg.src = url;
    previewImg.style.display = "block";
    placeholder.style.display = "none";
  } else {
    previewContainer.style.display = "none";
    previewImg.src = "";
    previewImg.style.display = "none";
    placeholder.style.display = "none";
  }
}

/**
 * Handle image load error for preview.
 * @param {string} prefix - "add" or "edit"
 */
function handleImagePreviewError(prefix) {
  const previewImg = document.getElementById(`${prefix}-image-preview-img`);
  const placeholder = document.getElementById(`${prefix}-image-preview-placeholder`);
  if (previewImg && placeholder) {
    previewImg.style.display = "none";
    placeholder.style.display = "flex";
  }
}

/**
 * Reset image preview to hidden state.
 * @param {string} prefix - "add" or "edit"
 */
function resetImagePreview(prefix) {
  const previewContainer = document.getElementById(`${prefix}-image-preview`);
  const previewImg = document.getElementById(`${prefix}-image-preview-img`);
  const placeholder = document.getElementById(`${prefix}-image-preview-placeholder`);
  if (previewContainer) previewContainer.style.display = "none";
  if (previewImg) {
    previewImg.src = "";
    previewImg.style.display = "none";
  }
  if (placeholder) placeholder.style.display = "none";
}

/**
 * Open the image lightbox modal.
 * @param {string} imageUrl - The image URL to display
 * @param {string} productName - The product name for the title
 */
function openImageModal(imageUrl, productName) {
  const modalEl = document.getElementById("image-modal");
  const modalImg = document.getElementById("image-modal-img");
  const modalError = document.getElementById("image-modal-error");
  const modalTitle = document.getElementById("image-modal-label");
  if (!modalEl || !modalImg || !modalError || !modalTitle) return;

  modalTitle.textContent = productName;
  modalError.style.display = "none";
  modalImg.style.display = "none";
  modalImg.src = imageUrl;

  // Handle load/error
  modalImg.onload = () => {
    modalImg.style.display = "block";
    modalError.style.display = "none";
  };
  modalImg.onerror = () => {
    modalImg.style.display = "none";
    modalError.style.display = "block";
  };

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

/**
 * Open the Edit Product modal with existing data.
 * @param {number} id
 */
async function openEditModal(id) {
  try {
    showToast("info", "Loading product...");
    const data = await api.get(`/api/products/${id}`);
    const product = data.data;

    // Populate form fields
    document.getElementById("edit-product-id").value = product.id;
    document.getElementById("edit-name").value = product.name || "";
    document.getElementById("edit-sku").value = product.sku || "";
    document.getElementById("edit-category").value = product.category || "";
    document.getElementById("edit-selling-price").value = product.selling_price || "";
    document.getElementById("edit-cost-price").value = product.cost_price || "";
    document.getElementById("edit-low-stock").value = product.low_stock_threshold || "";
    document.getElementById("edit-image").value = product.image_url || "";
    document.getElementById("edit-description").value = product.description || "";

    // Hide stock input field, show display text
    const stockField = document.getElementById("edit-stock-field");
    const stockDisplay = document.getElementById("edit-stock-display");
    const stockDisplayText = document.getElementById("edit-stock-display-text");
    if (stockField) stockField.style.display = "none";
    if (stockDisplay) stockDisplay.style.display = "block";
    if (stockDisplayText) stockDisplayText.textContent = `Current stock: ${product.stock_quantity} units. Use the Adjust stock button to change it.`;

    // Update image preview
    updateImagePreview("edit", product.image_url || "");

    clearFormErrors(document.getElementById("edit-product-form"));
    state.modals.editProduct.show();
  } catch (err) {
    showToast("danger", err.message || "Failed to load product");
  }
}

/**
 * Open the Adjust Stock modal.
 * @param {number} id
 */
function openAdjustStockModal(id) {
  const form = document.getElementById("adjust-stock-form");
  if (!form) return;
  form.reset();
  document.getElementById("adjust-product-id").value = id;
  document.getElementById("adjust-type").value = "purchase";
  clearFormErrors(form);
  state.modals.adjustStock.show();
}

/**
 * Load and show stock history for a product.
 * @param {number} id
 */
let historyCurrentPage = 1;
let historyProductId = null;

async function openStockHistoryModal(id) {
  historyProductId = id;
  historyCurrentPage = 1;
  const content = document.getElementById("stock-history-content");
  if (!content) return;
  renderSkeleton(content, 3);
  state.modals.stockHistory.show();
  await loadStockHistory();
}

/**
 * Load stock history from the API.
 */
async function loadStockHistory() {
  const content = document.getElementById("stock-history-content");
  const pagination = document.getElementById("stock-history-pagination");
  if (!content) return;

  renderSkeleton(content, 3);

  const params = new URLSearchParams({
    page: historyCurrentPage,
    limit: 10,
  });

  try {
    const data = await api.get(`/api/products/${historyProductId}/movements?${params.toString()}`);
    const movements = data.data || [];
    const total = data.pagination?.total || 0;
    const totalPages = data.pagination?.totalPages || 0;

    if (movements.length === 0) {
      renderEmptyState(content, {
        icon: "bi-clock-history",
        title: "No movements",
        text: "No stock movements recorded for this product.",
      });
    } else {
      let html = `
        <div class="table-responsive">
          <table class="table table-sm table-hover mb-0 history-table">
            <thead class="table-light">
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th class="text-end">Change</th>
                <th class="text-end">Stock After</th>
                <th class="reason-column">Reason</th>
              </tr>
            </thead>
            <tbody>
          `;
      movements.forEach((m) => {
        const date = formatDate(m.created_at);
        const change = m.quantity_change > 0 ? `+${m.quantity_change}` : `${m.quantity_change}`;
        const changeClass = m.quantity_change > 0 ? "text-success" : "text-danger";
        const badgeClass = getTypeBadgeClass(m.movement_type);
        const typeLabel = m.movement_type.replace("_", " ");
        const reason = escapeHtml(m.reason) || "‐";

        html += `
          <tr>
            <td class="history-tcell">${escapeHtml(date)}<br><small class="text-muted">${escapeHtml(formatTime(m.created_at))}</small></td>
            <td class="history-tcell"><span class="badge ${badgeClass}">${escapeHtml(typeLabel)}</span></td>
            <td class="history-tcell text-end ${changeClass}">${change}</td>
            <td class="history-tcell text-end">${escapeHtml(m.stock_after)}</td>
            <td class="reason-column history-tcell text-muted small">${reason}</td>
          </tr>
        `;
      });
      html += `
            </tbody>
          </table>
        </div>
      `;
      content.innerHTML = html;
    }

    // Pagination
    if (pagination) {
      pagination.innerHTML = "";
      if (total > 10) {
        pagination.innerHTML = renderPaginationControls(historyCurrentPage, totalPages, total, (newPage) => {
          historyCurrentPage = newPage;
          loadStockHistory();
        });
      }
    }
  } catch (err) {
    content.innerHTML = "";
    renderEmptyState(content, {
      icon: "bi-emoji-frown",
      title: "Error",
      text: err.message || "Failed to load movement history.",
    });
  }
}

/**
 * Get badge class for movement type.
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
 * Format time as HH:MM.
 */
function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Format date as YYYY-MM-DD.
 */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString();
}

/**
 * Render pagination HTML for modal (returns string).
 */
function renderPaginationControls(current, totalPages, total, onPage) {
  let html = '<nav><ul class="pagination pagination-sm mb-0">';
  const prevDisabled = current === 1;
  const nextDisabled = current === totalPages;

  html += `<li class="page-item ${prevDisabled ? "disabled" : ""}"><button class="page-link" data-page="${current - 1}">«</button></li>`;

  const maxPages = 5;
  let start = Math.max(1, current - Math.floor(maxPages / 2));
  let end = Math.min(totalPages, start + maxPages - 1);
  start = Math.max(1, end - maxPages + 1);

  for (let i = start; i <= end; i++) {
    html += `<li class="page-item ${i === current ? "active" : ""}"><button class="page-link" data-page="${i}">${i}</button></li>`;
  }

  html += `<li class="page-item ${nextDisabled ? "disabled" : ""}"><button class="page-link" data-page="${current + 1}">»</button></li>`;
  html += "</ul></nav>";
  return html;
}

/**
 * Open the Delete confirmation modal.
 * @param {number} id
 */
async function openDeleteModal(id) {
  try {
    const data = await api.get(`/api/products/${id}`);
    document.getElementById("delete-product-id").value = id;
    document.getElementById("delete-product-name").textContent = data.data.name || "";
    clearFormErrors(document.getElementById("delete-product-form"));
    state.modals.deleteProduct.show();
  } catch (err) {
    showToast("danger", err.message || "Failed to load product");
  }
}

/**
 * Clear form errors.
 */
function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  form.querySelectorAll(".invalid-feedback").forEach((el) => (el.textContent = ""));
}

// --- Event bindings ---

/**
 * Wire up all event listeners.
 */
function wireEvents() {
  // Add product button
  elements.addProductBtn?.addEventListener("click", () => state.modals.addProduct.show());

  // Search with debounce
  let searchTimeout = null;
  elements.searchInput?.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.search = e.target.value.trim();
      applyFilters();
    }, 300);
  });

  // Category filter
  elements.categoryFilter?.addEventListener("change", (e) => {
    state.filters.category = e.target.value;
    applyFilters();
  });

  // Stock filter
  elements.stockFilter?.addEventListener("change", (e) => {
    state.filters.stock = e.target.value;
    applyFilters();
  });

  // Sort
  elements.sortSelect?.addEventListener("change", (e) => {
    state.filters.sort = e.target.value;
    applyFilters();
  });

  // Reset filters
  elements.resetFiltersBtn?.addEventListener("click", () => {
    state.filters = { search: "", category: "", stock: "", sort: "name:asc" };
    elements.searchInput.value = "";
    elements.categoryFilter.value = "";
    elements.stockFilter.value = "";
    elements.sortSelect.value = "name:asc";
    applyFilters();
  });

  // Image URL live preview for Add modal
  document.getElementById("add-image")?.addEventListener("input", (e) => {
    updateImagePreview("add", e.target.value);
  });
  document.getElementById("add-image-preview-img")?.addEventListener("error", () => {
    handleImagePreviewError("add");
  });

  // Image URL live preview for Edit modal
  document.getElementById("edit-image")?.addEventListener("input", (e) => {
    updateImagePreview("edit", e.target.value);
  });
  document.getElementById("edit-image-preview-img")?.addEventListener("error", () => {
    handleImagePreviewError("edit");
  });

  // Add product form submit
  document.getElementById("add-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormErrors(e.target);
    const submitBtn = document.getElementById("add-product-submit");
    setButtonLoading(submitBtn, true);

    const formData = new FormData(e.target);
    const payload = {};
    formData.forEach((value, key) => {
      // Convert empty strings to undefined for optional fields
      payload[key] = value === "" ? undefined : value;
    });
    // stock_quantity defaults to 0 if not provided
    if (payload.stock_quantity === undefined) payload.stock_quantity = 0;

    try {
      await api.post("/api/products", payload);
      showToast("success", "Product added successfully");
      state.modals.addProduct.hide();
      applyFilters();
    } catch (err) {
      if (err.details && err.details.fields) {
        clearFormErrors(e.target);
        Object.entries(err.details.fields).forEach(([key, msg]) => {
          const input = e.target.querySelector(`[name="${key}"]`);
          if (input) {
            input.classList.add("is-invalid");
            let feedback = input.closest(".mb-3")?.querySelector(".invalid-feedback");
            if (feedback) feedback.textContent = msg;
          }
        });
      } else {
        showToast("danger", err.message || "Failed to add product");
      }
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  // Edit product form submit
  document.getElementById("edit-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormErrors(e.target);
    const submitBtn = document.getElementById("edit-product-submit");
    setButtonLoading(submitBtn, true);

    const formData = new FormData(e.target);
    const id = formData.get("id");
    const payload = {};
    formData.forEach((value, key) => {
      if (key === "id") return;
      if (key === "stock_quantity") return; // Never send stock_quantity from Edit modal
      payload[key] = value === "" ? null : value;
    });
    // Convert numeric fields
    if (payload.selling_price !== null) payload.selling_price = parseFloat(payload.selling_price);
    if (payload.cost_price !== null) payload.cost_price = parseFloat(payload.cost_price);
    if (payload.low_stock_threshold !== null) payload.low_stock_threshold = parseInt(payload.low_stock_threshold, 10);

    try {
      await api.put(`/api/products/${id}`, payload);
      showToast("success", "Product updated successfully");
      state.modals.editProduct.hide();
      loadProducts();
    } catch (err) {
      if (err.details && err.details.fields) {
        clearFormErrors(e.target);
        Object.entries(err.details.fields).forEach(([key, msg]) => {
          const input = e.target.querySelector(`[name="${key}"]`);
          if (input) {
            input.classList.add("is-invalid");
            let feedback = input.closest(".mb-3")?.querySelector(".invalid-feedback");
            if (feedback) feedback.textContent = msg;
          }
        });
      } else {
        showToast("danger", err.message || "Failed to update product");
      }
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  // Adjust stock form submit
  document.getElementById("adjust-stock-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormErrors(e.target);
    const submitBtn = document.getElementById("adjust-stock-submit");
    setButtonLoading(submitBtn, true);

    const formData = new FormData(e.target);
    const id = formData.get("id");
    const movementType = formData.get("movement_type");
    const quantityChange = formData.get("quantity_change");
    const reason = formData.get("reason") || undefined;

    const payload = {
      movement_type: movementType,
      quantity_change: parseInt(quantityChange, 10),
    };
    if (reason !== undefined) payload.reason = reason;

    try {
      await api.post(`/api/products/${id}/stock-adjustments`, payload);
      showToast("success", "Stock adjusted successfully");
      state.modals.adjustStock.hide();
      loadProducts();
    } catch (err) {
      if (err.details && err.details.fields) {
        clearFormErrors(e.target);
        Object.entries(err.details.fields).forEach(([key, msg]) => {
          const input = e.target.querySelector(`[name="${key}"]`);
          if (input) {
            input.classList.add("is-invalid");
            let feedback = input.closest(".mb-3")?.querySelector(".invalid-feedback");
            if (feedback) feedback.textContent = msg;
          }
        });
      } else {
        showToast("danger", err.message || "Failed to adjust stock");
      }
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  // Delete product form submit
  document.getElementById("delete-product-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("delete-product-submit");
    setButtonLoading(submitBtn, true);

    const id = document.getElementById("delete-product-id").value;

    try {
      await api.delete(`/api/products/${id}`);
      showToast("success", "Product deleted successfully");
      state.modals.deleteProduct.hide();
      applyFilters();
    } catch (err) {
      showToast("danger", err.message || "Failed to delete product");
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
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
 * Main initialization.
 */
async function init() {
  cacheElements();
  initModals();
  wireEvents();
  await loadUserProfile();
  await loadCategories();
  loadProducts();
}

init();